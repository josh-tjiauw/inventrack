# Inventrack

[![Build](https://github.com/josh-tjiauw/inventrack/actions/workflows/ci.yml/badge.svg)](https://github.com/josh-tjiauw/inventrack/actions/workflows/ci.yml)

A PostgreSQL-backed, enterprise-style inventory tracking system built for reliability, scalability, and auditability. This project demonstrates SQL schema design, transaction-safe stock movements, Express API design, React frontend/backend integration, CI, and deployment across Vercel, Render, and Neon.

## 🏗️ Architecture

```
React Frontend (Vercel)
    |
    | HTTPS / JSON API
    v
Node.js API (Render)
    |
    | ORM / SQL queries
    v
PostgreSQL (Neon)
    |
    +-- Reporting Views / Transactions / Audit
```

- **Frontend**: React + React Router
- **Backend**: Node.js with Express
- **Database**: PostgreSQL (Neon)
- **CI**: GitHub Actions with disposable PostgreSQL tests
- **Live Demo**: [https://inventrack-cyan.vercel.app](https://inventrack-cyan.vercel.app)

## 🎯 Problem Statement

Inventory management systems need strict data integrity to prevent errors like negative stock, duplicate ambiguous records, or untraceable inventory edits. Legacy prototypes often store data as loosely shaped JSON or rely on fragile AI logic that’s hard to explain, test, or maintain. This project solves those problems by using a relational PostgreSQL model with constraints, transaction-safe operations, and deterministic rule-based decision making instead of a paid AI API dependency.

## ✅ Solution

- **Relational model**: Companies, users, warehouses, storage locations, SKUs, inventory lots, shipments, shipment lines, and stock movements.
- **Database constraints**: No negative quantities, reserved cannot exceed on-hand, shipment lines cannot over-receive/over-export, capacity checks, and unique constraints for data integrity.
- **Transaction-safe workflows**: Receive stock upserts inventory lots and writes a movement ledger; export stock uses FEFO (First Expired, First Out) picking, locks available lots, prevents insufficient-stock exports, and rolls back on failure.
- **Deterministic recommendations**: Rule-based capacity, reorder, and expiration alerts replace expensive/unexplainable AI flows.
- **Deployed and tested**: Frontend on Vercel, backend on Render, PostgreSQL on Neon, CI with disposable database and targeted integration tests.

## 🎨 Features

- 📊 Real-time inventory dashboard
- 📦 Shipment receiving with capacity validation
- 🚚 Export/shipping with FEFO picking (First Expired, First Out)
- 🧠 Rule-based storage recommendations (capacity, reorder, expiration)
- 📈 Warehouse location capacity visualization
- 🔔 Low stock alerts and reorder suggestions
- 📱 Responsive React frontend
- 🔄 Audit trail through stock movement ledger
- ✅ Transaction-safe stock changes
- 🧪 CI with disposable PostgreSQL tests
- 🏗️ Enterprise-style schema and API
- 📂 Live Vercel + Render deployment

## 💻 Local Development

### Prerequisites

- Node.js v16+ and npm v8+
- PostgreSQL client (`psql` or `pg_dump`)
- `.env` files under `backend/` and root

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/josh-tjiauw/inventrack.git
   cd inventrack
   ```

2. **Configure environment**
   Create `.env` files:

   **Root `.env`** (Frontend):
   ```text
   REACT_APP_API_BASE_URL=https://inventrack-api-v2l8.onrender.com
   ```

   **`backend/.env`** (Backend):
   ```text
   DATABASE_URL=your_postgres_connection_string
   PORT=5000
   ```

   Example PostgreSQL connection string (replace with your own):
   ```text
   DATABASE_URL=postgresql://user:password@host:5432/inventrack?sslmode=require
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Start the backend**
   ```bash
   cd backend
   node server.js
   ```

5. **Start the frontend**
   ```bash
   # In a new terminal
   npm start
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Deployment

```bash
# Frontend production build
npm run build

# Backend production start
# Requires RENDER_SERVICE_NAME or PORT set in Render
node server.js
```

### Tests

Run backend PostgreSQL v2 tests (requires `DATABASE_URL`):

```bash
cd backend
npm test -- --testPathPattern=postgres-v2
```

## 📚 API Endpoints

### Read API (v2)

| Endpoint | Method | Description |
|--------|--------|------|
| `/api/v2/health` | GET | PostgreSQL health and table counts |
| `/api/v2/warehouses` | GET | List warehouses with capacity summary |
| `/api/v2/storage-locations` | GET | List active storage locations with inventory totals |
| `/api/v2/skus` | GET | List SKUs, optionally filter by category or low stock |
| `/api/v2/inventory` | GET | Lot-level inventory, optional filters |
| `/api/v2/stock-movements` | GET | Stock movement audit ledger |
| `/api/v2/shipments` | GET | Shipment summaries and line progress |
| `/api/v2/storage-recommendations` | GET | Rule-based recommendations for capacity/reorder/expiration |

### Write API (v2)

| Endpoint | Method | Description |
|--------|--------|------|
| `/api/v2/warehouses` | POST | Create warehouse (auth/roles TBD) |
| `/api/v2/storage-locations` | POST | Create storage location |
| `/api/v2/skus` | POST | Create SKU |
| `/api/v2/shipments` | POST | Create shipment header with line assignments |
| `/api/v2/receive-stock` | POST | Manual receive workflow with capacity validation |
| `/api/v2/export-stock` | POST | Manual export with FEFO picking |

All endpoints are served under `/api/v2/*` with a clean PostgreSQL-backed implementation.

## 📁 Project Structure

```
inventrack/
  public/                    # React entry, assets
  src/                       # React components, pages
  backend/
    db/postgres.js          # PostgreSQL client, pool, transaction helper
    routes/v2.js            # v2 API read + write routes
    services/stockTransactions.js  # Transaction service layer
    server.js               # Express app, legacy routes for compatibility
    __tests__/              # Backend tests
  database/
    migrations/              # Production-style SQL migrations
    postgresql-practice/     # Schema practice and reporting views
  docs/
    architecture-enterprise-redesign.md
    postgresql-relationship-map.md
    project-progress.md
    employer-build-explanation.md
  render.yaml                # Render deployment config
  vercel.json                # Vercel frontend config
  .github/workflows/ci.yml   # GitHub Actions CI
```

## 🔒 Security Notes

This app currently runs with legacy routes and v2 API paths. Production deployments should add:

- Authentication and role-based access control (JWT, session, or Auth.js)
- Company/tenant scoping through auth context rather than query parameters
- Rate limiting and request signing for sensitive operations

## 📝 License

This project is not yet published to npm. Feel free to contribute or use it as a portfolio example.

## 🤝 Contributions

Contributions, issues, and feature requests are welcome!

## 📧 Contact

- GitHub: [@josh-tjiauw](https://github.com/josh-tjiauw)
- Live Demo: [https://inventrack-cyan.vercel.app](https://inventrack-cyan.vercel.app)
- API Docs: See `/docs` or open the repo

---

Built with React, Node.js, PostgreSQL, Render, Vercel, and Neon.
CI via GitHub Actions.

