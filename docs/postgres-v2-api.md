# Inventrack PostgreSQL v2 API

This is the first implementation slice of the new relational/PostgreSQL version of Inventrack.

The legacy MongoDB endpoints still exist under routes like:

```text
/api/shelves
/api/shipments
```

The PostgreSQL-backed enterprise read API starts under:

```text
/api/v2
```

## Required backend environment

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/inventrack?sslmode=require
```

For local practice on Josh's machine:

```powershell
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/inventrack_practice'
```

## Endpoints

## Demo auth, RBAC, and tenant guardrails

PostgreSQL v2 routes include a pragmatic portfolio auth layer designed to be safe for demos without adding a full identity provider yet.

Default local/demo behavior:

- If `DEMO_AUTH_REQUIRED` is not `true`, requests default to an `admin` demo role so the portfolio app remains easy to run locally.
- Tests and smoke checks can pass `X-Demo-Role: viewer|operator|manager|admin` to exercise RBAC behavior.
- Passing `X-Company-Id: <id>` or setting `DEMO_COMPANY_ID=<id>` scopes reads to that company when no `companyId` query is supplied and blocks explicit cross-company requests.

Strict demo boundary:

```text
DEMO_AUTH_REQUIRED=true
DEMO_ADMIN_TOKEN=replace-with-secret
DEMO_MANAGER_TOKEN=replace-with-secret
DEMO_OPERATOR_TOKEN=replace-with-secret
DEMO_VIEWER_TOKEN=replace-with-secret
DEMO_COMPANY_ID=1
```

When strict mode is enabled, clients must send one configured bearer token:

```text
Authorization: Bearer <DEMO_ADMIN_TOKEN>
```

Mutation RBAC:

- `admin` / `manager`: warehouse, location, SKU, shipment, and stock workflow writes.
- `operator`: shipment and stock workflow writes.
- `viewer`: read-only; write requests return `403 FORBIDDEN_ROLE`.

This is intentionally demo-scoped rather than production SSO/OIDC. The guardrails make the enterprise security story explicit while keeping the portfolio deployment simple.

## Request IDs and audit behavior

Every backend request receives a request ID. Clients may pass one with the `X-Request-Id` header; otherwise the API generates a `req_*` ID. The same value is returned in the `X-Request-Id` response header, included in structured error bodies as `requestId`, and written to request logs.

Important PostgreSQL v2 mutations also write an `audit_logs` row with the same `request_id` so a demo can trace one API call through:

- the HTTP response/header,
- backend logs,
- durable `audit_logs` records.

Audited mutations currently include warehouse, storage-location, SKU, shipment, receive, export, move, reserve, and release-reservation writes.

### Health

```text
GET /api/v2/health
```

Returns PostgreSQL connectivity and counts for core relational tables.

### Warehouses

```text
GET /api/v2/warehouses
GET /api/v2/warehouses?companyId=1
```

Uses the `v_warehouse_capacity_summary` reporting view.

### Storage locations

```text
GET /api/v2/storage-locations
GET /api/v2/storage-locations?companyId=1
GET /api/v2/storage-locations?warehouseId=1
GET /api/v2/storage-locations?status=active
```

Returns location-level capacity, status, SKU count, on-hand/reserved/available quantity, and percent-full metrics.

Backed by:

- `storage_locations`
- `warehouses`
- `companies`
- `inventory_lots`

The `/warehouses` React page uses this endpoint as a read-only warehouse/location map for demo and troubleshooting.

### SKUs

```text
GET /api/v2/skus
GET /api/v2/skus?companyId=1
GET /api/v2/skus?category=Electronics
GET /api/v2/skus?lowStock=true
```

Returns SKU catalog records with aggregated on-hand, reserved, and available quantities.

### Inventory

```text
GET /api/v2/inventory
GET /api/v2/inventory?companyId=1
GET /api/v2/inventory?warehouseId=1
GET /api/v2/inventory?skuId=1
GET /api/v2/inventory?lowStock=true
```

Uses the `v_current_inventory_by_location` reporting view.

### Stock movements

```text
GET /api/v2/stock-movements
GET /api/v2/stock-movements?companyId=1
GET /api/v2/stock-movements?skuId=1
GET /api/v2/stock-movements?movementType=receive
GET /api/v2/stock-movements?limit=25
```

Uses the `v_stock_movement_history` view.

### Reservation workflows

```text
POST /api/v2/reserve-stock
POST /api/v2/release-reservation
```

Reserve available quantity from a specific inventory lot without changing on-hand quantity:

```json
{
  "inventoryLotId": 1,
  "quantity": 4,
  "performedByUserId": 2,
  "notes": "Reserve for outbound order SO-1001"
}
```

Release previously reserved quantity from the same lot:

```json
{
  "inventoryLotId": 1,
  "quantity": 2,
  "performedByUserId": 2,
  "notes": "Release cancelled order quantity"
}
```

Both endpoints lock the inventory lot inside a PostgreSQL transaction, preserve the invariant `quantity_reserved <= quantity_on_hand`, and write `stock_movements` rows with `movement_type = 'reserve'` or `movement_type = 'release_reservation'`.

### Shipments

```text
GET /api/v2/shipments
GET /api/v2/shipments?companyId=1
GET /api/v2/shipments?shipmentType=inbound
GET /api/v2/shipments?shipmentType=outbound
GET /api/v2/shipments?status=scheduled
GET /api/v2/shipments?limit=25
```

Returns shipment headers with aggregated line counts, total quantities, receive/export progress, and embedded shipment line summaries.

Backed by:

- `shipments`
- `shipment_lines`
- `skus`
- `companies`
- `users`

The `/shipments` React page uses this endpoint as a read-only operations board until PostgreSQL write endpoints are implemented.

### Storage recommendations

```text
GET /api/v2/storage-recommendations
GET /api/v2/storage-recommendations?companyId=1
```

Returns rule-based recommendations for capacity pressure, low-stock SKUs, and near-expiration lots without requiring a paid AI API call.

## Why this matters

This begins the real migration away from the shelf-centered MongoDB prototype and toward the enterprise relational model documented in:

```text
docs/architecture-enterprise-redesign.md
```

Current app mental model:

```text
Shelf has items.
Update shelf count.
```

New v2 mental model:

```text
SKU exists.
Stock exists at a warehouse location.
Every inventory change is recorded in stock_movements.
Reports/API reads come from relational tables and views.
```

## Local validation

From the repo root, load the PostgreSQL practice schema/views first:

```powershell
$env:PGPASSWORD = 'postgres'
.\database\postgresql-practice\validate-local-postgres.ps1
```

Then run backend tests:

```powershell
cd backend
$env:NODE_ENV = 'test'
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/inventrack_practice'
npm test -- --runInBand __tests__/postgres-v2.test.js
```
