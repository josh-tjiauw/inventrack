# Inventrack Enterprise PostgreSQL Practice Dataset

This folder contains a sample relational database for a redesigned enterprise version of Inventrack.

## File

- `inventrack_enterprise_schema_seed.sql`
- `transaction-practice.sql`
- `reporting-views.sql`
- `api-read-model-queries.sql`

The schema/seed file includes:

- Table drops/recreates
- PostgreSQL schema
- Foreign keys
- Check constraints
- Unique constraints
- Indexes
- Sample seed data
- Practice queries
- Reusable reporting views for dashboards and API read models
- Backend-style API read-model query examples

## Tables Included

Core organization/user tables:

- `companies`
- `users`

Warehouse/location tables:

- `warehouses`
- `storage_locations`

Product/inventory tables:

- `skus`
- `inventory_lots`

Shipment tables:

- `shipments`
- `shipment_lines`

Enterprise tracking tables:

- `stock_movements`
- `audit_logs`

## Why This Design Is Different From Current Inventrack

The current Inventrack prototype is shelf-centered:

```text
Shelf has items.
Update shelf count.
```

The enterprise design is ledger-centered:

```text
SKU exists.
Stock exists at a location.
Every change creates a stock movement.
Reports come from relational data.
```

That means you can answer business questions like:

- What stock do we have right now?
- Where is each SKU stored?
- Which items are below reorder point?
- Who moved inventory?
- Which shipment caused a stock change?
- How full is each warehouse location?

## How To Load It In PostgreSQL

If you have a local database named `inventrack_practice`:

```bash
psql -d inventrack_practice -f inventrack_enterprise_schema_seed.sql
```

Or from inside `psql`:

```sql
\i database/postgresql-practice/inventrack_enterprise_schema_seed.sql
```

If you need to create the database first:

```sql
CREATE DATABASE inventrack_practice;
```

Then connect to it:

```sql
\c inventrack_practice
```

And run the file.

## Transaction Practice

After loading the seed data, run the transaction practice file:

```bash
psql -d inventrack_practice -f transaction-practice.sql
```

Or from the repo root:

```bash
psql -d inventrack_practice -f database/postgresql-practice/transaction-practice.sql
```

The examples cover:

- Receiving inbound stock into staging
- Exporting outbound stock from an available lot
- Using `BEGIN` / `ROLLBACK` for safe practice runs
- Updating inventory lots and shipment lines together
- Writing append-only `stock_movements` ledger entries
- Using `FOR UPDATE` row locks to prevent double-spending stock
- Returning zero validated rows for impossible exports

The scenarios intentionally use `ROLLBACK`, so they can be rerun without resetting the database.

## Reporting Views

After loading the seed data, run the reporting views file:

```bash
psql -d inventrack_practice -f database/postgresql-practice/reporting-views.sql
```

The views turn normalized enterprise tables into dashboard/API-friendly read models:

- `v_current_inventory_by_location` — current lot balances with company, warehouse, location, and SKU context.
- `v_low_stock_skus` — SKUs where total available quantity is at or below reorder point.
- `v_warehouse_capacity_summary` — warehouse-level capacity utilization.
- `v_stock_movement_history` — readable append-only movement ledger for audits and operations review.

These views are intentionally read-only practice artifacts. They help connect relational modeling to the screens and API responses an enterprise inventory system would need.

## API Read Model Queries

After loading the seed data, run the API read-model examples:

```bash
psql -d inventrack_practice -f database/postgresql-practice/api-read-model-queries.sql
```

The examples are SELECT-only and model backend result sets for:

- `GET /api/warehouses/:warehouseId/inventory`
- `GET /api/skus/:skuId/availability`
- `GET /api/shipments/:shipmentNumber`
- `GET /api/stock-movements?skuId=&limit=&before=`
- `GET /api/dashboard/operations-summary`

They intentionally bind a `company_id` in each query CTE to reinforce tenant isolation at the SQL boundary.

## Good Practice Questions

Try writing SQL for these before looking at the included queries.

### Beginner

1. Show all warehouses for `Acme Distribution Co.`
2. Show all SKUs and their reorder points.
3. Show every storage location and its capacity.
4. Show all users with the `warehouse_manager` role.

### Intermediate

5. Show current stock by SKU and location.
6. Show available quantity using:

```text
quantity_on_hand - quantity_reserved
```

7. Show all low-stock SKUs where available quantity is less than or equal to reorder point.
8. Show all outbound shipments with their shipment lines.
9. Show all stock movements for `ELEC-MON-27-4K`.

### Advanced

10. Calculate percent full for each storage location.
11. Find SKUs stored in more than one warehouse.
12. Show the latest stock movement per SKU using `ROW_NUMBER()`.
13. Show total received quantity by supplier.
14. Show total exported quantity by customer.
15. Build an audit history report for one company.
16. Query `v_current_inventory_by_location` for all available stock in one warehouse.
17. Use `v_low_stock_skus` to explain which SKU should be reordered first.
18. Compare `v_warehouse_capacity_summary` across warehouses and identify the fullest one.
19. Filter `v_stock_movement_history` to show every export performed by one user.

## Suggested Learning Path

1. First, read the table definitions.
2. Draw the relationships by hand.
3. Run simple `SELECT * FROM table_name;` queries.
4. Practice `JOIN`s across 2 tables.
5. Practice 3–5 table joins.
6. Practice grouping and aggregation.
7. Practice window functions on `stock_movements`.
8. Run `transaction-practice.sql` and trace how each CTE protects inventory integrity.
9. Run `reporting-views.sql` and inspect how each view joins normalized tables into an API-friendly read model.
10. Rewrite one transaction to use different SKUs, quantities, and shipment numbers.
11. Convert one transaction into backend pseudocode for an API endpoint.

## Important Enterprise Concepts Practiced

- Primary keys
- Foreign keys
- One-to-many relationships
- Unique constraints
- Check constraints
- Indexes
- Audit logs
- Stock movement ledger
- Multi-tenant data model
- Transaction-friendly inventory design
- Row-level locks for concurrent inventory updates
- Append-only stock movement ledger writes
- Reporting views for operational dashboards and API read models
