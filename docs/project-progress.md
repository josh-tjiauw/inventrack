# Inventrack Project Progress

Last updated: 2026-05-04

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
  - `GET /api/v2/skus`
  - `GET /api/v2/inventory`
  - `GET /api/v2/stock-movements`
- PostgreSQL v2 integration tests added:
  - `backend/__tests__/postgres-v2.test.js`

### Deployment prep

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

The backend is now deploy-ready for a PostgreSQL v2 deployment. A Neon PostgreSQL database has been seeded and validated with the enterprise schema, reporting views, and v2 API test suite.

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

1. Set the hosted backend environment variables and redeploy:
   - `DATABASE_URL`
   - `CORS_ORIGIN=https://inventrack-cyan.vercel.app`
   - `NODE_ENV=production`
2. Verify hosted endpoints:
   - `/api/health`
   - `/api/v2/health`
   - `/api/v2/warehouses`
   - `/api/v2/inventory`
3. Create real PostgreSQL migration files from the practice schema.
4. Add write endpoints for the relational model:
   - create warehouse
   - create storage location
   - create SKU
   - receive stock
   - export stock
3. Build transaction-safe receive/export service functions.
4. Update frontend screens to consume `/api/v2` read endpoints.
5. Add Postgres-backed UI pages:
   - warehouse overview
   - SKU catalog
   - inventory by location
   - stock movement history
6. Add GitHub Actions CI for:
   - frontend build
   - backend tests
   - PostgreSQL schema validation
7. Deploy frontend to Vercel, backend to Render/Railway, database to Neon.

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
/api/v2/skus
/api/v2/inventory
/api/v2/stock-movements
```
