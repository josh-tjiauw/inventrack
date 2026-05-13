# Inventrack Project Progress

Last updated: 2026-05-13

## Current Direction

Inventrack is being rebuilt from a MongoDB prototype into a PostgreSQL-backed, enterprise-style inventory tracking system suitable for a resume portfolio project.

## 2026-05-13 Sprint Update

- Completed Sprint 7 — Request IDs, Logging, and Audit Writes.
- Added request context middleware that accepts caller-provided `X-Request-Id` values or generates `req_*` IDs, returns them in response headers, includes them in health/error JSON, and logs structured completion records with method, path, status, duration, and request ID.
- Added `database/migrations/004_audit_request_ids.sql` and wired CI migration loading so `audit_logs` can store indexed `request_id` values.
- Added audit writes for key PostgreSQL v2 mutations: warehouse, storage-location, SKU, shipment, receive, export, move, reserve, and release-reservation workflows.
- Documented request/audit trace behavior in `docs/postgres-v2-api.md` and updated migration docs.
- Checks: `npm run build` passed. `cd backend && npm run test:postgres` passed non-DB request ID/error-shape tests; PostgreSQL-backed audit row tests were skipped locally because neither `DATABASE_URL` nor `POSTGRES_URL` was configured in this worker environment.
- Blockers: local PostgreSQL execution was unavailable in this worker; CI/local environments with a PostgreSQL URL should execute the full audit-row suite. Sprint 8 remains next.

## 2026-05-13 Sprint Update

- Completed Sprint 6 — Request Validation and Error Shape.
- Added lightweight request body validation schemas for PostgreSQL v2 write endpoints, covering IDs, enums, non-negative integers, dates, optional strings, and shipment line arrays before database work begins.
- Standardized API error responses around `success: false`, `error.code`, `error.message`, optional validation `error.details`, and the existing top-level `message` for frontend compatibility.
- Stock transaction business-rule errors now preserve HTTP `409 Conflict` and include `BUSINESS_RULE_CONFLICT`; malformed write payloads return `VALIDATION_ERROR` with field-level details.
- Added backend tests for invalid payloads and invalid enum values without requiring PostgreSQL, plus conflict response assertions for PostgreSQL-backed business-rule checks.
- Checks: `npm run build` passed. `cd backend && npm run test:postgres` passed the non-DB validation tests; PostgreSQL-backed cases were skipped locally because neither `DATABASE_URL` nor `POSTGRES_URL` was configured in this worker environment.
- Blockers: local PostgreSQL execution was unavailable in this worker; CI/local environments with a PostgreSQL URL should execute the full suite. Sprint 7 remains next.

## 2026-05-13 Sprint Update

- Completed Sprint 5 — Reserve and Release Reservation Workflows.
- Added transaction-safe `reserveStock` and `releaseReservation` service logic plus `POST /api/v2/reserve-stock` and `POST /api/v2/release-reservation`.
- Reservation workflows lock the inventory lot with `FOR UPDATE`, enforce available/reserved quantity limits, update `quantity_reserved` without changing `quantity_on_hand`, and write `stock_movements` rows with `movement_type = 'reserve'` or `movement_type = 'release_reservation'`.
- Added PostgreSQL test coverage for reserve success, insufficient available quantity rollback, release success, and release exceeding reserved quantity rollback.
- Added documented API examples in `docs/postgres-v2-api.md` for portfolio/demo usage.
- Checks: `npm run build` passed. `cd backend && npm run test:postgres` completed with the suite syntax-loaded but skipped locally because neither `DATABASE_URL` nor `POSTGRES_URL` was configured in this worker environment.
- Blockers: local PostgreSQL execution was unavailable in this worker; CI/local environments with a PostgreSQL URL should execute the full suite. Sprint 6 remains next.

## 2026-05-13 Sprint Update

- Completed Sprint 4 — Move Stock Workflow.
- Added transaction-safe `moveStock` service logic and `POST /api/v2/move-stock` for moving inventory between locations.
- Move-stock locks the source lot with `FOR UPDATE`, enforces available quantity, validates same-company active destination locations and capacity, upserts destination lots, decrements source lots, and writes `stock_movements` rows with `movement_type = 'move'`.
- Added PostgreSQL test coverage for move success, insufficient available quantity rollback, inactive destination conflict, and over-capacity destination conflict.
- Added `/move` and a navbar entry so the frontend can select an available source lot, choose an active destination location with enough open capacity, and commit the move.
- Checks: `npm run build` passed. `cd backend && npm run test:postgres` completed with the suite syntax-loaded but skipped locally because neither `DATABASE_URL` nor `POSTGRES_URL` was configured in this worker environment.
- Blockers: local PostgreSQL execution was unavailable in this worker; CI/local environments with a PostgreSQL URL should execute the full suite. Sprint 5 remains next.

## 2026-05-13 Sprint Update

- Completed Sprint 3 — Playwright Critical Workflow Tests.
- Added Playwright Chromium E2E coverage for the portfolio-critical demo flow: create inbound shipment, receive against the created shipment line, export against an outbound shipment line, and verify receive/export movement history.
- Added deterministic `/api/v2/**` route mocks so the browser workflow check can run locally and in CI without a PostgreSQL database; backend transaction semantics remain covered by the PostgreSQL Jest suite.
- Added `playwright.config.js`, `tests/e2e/critical-workflow.spec.js`, `docs/playwright-e2e.md`, `npm run test:e2e`, `npm run test:e2e:install`, and a GitHub Actions `playwright-critical-workflow` job.
- Checks: `npm run build` passed. `npm run test:e2e` passed. `cd backend && npm run test:postgres` was skipped locally because neither `DATABASE_URL` nor `POSTGRES_URL` was configured in this worker environment.
- Blockers: none for Sprint 3; Sprint 4 remains next.

## 2026-05-13 Sprint Update

- Completed Sprint 2 — Stock Transaction Service Tests.
- Added direct `backend/services/stockTransactions.js` coverage to the PostgreSQL v2 Jest suite for over-receive, over-export, receive rollback after movement insertion failure, and export rollback after inventory lot updates.
- Existing PostgreSQL v2 tests continue to cover insufficient location capacity and insufficient available stock conflicts.
- Checks: `npm run build` passed. `cd backend && npm run test:postgres` completed with the suite syntax-loaded but skipped locally because neither `DATABASE_URL` nor `POSTGRES_URL` was configured in this worker environment.
- Blockers: local PostgreSQL execution was unavailable in this worker; CI/local environments with a PostgreSQL URL should execute the full suite.

## 2026-05-13 Sprint Update

- Completed Sprint 1 — Shipment-Line-Aware Receive/Export UI.
- `/receive` now loads open inbound shipments, supports inbound shipment-line selection, shows received/remaining/ordered line progress, pre-fills SKU/quantity from the chosen line, and sends `shipmentLineId` to `/api/v2/receive-stock` while preserving manual receive fallback.
- `/export` now loads open outbound shipments, supports outbound shipment-line selection, shows exported/remaining/ordered line progress, pre-fills SKU/quantity/destination from the chosen line, and sends `shipmentLineId` to `/api/v2/export-stock` while preserving manual export fallback.
- Checks: `npm run build` passed. Local PostgreSQL tests were skipped because neither `DATABASE_URL` nor `POSTGRES_URL` was configured in this worker environment.
- Blockers: none for Sprint 1; Sprint 2 remains next.

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
- Requirements sprint map added:
  - `docs/requirements-sprints.md`

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
- Stock transaction service layer added:
  - `backend/services/stockTransactions.js`
  - Encapsulates transaction-safe manual and shipment-backed receive/export logic used by `/api/v2/receive-stock` and `/api/v2/export-stock`.
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
  - `POST /api/v2/warehouses`
  - `POST /api/v2/storage-locations`
  - `POST /api/v2/skus`
  - `POST /api/v2/shipments`
  - `POST /api/v2/receive-stock`
  - `POST /api/v2/export-stock`
  - `POST /api/v2/move-stock`
  - `POST /api/v2/reserve-stock`
  - `POST /api/v2/release-reservation`
- PostgreSQL v2 integration tests added:
  - `backend/__tests__/postgres-v2.test.js`
- Backend PostgreSQL test script added:
  - `npm run test:postgres` from `backend/` runs the v2 test file directly and is wired into CI with a disposable PostgreSQL service.
- PostgreSQL v2 tests now cover warehouse, storage location, SKU, and shipment-with-lines create endpoints plus manual receive/export success paths, shipment-backed receive/export success paths, move/reserve/release-reservation workflows, and insufficient-capacity/insufficient-stock/reservation conflict paths against disposable CI data.

### Frontend implementation

- Dashboard consumes live PostgreSQL v2 read endpoints for warehouse capacity, SKUs, inventory lots, and movement history.
- Dashboard now shows a rule-based Storage Recommendations panel fed by `/api/v2/storage-recommendations`.
- Low-stock dashboard alert now uses the v2 SKU `total_available` field instead of the legacy inventory field name.
- New `/warehouses` Warehouse Location Map page added. It uses `/api/v2/storage-locations`, supports warehouse/status filters, and shows location capacity, current stock, available stock, SKU count, and maintenance status.
- New `/inventory` Inventory Explorer page added. It uses `/api/v2/inventory`, supports warehouse/SKU/low-stock filters, and shows lot-level on-hand/reserved/available quantities with expiration and status.
- New `/skus` SKU Catalog page added. It uses `/api/v2/skus`, supports category and low-stock filters, and shows on-hand/reserved/available/reorder status.
- New `/shipments` Shipment Board page added. It uses `/api/v2/shipments`, supports type/status filters, expands shipment line receive/export progress, and can create shipment headers with line assignments through transactional `POST /api/v2/shipments`.
- New `/movements` Stock Movement History page added. It uses `/api/v2/stock-movements`, supports movement type/SKU/limit filters, and shows audit ledger rows with from/to locations, user, and reference metadata.
- New `/status` System Status page added. It shows the configured API base URL, backend mode, PostgreSQL health, v2 table counts, and smoke-check results for the main v2 read endpoints.
- `/receive` has been converted from the legacy MongoDB shelf/AI flow into a PostgreSQL v2 Receive Shipment workflow. It reads `/api/v2/skus`, `/api/v2/storage-locations`, and `/api/v2/storage-recommendations`, ranks active locations by available capacity/projected utilization, and can now commit manual or shipment-line receipts through transactional `POST /api/v2/receive-stock`.
- `/export` has been converted from the legacy MongoDB shelf flow into a PostgreSQL v2 Export Shipment workflow. It reads `/api/v2/inventory` and `/api/v2/skus`, generates a FEFO-style pick plan from available lots, shows requested/planned/shortage totals, and can now commit manual or shipment-line exports through transactional `POST /api/v2/export-stock`.
- New `/move` Move Stock workflow added. It reads `/api/v2/inventory` and `/api/v2/storage-locations`, lets users select an available source lot and active destination location with enough open capacity, and commits transaction-safe moves through `POST /api/v2/move-stock`.
- Reservation API examples are documented in `docs/postgres-v2-api.md`; `POST /api/v2/reserve-stock` and `POST /api/v2/release-reservation` update inventory lot reservations transactionally and audit the changes in stock movements.

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

The backend is deployed on Render and connected to Neon PostgreSQL. The frontend dashboard, Warehouse Location Map, Inventory Explorer, SKU Catalog page, Shipment Board page, Stock Movement History page, Receive Shipment workflow, Export Shipment workflow, Move Stock workflow, and System Status page consume PostgreSQL `/api/v2` endpoints for warehouses, storage locations, SKUs, inventory, shipments, stock movements, health, rule-based storage recommendations, and transaction-safe manual/shipment-backed receive/export/move plus reservation writes. Mutating PostgreSQL v2 operations now include request-ID traceability and durable audit log writes.

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

Work is now organized into one-requirement-at-a-time sprint sections in:

```text
docs/requirements-sprints.md
```

Remaining sprint order:

1. Auth/RBAC and tenant isolation.
2. Deployment smoke checklist.

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
POST /api/v2/warehouses
POST /api/v2/storage-locations
POST /api/v2/skus
POST /api/v2/shipments
POST /api/v2/receive-stock
POST /api/v2/export-stock
POST /api/v2/move-stock
POST /api/v2/reserve-stock
POST /api/v2/release-reservation
```
