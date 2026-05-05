# Inventrack PostgreSQL Migrations

Apply in numeric order for a new PostgreSQL database:

```powershell
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/001_enterprise_schema.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/002_reporting_views.sql
# Optional demo/test data only:
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f database/migrations/003_demo_seed.sql
```

Notes:

- `001_enterprise_schema.sql` creates the core relational tables, constraints, and indexes.
- `002_reporting_views.sql` creates dashboard/read-model views used by `/api/v2` endpoints.
- `003_demo_seed.sql` loads portfolio/demo data and resets sequences; keep it out of real production tenant data.
