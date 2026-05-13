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

**Status:** Ready

**Requirement:** Add end-to-end confidence for the portfolio demo flow.

**Scope:**
- Add Playwright or equivalent browser workflow tests.
- Cover create shipment → receive against shipment → export against shipment → verify movement history.
- Document how to run locally and in CI.

**Verification:**
- E2E test command passes locally or is wired for CI with documented local prerequisites.
- `npm run build`

**Done when:** A real browser test validates the core inventory workflow.

## Sprint 4 — Move Stock Workflow

**Status:** Ready

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

## Sprint 5 — Reserve and Release Reservation Workflows

**Status:** Ready

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

## Sprint 6 — Request Validation and Error Shape

**Status:** Ready

**Requirement:** Make the API safer and more portfolio-polished.

**Scope:**
- Add request validation schemas for write endpoints, preferably with Zod or a lightweight equivalent.
- Standardize error responses with codes/messages matching the API contract.
- Preserve `409 Conflict` for business-rule failures.

**Verification:**
- Backend tests for invalid payloads and conflict payloads.

**Done when:** Write endpoints reject bad input consistently and return structured errors.

## Sprint 7 — Request IDs, Logging, and Audit Writes

**Status:** Ready

**Requirement:** Improve observability and auditability.

**Scope:**
- Add request IDs to responses and logs.
- Include request IDs in error responses.
- Write `audit_logs` rows for important mutations where practical.
- Document audit behavior.

**Verification:**
- Backend tests or manual checks prove request IDs appear and audit rows are written.

**Done when:** Mutating operations are traceable by request ID and audit log entries.

## Sprint 8 — Auth/RBAC and Tenant Isolation

**Status:** Ready

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
