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
