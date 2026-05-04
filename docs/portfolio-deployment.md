# Inventrack Portfolio Deployment Plan

## Recommended portfolio architecture

Inventrack should be presented as a real database-backed business application, not only as a static frontend demo.

Recommended hosting:

```text
Frontend: Vercel
Backend API: Render or Railway
Database: Neon Postgres
Source control / CI: GitHub + GitHub Actions
```

This gives the strongest resume story:

> Built and deployed an enterprise-style inventory tracking system using React, Node.js, PostgreSQL, relational schema design, inventory movement ledgers, CI/CD, and cloud deployment.

## Important current-state note

The current prototype backend still uses MongoDB/Mongoose. The enterprise redesign documentation and PostgreSQL practice dataset are now in the repo, but the production backend API has not yet been migrated to PostgreSQL.

That means deployment should happen in two stages:

1. Deploy the current app so the portfolio has a live demo.
2. Migrate the backend API from MongoDB to PostgreSQL/Neon using the enterprise redesign docs.

## Stage 1 — Deploy current app

### Frontend on Vercel

1. Go to Vercel.
2. Import GitHub repo:
   `josh-tjiauw/inventrack`
3. Framework preset:
   `Create React App`
4. Build command:
   `npm run build`
5. Output directory:
   `build`
6. Environment variable:

```text
REACT_APP_API_BASE_URL=https://inventrack-api.onrender.com
```

Replace the URL with the actual Render/Railway backend URL after backend deploy.

### Backend on Render

Use `render.yaml` or create a web service manually.

Manual settings:

```text
Root Directory: backend
Runtime: Node
Build Command: npm install
Start Command: npm start
Health Check Path: /api/health
```

Environment variables:

```text
NODE_ENV=production
PORT=5000
MONGODB_URI=<current MongoDB Atlas connection string>
CORS_ORIGIN=<Vercel frontend URL>
OPENAI_API_KEY=<optional, only for AI recommendations>
```

### Current database

For the current prototype, use MongoDB Atlas because the backend still depends on Mongoose.

This is temporary. The target portfolio architecture should move to Neon Postgres.

## Stage 2 — Migrate to PostgreSQL

Target database:

```text
Neon Postgres
```

Future backend environment variable:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/inventrack?sslmode=require
```

Migration work should follow:

- `docs/architecture-enterprise-redesign.md`
- `database/postgresql-practice/inventrack_enterprise_schema_seed.sql`
- `database/postgresql-practice/reporting-views.sql`
- `database/postgresql-practice/transaction-practice.sql`

Recommended migration order:

1. Add PostgreSQL client/ORM.
2. Add migration tooling.
3. Convert schema into real migrations.
4. Build PostgreSQL-backed read APIs for warehouses, locations, SKUs, and inventory.
5. Build stock movement ledger APIs.
6. Replace Mongo routes one feature at a time.
7. Update frontend API calls only if response shapes change.
8. Add integration tests using a test PostgreSQL database.

## Vercel environment variables

Use:

```text
REACT_APP_API_BASE_URL=https://your-backend-host.example.com
```

Because this is a Create React App frontend, environment variables must start with `REACT_APP_`.

## Backend CORS

Set backend `CORS_ORIGIN` to the exact frontend URL.

Example:

```text
CORS_ORIGIN=https://inventrack.vercel.app
```

If using Vercel preview deployments, you may later want a safer multi-origin CORS configuration.

## Deployment verification checklist

After deployment:

1. Open frontend URL.
2. Confirm dashboard loads.
3. Hit backend health endpoint:

```text
https://your-backend-url/api/health
```

4. Confirm browser DevTools has no CORS errors.
5. Receive one shipment.
6. Export one shipment.
7. Refresh page and confirm data persists.
8. Add final deployed links to `README.md`.

## Resume/README phrasing

Suggested resume bullet after PostgreSQL migration is complete:

> Designed and deployed an enterprise-style inventory tracking system with React, Node.js, PostgreSQL, relational schema design, stock movement ledger modeling, CI/CD, and cloud deployment using Vercel, Render, and Neon.

Before PostgreSQL migration is complete:

> Built and deployed an inventory tracking prototype with React and Node.js, then designed a PostgreSQL enterprise redesign with relational schema, reporting views, transaction examples, and migration plan.
