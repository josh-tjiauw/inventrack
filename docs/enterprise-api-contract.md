# Inventrack Enterprise API Contract Draft

This document translates the PostgreSQL enterprise redesign into backend API boundaries. It is intentionally implementation-ready, but database-first: every write endpoint should map to a transaction that updates operational tables and writes an append-only `stock_movements` row.

## Design Principles

- Treat PostgreSQL as the source of truth for inventory state.
- Use tenant-scoped routes so every query is isolated by `company_id`.
- Prefer stable IDs in write requests and human-readable codes in read responses.
- Wrap stock-changing operations in one database transaction.
- Lock mutable inventory rows with `SELECT ... FOR UPDATE` before decrementing, reserving, or moving stock.
- Return `409 Conflict` when business rules reject an otherwise valid request, such as insufficient available quantity.
- Never edit historical `stock_movements`; correct mistakes with a new compensating movement.

## Shared Response Shape

Successful single-resource response:

```json
{
  "success": true,
  "data": {},
  "requestId": "req_01hxyz"
}
```

Validation or business-rule failure:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_AVAILABLE_QUANTITY",
    "message": "Requested quantity exceeds available stock for this lot."
  },
  "requestId": "req_01hxyz"
}
```

Recommended status codes:

- `200 OK` for reads and completed idempotent updates.
- `201 Created` for created shipments, lots, and movement records.
- `400 Bad Request` for malformed input.
- `401 Unauthorized` when no valid session/token exists.
- `403 Forbidden` when the user lacks role permission.
- `404 Not Found` when the tenant-scoped resource does not exist.
- `409 Conflict` for inventory business-rule conflicts.

## Core Read Endpoints

### `GET /api/companies/:companyId/warehouses`

Returns active and inactive warehouses for one tenant.

Backed by:

- `warehouses`
- `storage_locations` for optional location counts

### `GET /api/companies/:companyId/inventory`

Returns current stock by SKU, lot, location, and warehouse.

Recommended source:

- `v_current_inventory_by_location`

Common query params:

- `warehouseId`
- `sku`
- `category`
- `onlyAvailable=true`
- `limit`
- `cursor`

### `GET /api/companies/:companyId/skus/low-stock`

Returns SKUs at or below reorder point.

Recommended source:

- `v_low_stock_skus`

### `GET /api/companies/:companyId/stock-movements`

Returns ledger history for audits and operations review.

Recommended source:

- `v_stock_movement_history`

Common query params:

- `skuId`
- `movementType`
- `fromDate`
- `toDate`
- `performedByUserId`
- `referenceType`
- `referenceId`

## Stock-Changing Endpoints

### Receive inbound stock

`POST /api/companies/:companyId/shipments/:shipmentId/receive`

Request:

```json
{
  "shipmentLineId": 12,
  "skuId": 6,
  "toLocationId": 5,
  "lotNumber": "RECEIVE-2026-001",
  "quantity": 10,
  "performedByUserId": 2,
  "notes": "Received into inbound staging"
}
```

Transaction responsibilities:

1. Verify shipment belongs to `companyId` and is inbound.
2. Verify shipment line belongs to shipment and SKU.
3. Reject if `received_quantity + quantity > shipment_lines.quantity`.
4. Insert or update `inventory_lots` for `(sku_id, location_id, lot_number)`.
5. Increment `shipment_lines.received_quantity`.
6. Insert `stock_movements` with `movement_type = 'receive'`, `to_location_id`, `reference_type = 'shipment'`, and `reference_id = shipmentId`.
7. Optionally write an `audit_logs` row for the API action.

Conflict errors:

- `OVER_RECEIVE_SHIPMENT_LINE`
- `INVALID_RECEIVING_LOCATION`

### Export outbound stock

`POST /api/companies/:companyId/shipments/:shipmentId/export`

Request:

```json
{
  "shipmentLineId": 18,
  "skuId": 4,
  "fromLotId": 9,
  "quantity": 5,
  "performedByUserId": 3,
  "notes": "Picked for outbound order"
}
```

Transaction responsibilities:

1. Verify shipment belongs to `companyId` and is outbound.
2. Verify shipment line belongs to shipment and SKU.
3. Lock the selected `inventory_lots` row with `FOR UPDATE`.
4. Reject if `quantity_on_hand - quantity_reserved < quantity`.
5. Reject if `exported_quantity + quantity > shipment_lines.quantity`.
6. Decrement `inventory_lots.quantity_on_hand`.
7. Increment `shipment_lines.exported_quantity`.
8. Insert `stock_movements` with `movement_type = 'export'`, `from_location_id`, `reference_type = 'shipment'`, and `reference_id = shipmentId`.
9. Optionally mark the shipment `completed` when all lines are fully exported.

Conflict errors:

- `INSUFFICIENT_AVAILABLE_QUANTITY`
- `OVER_EXPORT_SHIPMENT_LINE`
- `LOT_SKU_MISMATCH`

### Move stock between locations

`POST /api/companies/:companyId/stock-movements/move`

Request:

```json
{
  "skuId": 1,
  "fromLotId": 1,
  "toLocationId": 6,
  "toLotNumber": "MON-2026-01",
  "quantity": 8,
  "performedByUserId": 2,
  "notes": "Move overflow stock to LA warehouse"
}
```

Transaction responsibilities:

1. Lock source lot with `FOR UPDATE`.
2. Reject if source available quantity is too low.
3. Decrement source `quantity_on_hand`.
4. Insert or update destination lot.
5. Insert `stock_movements` with `movement_type = 'move'`, `from_location_id`, and `to_location_id`.

Conflict errors:

- `INSUFFICIENT_AVAILABLE_QUANTITY`
- `DESTINATION_LOCATION_INACTIVE`
- `CROSS_COMPANY_MOVE_NOT_ALLOWED`

### Reserve stock

`POST /api/companies/:companyId/inventory-lots/:lotId/reserve`

Request:

```json
{
  "quantity": 3,
  "referenceType": "shipment",
  "referenceId": 4,
  "performedByUserId": 3,
  "notes": "Reserve units for outbound shipment"
}
```

Transaction responsibilities:

1. Lock lot with `FOR UPDATE`.
2. Reject if available quantity is too low.
3. Increment `quantity_reserved`.
4. Insert `stock_movements` with `movement_type = 'reserve'`.

Conflict errors:

- `INSUFFICIENT_AVAILABLE_QUANTITY`

### Release reserved stock

`POST /api/companies/:companyId/inventory-lots/:lotId/release-reservation`

Request:

```json
{
  "quantity": 3,
  "referenceType": "shipment",
  "referenceId": 4,
  "performedByUserId": 3,
  "notes": "Customer cancelled line item"
}
```

Transaction responsibilities:

1. Lock lot with `FOR UPDATE`.
2. Reject if `quantity_reserved < quantity`.
3. Decrement `quantity_reserved`.
4. Insert `stock_movements` with `movement_type = 'release_reservation'`.

Conflict errors:

- `RELEASE_EXCEEDS_RESERVED_QUANTITY`

## Role Access Draft

- `owner`, `admin`: full access to company inventory, users, settings, and audit reports.
- `warehouse_manager`: read inventory; receive, export, move, reserve, and adjust stock.
- `inventory_clerk`: read inventory; receive, export, move, reserve, and release reservations.
- `viewer`: read-only inventory, movement history, and dashboard views.

## Implementation Checklist

- Add request validation schemas for each write endpoint.
- Add a transaction helper that receives a database client and rolls back on thrown errors.
- Add integration tests for receive/export/move/reserve conflicts.
- Add indexes for common filters once query plans are measured.
- Include `requestId` in logs, errors, and audit rows.
- Keep MongoDB prototype routes documented separately until the backend is migrated.
