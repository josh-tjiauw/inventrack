# Inventrack Requirements Sprints

This document converts the enterprise redesign requirements into small implementation sprints. Work should proceed one sprint at a time. Each sprint should leave the app in a working state, run the relevant checks, update documentation, commit, and push to `main`.

## Working Rules

1. Pick the first sprint whose status is not `Done`.
2. Implement only that sprint's requirement unless a tiny prerequisite is unavoidable.
3. Run the smallest meaningful verification gate:
   - Frontend changes: `npm run build`
   - Backend/API changes: `cd backend && npm run test:postgres` when `DATABASE_URL` or CI Postgres is available; otherwise run available targeted checks and document the local blocker.
   - Full-stack/critical flows: add or update tests when practical.
4. Update this file and `docs/project-progress.md` with what changed.
5. Commit to `main` with a clear message.
6. Push to GitHub `main`.
7. If blocked, document the blocker instead of skipping ahead silently.

## Sprint 1 — Shipment-Line-Aware Receive/Export UI

**Status:** Done

**Requirement:** Close the visible gap between the frontend workflows and the shipment-backed backend transaction path.

**Scope:**
- Add shipment selection to the Receive Shipment workflow.
- Add inbound shipment-line selection to Receive and pass `shipmentLineId` into `/api/v2/receive-stock`.
- Add outbound shipment-line selection to Export and pass `shipmentLineId` into `/api/v2/export-stock`.
- Show line progress so the user can avoid over-receiving or over-exporting.
- Preserve manual receive/export fallback if useful.

**Verification:**
- `npm run build`
- Backend shipment-backed receive/export tests, if a Postgres test DB is available.

**Done when:** Receive and Export can both operate against existing shipment lines from the UI.

**Completed 2026-05-13:** `/receive` now loads open inbound shipments, lets users choose an inbound shipment line, shows received/remaining/ordered progress, pre-fills SKU/quantity from the line, and sends `shipmentLineId` to `/api/v2/receive-stock` while preserving manual receiving. `/export` now loads open outbound shipments, lets users choose an outbound shipment line, shows exported/remaining/ordered progress, pre-fills SKU/quantity/destination from the line, and sends `shipmentLineId` to `/api/v2/export-stock` while preserving manual export. Verified with `npm run build`; local PostgreSQL transaction tests were skipped because `DATABASE_URL`/`POSTGRES_URL` was not configured.

## Sprint 2 — Stock Transaction Service Tests

**Status:** Done

**Requirement:** Strengthen confidence in `backend/services/stockTransactions.js`.

**Scope:**
- Add targeted service or integration coverage for transaction-safe receive/export behavior.
- Cover over-receive, over-export, insufficient capacity, insufficient stock, and rollback behavior.
- Keep tests deterministic against disposable/demo PostgreSQL data.

**Verification:**
- `cd backend && npm run test:postgres`

**Done when:** Key stock transaction conflicts are covered by tests and pass in CI/local Postgres.

**Completed 2026-05-13:** Added direct stock transaction service coverage to the PostgreSQL v2 Jest suite for over-receive, over-export, receive rollback after movement insertion failure, and export rollback after inventory lot updates. Existing suite coverage already includes insufficient capacity and insufficient stock API conflicts. Verified `npm run build` from the repo root and `npm run test:postgres` from `backend/`; local PostgreSQL tests were syntax-loaded but skipped because `DATABASE_URL`/`POSTGRES_URL` was not configured in this worker environment.

## Sprint 3 — Playwright Critical Workflow Tests

**Status:** Done

**Requirement:** Add end-to-end confidence for the portfolio demo flow.

**Scope:**
- Add Playwright or equivalent browser workflow tests.
- Cover create shipment → receive against shipment → export against shipment → verify movement history.
- Document how to run locally and in CI.

**Verification:**
- E2E test command passes locally or is wired for CI with documented local prerequisites.
- `npm run build`

**Done when:** A real browser test validates the core inventory workflow.

**Completed 2026-05-13:** Added Playwright Chromium coverage for the portfolio-critical flow: create inbound shipment, receive against the created shipment line, export against an outbound shipment line, and verify receive/export movement history. The test uses deterministic `/api/v2/**` route mocks so it can run without a local PostgreSQL database while the backend PostgreSQL suite remains responsible for transaction behavior. Added `npm run test:e2e`, `npm run test:e2e:install`, `playwright.config.js`, `docs/playwright-e2e.md`, and a GitHub Actions `playwright-critical-workflow` job. Verified with `npm run build` and `npm run test:e2e`; local PostgreSQL tests were skipped because `DATABASE_URL`/`POSTGRES_URL` was not configured.

## Sprint 4 — Move Stock Workflow

**Status:** Done

**Requirement:** Implement the enterprise API contract's move-stock operation.

**Scope:**
- Add backend route for moving stock between locations.
- Lock source lot with `FOR UPDATE`.
- Reject insufficient available quantity.
- Validate destination location status/capacity.
- Insert `stock_movements` row with `movement_type = 'move'`.
- Add frontend screen or workflow entry point if practical.

**Verification:**
- Backend integration tests for success and conflicts.
- `npm run build` if frontend changes are included.

**Done when:** Users can move stock between locations and movement history reflects it.

**Completed 2026-05-13:** Added transaction-safe `moveStock` service logic and `POST /api/v2/move-stock`. The service locks the source inventory lot with `FOR UPDATE`, rejects insufficient available quantity, validates same-company active destination locations and capacity, upserts the destination lot, decrements the source lot, and writes a `stock_movements` audit row with `movement_type = 'move'`. Added PostgreSQL test coverage for move success, insufficient available quantity rollback, inactive destination conflict, and over-capacity destination conflict. Added a `/move` frontend workflow and navbar entry so users can select an available source lot, choose a destination with enough open capacity, and commit the move. Verified with `npm run build`; `cd backend && npm run test:postgres` syntax-loaded the suite but skipped local PostgreSQL execution because `DATABASE_URL`/`POSTGRES_URL` was not configured.

## Sprint 5 — Reserve and Release Reservation Workflows

**Status:** Done

**Requirement:** Implement reservation logic from the enterprise API contract.

**Scope:**
- Add reserve endpoint.
- Add release-reservation endpoint.
- Enforce `quantity_reserved <= quantity_on_hand`.
- Write `reserve` and `release_reservation` stock movement rows.
- Add frontend affordance or documented API examples.

**Verification:**
- Backend tests for reserve success, insufficient available quantity, release success, and release exceeding reserved quantity.

**Done when:** Reservations can be created/released transactionally and audited in movement history.

**Completed 2026-05-13:** Added transaction-safe `reserveStock` and `releaseReservation` service logic plus `POST /api/v2/reserve-stock` and `POST /api/v2/release-reservation`. Both workflows lock the inventory lot with `FOR UPDATE`, preserve `quantity_reserved <= quantity_on_hand`, update reserved quantity without changing on-hand quantity, and write audited `stock_movements` rows with `movement_type = 'reserve'` or `movement_type = 'release_reservation'`. Added PostgreSQL test coverage for reserve success, insufficient available quantity, release success, and release exceeding reserved quantity. Added documented API examples in `docs/postgres-v2-api.md`. Verified with `npm run build`; `cd backend && npm run test:postgres` syntax-loaded the suite but skipped local PostgreSQL execution because `DATABASE_URL`/`POSTGRES_URL` was not configured.

## Sprint 6 — Request Validation and Error Shape

**Status:** Done

**Requirement:** Make the API safer and more portfolio-polished.

**Scope:**
- Add request validation schemas for write endpoints, preferably with Zod or a lightweight equivalent.
- Standardize error responses with codes/messages matching the API contract.
- Preserve `409 Conflict` for business-rule failures.

**Verification:**
- Backend tests for invalid payloads and conflict payloads.

**Done when:** Write endpoints reject bad input consistently and return structured errors.

**Completed 2026-05-13:** Added lightweight request body validation schemas for PostgreSQL v2 write endpoints, including shared positive-integer, enum, non-negative integer, date, string, and shipment-line validation. Standardized API errors now include `success: false`, an `error.code`, an `error.message`, optional validation `details`, and the legacy top-level `message` for frontend compatibility. Business-rule failures from stock transaction services now return `BUSINESS_RULE_CONFLICT` while preserving HTTP `409 Conflict`. Added backend coverage for invalid payload shape and enum validation, and expanded conflict assertions. Verified with `npm run build` and `cd backend && npm run test:postgres`; local PostgreSQL-backed cases were skipped because `DATABASE_URL`/`POSTGRES_URL` was not configured, while non-DB validation tests passed.

## Sprint 7 — Request IDs, Logging, and Audit Writes

**Status:** Done

**Requirement:** Improve observability and auditability.

**Scope:**
- Add request IDs to responses and logs.
- Include request IDs in error responses.
- Write `audit_logs` rows for important mutations where practical.
- Document audit behavior.

**Verification:**
- Backend tests or manual checks prove request IDs appear and audit rows are written.

**Done when:** Mutating operations are traceable by request ID and audit log entries.

**Completed 2026-05-13:** Added request context middleware that accepts or generates `X-Request-Id`, returns it in response headers, includes it in `/api/health`, `/api/v2/health`, and structured error bodies, and logs structured request completion entries with the request ID. Added `audit_logs.request_id` migration support plus audit writes for warehouse, storage-location, SKU, shipment, receive, export, move, reserve, and release-reservation mutations. Documented request/audit behavior and added backend assertions for request ID propagation plus PostgreSQL audit row verification when a DB URL is configured. Verified with `npm run build` and `cd backend && npm run test:postgres`; local PostgreSQL-backed audit cases were skipped because `DATABASE_URL`/`POSTGRES_URL` was not configured, while non-DB request ID validation tests passed.

## Sprint 8 — Auth/RBAC and Tenant Isolation

**Status:** Done

**Requirement:** Address the enterprise security requirements.

**Scope:**
- Add a pragmatic portfolio auth/RBAC layer or documented demo-safe auth boundary.
- Enforce role checks for mutations.
- Ensure company/tenant scoping is consistently applied.
- Consider tenant-scoped route shape or middleware.

**Verification:**
- Backend tests for allowed and forbidden roles.
- Smoke tests for read/write behavior.

**Done when:** Enterprise security story is implemented or cleanly demo-scoped with guardrails.

**Completed 2026-05-13:** Added demo-scoped auth middleware for PostgreSQL v2 routes with optional strict bearer-token mode, role parsing (`viewer`, `operator`, `manager`, `admin`), mutation RBAC, and `X-Company-Id`/`DEMO_COMPANY_ID` tenant guardrails that auto-scope reads and block explicit cross-company requests. Protected all PostgreSQL v2 mutation endpoints by role and documented local demo vs strict deployment behavior in `docs/postgres-v2-api.md`. Added backend tests for forbidden viewer writes, allowed operator writes reaching validation, and tenant-scope violations. Verified with `npm run build` and `cd backend && npm run test:postgres`; local PostgreSQL-backed cases were skipped because `DATABASE_URL`/`POSTGRES_URL` was not configured, while non-DB auth/validation tests passed.

## Sprint 9 — Deployment Smoke Checklist

**Status:** Ready

**Requirement:** Keep Vercel/Render/Neon deployment checks reproducible.

**Scope:**
- Add a deployment smoke-check document/script.
- Check live `/api/v2/health`, dashboard, shipment board, receive, export, and movement history.
- Document environment variables and known deployment caveats.

**Verification:**
- Smoke checklist can be followed end-to-end.
- Any script exits non-zero on failed checks.

**Done when:** Deployment health can be verified consistently after each push.
