# Deployment Smoke Checklist

Use this after each Vercel/Render/Neon deployment or after pushing changes to `main`.

## Required environment

### Frontend: Vercel

- Production URL: `https://inventrack.vercel.app` or the active Vercel deployment URL.
- `REACT_APP_API_BASE_URL` should point to the Render backend when the default hard-coded production API URL is not the intended target.

### Backend: Render or Railway

- Production API URL: `https://inventrack-api-v2l8.onrender.com` unless a replacement backend is deployed.
- Required variables:
  - `NODE_ENV=production`
  - `DATABASE_URL=postgresql://...` or `POSTGRES_URL=postgresql://...`
  - `CORS_ORIGIN=https://inventrack.vercel.app` or the active frontend origin
- Optional variables:
  - `MONGODB_URI` for legacy `/api/shelves` and `/api/shipments` compatibility during migration
  - `OPENAI_API_KEY` for the AI recommendation route
  - `DEMO_AUTH_STRICT=true`, `DEMO_AUTH_TOKEN`, and `DEMO_COMPANY_ID` for stricter portfolio demo auth guardrails

### Database: Neon PostgreSQL

- Migrations in `database/migrations/` should be applied in order.
- Demo seed data from `003_demo_seed.sql` is recommended for portfolio walkthroughs.

## Automated smoke check

From the repo root:

```bash
npm run smoke:deployment
```

Override URLs when testing preview deployments:

```bash
FRONTEND_URL=https://your-preview.vercel.app \
API_BASE_URL=https://your-api.onrender.com \
npm run smoke:deployment
```

On PowerShell:

```powershell
$env:FRONTEND_URL='https://your-preview.vercel.app'
$env:API_BASE_URL='https://your-api.onrender.com'
npm run smoke:deployment
```

The script exits non-zero if any required check fails. It validates:

- `/api/v2/health`
- Dashboard route `/`
- Shipment Board route `/shipments`
- Receive workflow route `/receive`
- Export workflow route `/export`
- Movement History route `/movements`
- Read-model API endpoints for shipments, inventory, and stock movements

## Manual portfolio smoke walkthrough

1. Open the frontend dashboard.
   - Confirm KPI cards load without API error banners.
   - Confirm the Storage Recommendations panel renders.
2. Open System Status at `/status`.
   - Confirm the configured API base URL is the intended backend.
   - Confirm PostgreSQL health is connected when `DATABASE_URL` is configured.
3. Open Shipment Board at `/shipments`.
   - Confirm inbound and outbound shipments load.
   - Expand a shipment and confirm line progress is visible.
4. Open Receive at `/receive`.
   - Select an open inbound shipment line.
   - Confirm SKU, quantity, destination location choices, and remaining quantity are sensible.
   - Commit a small receive only when using disposable/demo data.
5. Open Export at `/export`.
   - Select an open outbound shipment line.
   - Confirm FEFO pick plan, shortage calculation, and remaining quantity are sensible.
   - Commit a small export only when using disposable/demo data.
6. Open Movement History at `/movements`.
   - Confirm recent receive/export/move/reserve/release rows appear with request IDs and references.
7. If strict demo auth is enabled, repeat one write attempt with a viewer token/role and confirm it is rejected.

## Known deployment caveats

- Render free instances can cold-start; the first smoke check may fail or take longer while the service wakes up. Re-run once after the backend is warm before treating it as a deployment failure.
- Vercel preview URLs require `CORS_ORIGIN` on the backend to include that preview origin or use a backend CORS setting that intentionally permits previews.
- Local or CI smoke checks that use production URLs depend on external network availability.
- The automated smoke script checks route availability and read-model health; it intentionally does not mutate production/demo inventory data.
