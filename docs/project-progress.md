# Inventrack Project Progress

Last updated: 2026-05-05

## Current Direction

Inventrack is being rebuilt from a MongoDB prototype into a PostgreSQL-backed, enterprise-style inventory tracking system suitable for a resume portfolio project.

Target architecture:

```text
Frontend: React / Vercel
Backend: Node.js API / Render or Railway
Database: PostgreSQL / Neon
CI/CD: GitHub Actions
```

## Current Working Policy

Josh approved direct updates to `main` for Inventrack progress. Clawie should still run relevant checks before pushing.

## What Is Already Done

### Planning and design

- Enterprise architecture document created:
  - `docs/architecture-enterprise-redesign.md`
- Enterprise API contract draft added:
  - `docs/enterprise-api-contract.md`
- PostgreSQL relationship map added:
  - `docs/postgresql-relationship-map.md`
- Portfolio deployment plan added:
  - `docs/portfolio-deployment.md`

### PostgreSQL practice foundation

- PostgreSQL schema and seed data added:
  - `database/postgresql-practice/inventrack_enterprise_schema_seed.sql`
- Production-style PostgreSQL migrations added:
  - `database/migrations/001_enterprise_schema.sql`
  - `database/migrations/002_reporting_views.sql`
  - `database/migrations/003_demo_seed.sql`
  - `database/migrations/README.md`
- Transaction practice added:
  - `database/postgresql-practice/transaction-practice.sql`
- Reporting views added:
  - `database/postgresql-practice/reporting-views.sql`
- Validation checks added:
  - `database/postgresql-practice/validation-checks.sql`
- API read-model query examples added:
  - `database/postgresql-practice/api-read-model-queries.sql`
- Local validation script added:
  - `database/postgresql-practice/validate-local-postgres.ps1`

### Backend implementation

- PostgreSQL client dependency added:
  - `pg`
- PostgreSQL connection pool added:
  - `backend/db/postgres.js`
- New PostgreSQL-backed API route group added:
  - `backend/routes/v2.js`
- New v2 endpoints:
  - `GET /api/v2/health`
  - `GET /api/v2/warehouses`
  - `GET /api/v2/storage-locations`
  - `GET /api/v2/skus`
  - `GET /api/v2/inventory`
  - `GET /api/v2/stock-movements`
  - `GET /api/v2/shipments`
  - `GET /api/v2/storage-recommendations`
  - `POST /api/v2/receive-stock`
  - `POST /api/v2/export-stock`
- PostgreSQL v2 integration tests added:
  - `backend/__tests__/postgres-v2.test.js`
- Backend PostgreSQL test script added:
  - `npm run test:postgres` from `backend/` runs the v2 test file directly and is wired into CI with a disposable PostgreSQL service.
- PostgreSQL v2 transaction tests now cover manual receive/export success paths and insufficient-capacity/insufficient-stock conflict paths against disposable CI data.

### Frontend implementation

- Dashboard consumes live PostgreSQL v2 read endpoints for warehouse capacity, SKUs, inventory lots, and movement history.
- Dashboard now shows a rule-based Storage Recommendations panel fed by `/api/v2/storage-recommendations`.
- Low-stock dashboard alert now uses the v2 SKU `total_available` field instead of the legacy inventory field name.
- New `/warehouses` Warehouse Location Map page added. It uses `/api/v2/storage-locations`, supports warehouse/status filters, and shows location capacity, current stock, available stock, SKU count, and maintenance status.
- New `/inventory` Inventory Explorer page added. It uses `/api/v2/inventory`, supports warehouse/SKU/low-stock filters, and shows lot-level on-hand/reserved/available quantities with expiration and status.
- New `/skus` SKU Catalog page added. It uses `/api/v2/skus`, supports category and low-stock filters, and shows on-hand/reserved/available/reorder status.
- New `/shipments` Shipment Board page added. It uses `/api/v2/shipments`, supports type/status filters, and expands shipment line receive/export progress.
- New `/movements` Stock Movement History page added. It uses `/api/v2/stock-movements`, supports movement type/SKU/limit filters, and shows audit ledger rows with from/to locations, user, and reference metadata.
- New `/status` System Status page added. It shows the configured API base URL, backend mode, PostgreSQL health, v2 table counts, and smoke-check results for the main v2 read endpoints.
- `/receive` has been converted from the legacy MongoDB shelf/AI flow into a PostgreSQL v2 Receive Shipment workflow. It reads `/api/v2/skus`, `/api/v2/storage-locations`, and `/api/v2/storage-recommendations`, ranks active locations by available capacity/projected utilization, and can now commit receipts through transactional `POST /api/v2/receive-stock`.
- `/export` has been converted from the legacy MongoDB shelf flow into a PostgreSQL v2 Export Shipment workflow. It reads `/api/v2/inventory` and `/api/v2/skus`, generates a FEFO-style pick plan from available lots, shows requested/planned/shortage totals, and can now commit exports through transactional `POST /api/v2/export-stock`.

### Deployment prep

- GitHub Actions CI added:
  - `.github/workflows/ci.yml`
  - Builds the React frontend.
  - Loads PostgreSQL migrations plus optional demo seed data into a disposable PostgreSQL service.
  - Runs the PostgreSQL v2 backend test suite.
- Vercel config added:
  - `vercel.json`
- Render blueprint added:
  - `render.yaml`
- Heroku/Procfile backend start command fixed:
  - `Procfile`
- Root Heroku postbuild now installs backend dependencies:
  - `package.json`
- Health check now validates PostgreSQL when `DATABASE_URL` is configured:
  - `backend/server.js`
- Frontend production env example added:
  - `.env.production.example`
- Backend production env example added:
  - `backend/.env.production.example`

## Current Status

The backend is deployed on Render and connected to Neon PostgreSQL. The frontend dashboard, Warehouse Location Map, Inventory Explorer, SKU Catalog page, Shipment Board page, Stock Movement History page, Receive Shipment workflow, Export Shipment workflow, and System Status page consume PostgreSQL `/api/v2` endpoints for warehouses, storage locations, SKUs, inventory, shipments, stock movements, health, rule-based storage recommendations, and transaction-safe manual receive/export writes.

The project has started the real PostgreSQL migration.

The old MongoDB routes still exist for compatibility:

```text
/api/shelves
/api/shipments
```

The new PostgreSQL implementation starts at:

```text
/api/v2/*
```

## Next Best Work Items

1. Add more write endpoints for the relational model:
   - create warehouse
   - create storage location
   - create SKU
   - shipment creation and line assignment
2. Extract transaction-safe receive/export logic into dedicated service functions for easier unit-level testing and reuse by shipment-backed workflows.
3. Add shipment-backed receive/export workflows that update shipment line progress.
4. Expand the relational model write surface after service extraction.
5. Keep Vercel/Render/Neon deployment checks documented and reproducible.

## How Josh Can See Progress

### GitHub commits

Repo commits:

```text
https://github.com/josh-tjiauw/inventrack/commits/main
```

### GitHub project files

Key files to inspect:

```text
docs/project-progress.md
docs/architecture-enterprise-redesign.md
docs/postgres-v2-api.md
database/postgresql-practice/
database/migrations/
backend/routes/v2.js
backend/__tests__/postgres-v2.test.js
```

### Local command

From the Inventrack repo:

```powershell
git log --oneline -10
```

### API progress

Once backend is running with `DATABASE_URL`, test:

```text
/api/v2/health
/api/v2/warehouses
/api/v2/storage-locations
/api/v2/skus
/api/v2/inventory
/api/v2/shipments
/api/v2/stock-movements
/api/v2/storage-recommendations
POST /api/v2/receive-stock
POST /api/v2/export-stock
```
