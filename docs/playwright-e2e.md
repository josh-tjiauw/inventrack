# Playwright Critical Workflow Tests

Inventrack's browser-level portfolio smoke test lives in:

```text
tests/e2e/critical-workflow.spec.js
```

## What it covers

The test runs the React app in Chromium and validates the critical demo workflow against mocked PostgreSQL v2 API responses:

1. Create an inbound shipment on the Shipment Board.
2. Receive stock against that inbound shipment line.
3. Export stock against an outbound shipment line.
4. Verify receive/export rows appear in Stock Movement History.

The API is mocked inside Playwright so the test is deterministic and can run without a local PostgreSQL database. Backend transaction behavior remains covered by `backend/__tests__/postgres-v2.test.js`.

## Run locally

From the repo root:

```powershell
npm ci
npm run test:e2e:install
npm run test:e2e
```

If Chromium is already installed for Playwright, `npm run test:e2e` is enough.

## CI

GitHub Actions runs the Playwright critical workflow in the `playwright-critical-workflow` job. The job installs Chromium, starts the React dev server through Playwright's `webServer` config, and runs:

```bash
npm run test:e2e
```

The test uses `REACT_APP_API_BASE_URL=http://localhost:5000` and intercepts `/api/v2/**` calls, so no backend service or database is required for this browser workflow check.
