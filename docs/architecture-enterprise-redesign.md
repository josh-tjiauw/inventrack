# Inventrack Enterprise Redesign — Software Architecture Document

## 1. Purpose
Inventrack is an inventory tracking platform for companies that need reliable visibility into stock, warehouse locations, item movement, receiving, exporting, auditing, and reporting.

The goal of this redesign is to move Inventrack from a small MERN-style demo app into a scalable business application suitable for multi-location inventory operations.

## 2. Current App vs Enterprise Direction

### Current app style
- React frontend
- Express backend
- MongoDB/Mongoose data model
- Basic shelves, shipments, AI recommendations, and dashboard behavior
- Good for a prototype or portfolio demo

### Enterprise redesign direction
- PostgreSQL relational database
- Strong data integrity with constraints and transactions
- Clear domain model: warehouses, shelves, items, SKUs, stock movements, users, roles, audits
- API-first backend
- Authentication and authorization
- Background jobs for imports, exports, alerts, and reports
- Observability, logging, testing, CI/CD, and deployment discipline

## 3. Architecture Goals

1. Reliability
   - Prevent invalid inventory states.
   - Avoid negative stock, duplicate ambiguous records, and orphaned data.

2. Scalability
   - Support many warehouses, users, SKUs, and stock movements.
   - Handle reporting without slowing operational workflows.

3. Auditability
   - Every inventory change should be traceable.
   - Track who changed what, when, why, and from where.

4. Maintainability
   - Separate frontend, backend, database, and background processing responsibilities.
   - Use typed contracts and automated tests.

5. Security
   - Role-based access control.
   - Company/tenant isolation.
   - Safe handling of credentials and deployment secrets.

6. Portfolio value
   - Demonstrate SQL, backend design, testing, CI/CD, deployment, and enterprise thinking.

## 4. Recommended High-Level Architecture

```text
React / Next.js Frontend
        |
        | HTTPS / JSON API
        v
Node.js Backend API
        |
        | ORM / SQL queries
        v
PostgreSQL Database
        |
        +--> Background Worker Queue
        |
        +--> Reporting / Analytics Views
```

Recommended stack:
- Frontend: Next.js or React + Vite
- Backend: Node.js with Express, Fastify, or NestJS
- Database: PostgreSQL
- ORM: Prisma or Drizzle
- Auth: Auth.js, Clerk, Supabase Auth, or custom JWT/session auth
- Hosting: Vercel for frontend, Render/Fly.io/Railway for backend, Neon/Supabase for Postgres
- Testing: Jest/Vitest, Supertest, Playwright, database integration tests
- CI/CD: GitHub Actions

## 5. Core Domain Model

### Companies / Tenants
Represents an organization using Inventrack.

Fields:
- id
- name
- plan
- created_at
- updated_at

### Users
People who access the system.

Fields:
- id
- company_id
- name
- email
- role
- created_at
- updated_at

Roles:
- owner
- admin
- warehouse_manager
- inventory_clerk
- viewer

### Warehouses
Physical inventory locations.

Fields:
- id
- company_id
- name
- address
- status
- created_at
- updated_at

### Storage Locations
Specific shelf/bin/rack positions inside warehouses.

Fields:
- id
- warehouse_id
- code
- name
- type
- capacity_units
- status
- created_at
- updated_at

Examples:
- Aisle A / Rack 02 / Bin 04
- Cold Storage 1
- Overflow Shelf B

### SKUs / Products
The canonical product/item definition.

Fields:
- id
- company_id
- sku
- name
- category
- description
- unit_of_measure
- reorder_point
- created_at
- updated_at

### Inventory Lots / Stock Records
Represents quantity of a SKU in a location, optionally by lot/batch.

Fields:
- id
- sku_id
- location_id
- lot_number
- quantity_on_hand
- quantity_reserved
- expiration_date
- created_at
- updated_at

### Stock Movements
Append-only ledger of every inventory change.

Fields:
- id
- company_id
- sku_id
- from_location_id
- to_location_id
- quantity
- movement_type
- reference_type
- reference_id
- performed_by_user_id
- notes
- created_at

Movement types:
- receive
- move
- adjust
- reserve
- release_reservation
- export
- return
- cycle_count

This is one of the most important enterprise design choices: inventory should be tracked as movements, not only as mutable shelf counts.

### Shipments
Inbound or outbound shipment records.

Fields:
- id
- company_id
- shipment_type
- status
- supplier_or_customer
- expected_date
- completed_at
- created_by_user_id
- created_at
- updated_at

### Shipment Lines
Items included in a shipment.

Fields:
- id
- shipment_id
- sku_id
- quantity
- received_quantity
- exported_quantity

### Audit Log
Tracks important system actions.

Fields:
- id
- company_id
- actor_user_id
- action
- entity_type
- entity_id
- before_json
- after_json
- created_at

## 6. Backend API Modules

Recommended backend modules:

- Auth module
- Users and roles module
- Warehouses module
- Locations module
- SKUs/products module
- Inventory module
- Stock movement module
- Shipment receiving module
- Shipment export module
- Reports module
- Audit log module
- Alerts module

Example endpoints:

```text
POST   /api/auth/login
GET    /api/warehouses
POST   /api/warehouses
GET    /api/locations?warehouseId=...
POST   /api/skus
GET    /api/inventory?sku=&warehouse=&lowStock=true
POST   /api/shipments/inbound
POST   /api/shipments/:id/receive
POST   /api/shipments/outbound
POST   /api/shipments/:id/export
GET    /api/reports/low-stock
GET    /api/audit-log
```

See [`enterprise-api-contract.md`](enterprise-api-contract.md) for a transaction-oriented API contract draft that maps these modules to PostgreSQL tables, reporting views, business-rule conflicts, and stock movement ledger writes.

## 7. Key Business Rules

1. Inventory quantity cannot go below zero unless an admin performs an explicit adjustment.
2. Every stock change must create a stock movement record.
3. Shelf/location capacity must be enforced or at least warned on.
4. Duplicate item names are allowed only if SKUs uniquely distinguish them.
5. Exports must validate stock availability before committing.
6. Receiving and exporting should be transactional.
7. Users can only access data belonging to their company/tenant.
8. Destructive changes should be soft-deleted or audit logged.

## 8. Database Design Principles

Use PostgreSQL because enterprise inventory data is relational.

Important constraints:
- Unique SKU per company.
- Foreign keys between companies, warehouses, locations, SKUs, shipments, and movements.
- Check constraints for non-negative quantities.
- Indexes on company_id, sku_id, location_id, warehouse_id, created_at, and movement_type.

Example key indexes:

```sql
CREATE INDEX idx_inventory_company_sku ON inventory_lots(company_id, sku_id);
CREATE INDEX idx_stock_movements_company_created ON stock_movements(company_id, created_at DESC);
CREATE INDEX idx_locations_warehouse ON storage_locations(warehouse_id);
CREATE UNIQUE INDEX idx_skus_company_sku ON skus(company_id, sku);
```

## 9. Frontend Application Structure

Main screens:
- Dashboard
- Warehouse overview
- Location/shelf view
- SKU/product catalog
- Receive shipment
- Export shipment
- Move stock
- Low-stock alerts
- Reports
- Audit log
- Admin/users/settings

Frontend should treat the backend API as the source of truth. It should not invent business rules that are not enforced server-side.

## 10. Testing Strategy

Testing should be designed from the beginning.

Recommended layers:
- Unit tests for pure business logic.
- API integration tests using a test Postgres database.
- Database migration tests.
- Frontend component tests.
- End-to-end tests for critical flows.

Critical flows:
1. Create SKU.
2. Create warehouse and location.
3. Receive inbound shipment.
4. Move stock between locations.
5. Export outbound shipment.
6. Prevent exporting more stock than available.
7. Show low-stock alert.
8. Audit log records important changes.

## 11. Deployment Architecture

Suggested portfolio-friendly deployment:

```text
Vercel
  - Frontend

Render / Fly.io / Railway
  - Backend API
  - Background worker

Neon / Supabase
  - PostgreSQL database

GitHub Actions
  - Lint
  - Test
  - Build
  - Migration check
```

## 12. Background Jobs

Use background jobs for tasks that should not block user requests:
- CSV imports
- Large exports
- Scheduled low-stock checks
- Report generation
- Email/Discord/webhook alerts
- Data cleanup

Possible tools:
- BullMQ + Redis
- pg-boss
- Inngest
- Trigger.dev

For a smaller portfolio version, `pg-boss` is attractive because it uses PostgreSQL instead of adding Redis.

## 13. Observability

Add:
- Structured logs
- Request IDs
- Error tracking
- Deployment health endpoint
- Database query timing for slow reports

Example endpoints:
```text
GET /api/health
GET /api/ready
```

## 14. Security

Minimum enterprise security requirements:
- Authentication
- Role-based authorization
- Tenant isolation by company_id
- Input validation with Zod or similar
- Rate limiting on auth routes
- Secure secret management
- Audit logs for admin and inventory actions
- No secrets committed to GitHub

## 15. Migration Plan from Current App

Recommended phases:

### Phase 1 — Stabilize current app
- Fix Vercel deployment
- Fix current backend test setup
- Document current API and data model

### Phase 2 — Design PostgreSQL schema
- Create ERD
- Define migrations
- Choose Prisma or Drizzle

### Phase 3 — Build new backend foundation
- Auth
- Company/tenant model
- Warehouses
- Locations
- SKUs

### Phase 4 — Build inventory ledger
- Stock records
- Stock movements
- Receiving
- Exporting

### Phase 5 — Upgrade frontend
- Replace current shelf-centric UI with warehouse/SKU/location views
- Add stronger forms and validation

### Phase 6 — Add reporting and polish
- Low stock reports
- Movement history
- Audit log
- Dashboard analytics

## 16. Main Difference From Current Inventrack

The current app stores and mutates simplified shelf state. The enterprise version should be designed around a relational inventory ledger.

Current mental model:
```text
Shelf has items.
Update shelf current count.
```

Enterprise mental model:
```text
SKU exists.
Stock exists at a location.
Every change is recorded as a movement.
Reports are derived from reliable transactional data.
```

That shift is the biggest architectural difference.

## 17. Recommended MVP Scope

For a strong portfolio rebuild, do not try to build everything at once.

Enterprise-style MVP:
1. Auth and one company/tenant.
2. Warehouses and storage locations.
3. SKU catalog.
4. Receive stock.
5. Export stock.
6. Stock movement ledger.
7. Low-stock dashboard.
8. Audit log.
9. PostgreSQL schema and integration tests.
10. Vercel + hosted backend + hosted Postgres deployment.

This would be much stronger than the current app as a software engineering portfolio project.
