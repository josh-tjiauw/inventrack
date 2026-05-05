# Inventrack Build Explanation for Employers

Last updated: 2026-05-05

## Executive Summary

Inventrack started as a smaller inventory-management prototype and was rebuilt into a PostgreSQL-backed, enterprise-style inventory tracking system. The work moved the project toward a portfolio-quality architecture with a React frontend, Node/Express backend, PostgreSQL relational database, CI checks, deployment configuration, and live Render/Vercel integration.

The key goal was not just to make screens work, but to demonstrate software-engineering judgment: relational modeling, database constraints, transaction-safe stock movement, API design, frontend/backend integration, deployment readiness, testing, and clear documentation.

Current deployed architecture:

```text
React frontend -> Vercel
Node/Express API -> Render
PostgreSQL database -> Neon
CI/CD -> GitHub Actions
```

## 1. Initial Assessment

The app began as a MERN-style inventory prototype using React, Express, MongoDB/Mongoose routes, shelves, shipments, dashboard behavior, and some AI recommendation concepts.

That was useful as a demo, but it had limitations for a real inventory system:

- Inventory belongs naturally in relational tables, not loosely shaped documents.
- Stock movement requires auditability and transaction safety.
- Receiving and exporting inventory must not create negative stock or impossible states.
- Employers reviewing the project should see SQL, schema design, joins, constraints, testing, deployment, and operational thinking.

So the project direction changed from patching the old MongoDB prototype to building a proper PostgreSQL v2 architecture while keeping old routes around for compatibility.

## 2. Enterprise Architecture Design

The first major step was documenting the target architecture in `docs/architecture-enterprise-redesign.md`.

The redesign defined these core goals:

- Reliability: prevent invalid inventory states.
- Scalability: support multiple warehouses, users, SKUs, and movements.
- Auditability: every inventory change should be traceable.
- Maintainability: separate frontend, backend, database, and deployment responsibilities.
- Security: eventually support tenant isolation and role-based access.
- Portfolio value: show SQL, backend design, CI/CD, and production-minded engineering.

The architecture was planned as:

```text
React frontend
  -> JSON API
Node/Express backend
  -> PostgreSQL
Reporting views / transaction logic / audit history
```

## 3. Relational Data Model

The next step was designing a relational inventory model.

Core tables:

- `companies`: tenant/company records.
- `users`: people acting inside a company, with roles.
- `warehouses`: physical warehouse sites.
- `storage_locations`: bins, racks, shelves, staging, cold storage, overflow areas.
- `skus`: canonical product records.
- `inventory_lots`: quantity of a SKU at a location, optionally by lot/batch.
- `shipments`: inbound/outbound shipment headers.
- `shipment_lines`: shipment SKU quantities and receive/export progress.
- `stock_movements`: append-style movement ledger for receive, move, reserve, export, adjust, etc.
- `audit_logs`: future audit trail support.

Important database rules were added through constraints:

- Storage location capacity must be positive.
- SKU reorder points cannot be negative.
- Inventory quantities cannot be negative.
- Reserved quantity cannot exceed on-hand quantity.
- Shipment lines cannot be over-received or over-exported.
- Stock movements must have a source or destination location.
- Unique constraints prevent duplicate SKU/location/lot combinations and duplicate warehouse/location codes.

This makes the database enforce business correctness instead of relying only on frontend validation.

## 4. PostgreSQL Practice Foundation

Before deploying the backend, a local PostgreSQL practice foundation was created under `database/postgresql-practice/`.

Files included:

- `inventrack_enterprise_schema_seed.sql`: schema plus demo data.
- `transaction-practice.sql`: example transactional inventory operations.
- `reporting-views.sql`: reporting read models.
- `validation-checks.sql`: SQL checks to verify data integrity.
- `api-read-model-queries.sql`: SQL examples that later informed API endpoints.
- `validate-local-postgres.ps1`: local validation helper.

This step was important because it treated SQL as a first-class part of the project, not an afterthought.

## 5. Reporting Views

Several SQL views were introduced to make backend API reads cleaner:

- Warehouse capacity summaries.
- Current inventory by location.
- Stock movement history.

The reason for using views was to keep complex joins and aggregation close to the database while exposing clean read models to the backend.

For example, the frontend does not need to manually join companies, warehouses, locations, SKUs, and lots. It can call `/api/v2/inventory` and receive a frontend-friendly inventory view.

## 6. PostgreSQL Backend Foundation

A new PostgreSQL backend path was added alongside the older MongoDB routes.

Key files:

- `backend/db/postgres.js`
- `backend/routes/v2.js`

The PostgreSQL client dependency `pg` was added. The backend was configured to read `DATABASE_URL` or `POSTGRES_URL`, use SSL automatically for hosted providers like Neon/Render/Railway/Supabase, and expose a v2 route group at:

```text
/api/v2/*
```

The original MongoDB routes stayed available under legacy paths for compatibility, but the new enterprise implementation lives in v2.

## 7. v2 Read API Endpoints

The first API goal was to expose read-only PostgreSQL data safely.

Endpoints added:

- `GET /api/v2/health`
- `GET /api/v2/warehouses`
- `GET /api/v2/storage-locations`
- `GET /api/v2/skus`
- `GET /api/v2/inventory`
- `GET /api/v2/stock-movements`
- `GET /api/v2/shipments`
- `GET /api/v2/storage-recommendations`

These endpoints made the frontend useful without introducing write-risk too early.

The health endpoint verifies PostgreSQL connectivity and returns table counts, which is useful for debugging deployments and showing operational awareness.

## 8. Frontend Integration with PostgreSQL Reads

Once the v2 read endpoints existed, the React frontend was progressively converted to use live PostgreSQL data.

Pages/screens added or converted:

- Dashboard: connected to v2 warehouse, SKU, inventory, and movement data.
- Storage Recommendations panel: rule-based recommendations from `/api/v2/storage-recommendations`.
- SKU Catalog: category and low-stock filters using `/api/v2/skus`.
- Shipment Board: shipment summaries and line progress from `/api/v2/shipments`.
- System Status page: API base URL, backend mode, health, table counts, and smoke checks.
- Warehouse Location Map: capacity/location status from `/api/v2/storage-locations`.
- Stock Movement History: audit ledger from `/api/v2/stock-movements`.
- Inventory Explorer: lot-level inventory from `/api/v2/inventory`.

This turned the app from static/demo UI into a live frontend backed by the deployed PostgreSQL API.

## 9. Deployment Configuration

The app was prepared for portfolio hosting.

Deployment files added:

- `vercel.json` for frontend routing and deployment behavior.
- `render.yaml` for backend deployment configuration.
- `Procfile` for backend start behavior.
- `.env.production.example` for frontend configuration.
- `backend/.env.production.example` for backend configuration.

The production frontend was configured to use the deployed Render API:

```text
https://inventrack-api-v2l8.onrender.com
```

The live frontend is hosted on Vercel:

```text
https://inventrack-cyan.vercel.app
```

The backend is hosted on Render and connected to Neon PostgreSQL.

## 10. Rule-Based Recommendations

The old idea of AI-powered recommendations was replaced with a safer rule-based recommendation endpoint.

Why:

- Avoid unnecessary paid API dependency.
- Make recommendations explainable.
- Demonstrate practical business logic.

Recommendation categories include:

- Capacity warnings for warehouses near full.
- Low-stock/reorder suggestions.
- Expiring-lot rotation suggestions.

This endpoint supports dashboard and receiving workflows while keeping the system deterministic and easy to test.

## 11. Receive Workflow

The `/receive` page was converted from the legacy MongoDB shelf/AI flow into a PostgreSQL v2 receive workflow.

Frontend behavior:

- Loads live SKUs.
- Loads active storage locations.
- Loads rule-based recommendations.
- Lets the user choose a SKU, quantity, and supplier/reference.
- Ranks active storage locations by available capacity and projected utilization.
- Shows why each location is recommended.
- Commits a receive transaction through the backend.

Backend endpoint:

```text
POST /api/v2/receive-stock
```

Receive transaction behavior:

1. Validate that `skuId`, `locationId`, and `quantity` are valid.
2. Confirm the SKU and storage location belong to the same company.
3. Confirm the target location is active.
4. Check projected capacity before receiving stock.
5. Insert or update the matching inventory lot.
6. Insert a `receive` row into `stock_movements`.
7. Commit the whole operation as one PostgreSQL transaction.

If any step fails, the transaction rolls back.

## 12. Export Workflow

The `/export` page was converted from the legacy MongoDB shelf flow into a PostgreSQL v2 export workflow.

Frontend behavior:

- Loads live inventory lots.
- Loads SKUs.
- Lets the user choose SKU, quantity, and destination/customer.
- Generates a FEFO-style pick plan.
- Shows requested, available, planned, and shortage totals.
- Commits export through the backend.

FEFO means First Expired, First Out. Lots with earlier expiration dates are picked first; non-expiring lots are picked later.

Backend endpoint:

```text
POST /api/v2/export-stock
```

Export transaction behavior:

1. Validate SKU and quantity.
2. Lock available inventory lots for that SKU.
3. Sort by expiration date, location, and lot id.
4. Confirm total available stock can satisfy the export.
5. Decrement inventory lots in pick order.
6. Insert `export` stock movement rows.
7. Return the pick plan and committed movement data.
8. Roll back if available stock is insufficient.

This is the most important enterprise behavior in the app because inventory systems must never silently oversell or create negative stock.

## 13. Transaction Service Extraction

The receive/export transaction logic was extracted into:

```text
backend/services/stockTransactions.js
```

This made the backend cleaner and more maintainable:

- Route handlers validate and shape HTTP requests.
- Service functions own the inventory transaction logic.
- Tests can target the service behavior more cleanly.
- Future shipment-backed workflows can reuse the same stock transaction logic.

## 14. Create Endpoints

After read endpoints and manual stock transactions worked, additional create endpoints were added:

- `POST /api/v2/warehouses`
- `POST /api/v2/storage-locations`
- `POST /api/v2/skus`
- `POST /api/v2/shipments`

The shipment creation endpoint supports shipment headers and line assignments, which is a foundation for future shipment-backed receive/export workflows.

## 15. Shipment Creation UI

The Shipment Board was expanded so the frontend can create shipment records instead of only viewing seeded data.

This matters because it starts moving the system from read-only dashboard into an operational application.

## 16. Migrations

Practice SQL was converted into production-style migrations:

- `database/migrations/001_enterprise_schema.sql`
- `database/migrations/002_reporting_views.sql`
- `database/migrations/003_demo_seed.sql`
- `database/migrations/README.md`

This makes the database setup reproducible for CI, local development, and future deployment environments.

## 17. CI Workflow

GitHub Actions CI was added in:

```text
.github/workflows/ci.yml
```

The workflow:

1. Installs frontend dependencies.
2. Builds the React frontend.
3. Starts a disposable PostgreSQL service.
4. Loads migrations and demo seed data.
5. Installs backend dependencies.
6. Runs the PostgreSQL v2 backend test suite.

This demonstrates deployment discipline and gives employers confidence that the app is not just manually tested.

## 18. Testing

The backend v2 integration tests cover:

- Health endpoint.
- Warehouse reads.
- Storage location reads.
- SKU reads and low-stock filtering.
- Inventory reads.
- Movement history reads.
- Shipment reads.
- Rule-based recommendations.
- Create endpoints for warehouse, storage location, SKU, and shipments.
- Manual receive/export success cases.
- Conflict cases such as insufficient capacity or insufficient stock.

Local caveat: the old MongoDB test suite can fail when MongoDB is not connected. The PostgreSQL v2 test path is the relevant enterprise path and is wired into CI with disposable Postgres.

## 19. Live Deployment Verification

The live deployed system was checked through Vercel and Render.

Verified:

- Vercel frontend routes return HTTP 200.
- Render backend `/api/v2/health` returns PostgreSQL OK.
- `/api/v2/inventory` returns live inventory data.
- `/api/v2/skus` returns live SKU data.
- `/receive` and `/export` routes load.

A live transaction smoke test was also approved and executed:

- SKU: `TOOL-SCAN-HAND`
- Location: `A-01-BIN-01`
- Lot: `SCAN-2026-01`
- Quantity: `1`

Workflow:

1. Checked initial available quantity: `3`.
2. Called `POST /api/v2/receive-stock` for 1 unit.
3. Verified available quantity became `4`.
4. Called `POST /api/v2/export-stock` for 1 unit.
5. Verified available quantity returned to `3`.
6. Confirmed movement history contained both receive and export movements.

That confirmed the live workflow was correct without leaving demo inventory changed.

## 20. Current Status

Inventrack now has:

- React frontend deployed to Vercel.
- Node/Express backend deployed to Render.
- PostgreSQL database hosted on Neon.
- v2 API endpoints for inventory, SKUs, warehouses, locations, movements, shipments, recommendations, and writes.
- Transaction-safe manual receive/export workflows.
- Shipment creation foundations.
- PostgreSQL migrations.
- CI workflow with disposable PostgreSQL testing.
- Project progress documentation.

## 21. Remaining Future Work

The next strongest improvements are:

1. Connect receive/export transactions directly to shipment lines, so shipment progress updates automatically.
2. Add authentication and role-based access control.
3. Add company/tenant scoping to every request through auth context rather than query params/default data.
4. Add service-level unit tests around transaction helpers.
5. Add Playwright end-to-end tests for frontend workflows.
6. Improve UI polish and employer-facing README/screenshots.
7. Add audit log writes for create/update/stock movement operations.

## 22. Employer Talking Points

This project demonstrates:

- Relational schema design for a business domain.
- SQL constraints and data integrity.
- Backend API design with Express.
- PostgreSQL connection pooling and hosted database configuration.
- Transaction-safe inventory operations.
- Frontend/backend integration in React.
- Deployment across Vercel, Render, and Neon.
- CI with a disposable PostgreSQL service.
- Practical documentation and incremental delivery.
- Awareness of legacy migration strategy by keeping MongoDB routes while building `/api/v2`.

A concise interview explanation:

> I inherited or started from a small inventory prototype and redesigned it toward an enterprise-style inventory system. I modeled the domain relationally in PostgreSQL, added constraints to protect inventory correctness, built Express API endpoints for warehouse, SKU, inventory, shipment, and movement data, then wired a React frontend to those APIs. The most important part was implementing transaction-safe receive and export workflows so stock changes update inventory lots and movement history atomically. I deployed the frontend to Vercel, backend to Render, database to Neon, added migrations and GitHub Actions CI with a disposable PostgreSQL test database, and verified the live system with a receive/export smoke transaction.
