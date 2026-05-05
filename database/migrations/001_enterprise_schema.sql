-- 001_enterprise_schema.sql
-- Inventrack production migration: core enterprise PostgreSQL schema.
-- Derived from database/postgresql-practice/inventrack_enterprise_schema_seed.sql.
-- Intentionally excludes DROP statements and demo data so it can be used for new deploy databases.

BEGIN;

-- =========================
-- Core tenant/user tables
-- =========================

CREATE TABLE companies (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'starter',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT companies_plan_check CHECK (plan IN ('starter', 'business', 'enterprise'))
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT users_role_check CHECK (role IN ('owner', 'admin', 'warehouse_manager', 'inventory_clerk', 'viewer')),
    CONSTRAINT users_company_email_unique UNIQUE (company_id, email)
);

-- =========================
-- Warehouse/location tables
-- =========================

CREATE TABLE warehouses (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT warehouses_status_check CHECK (status IN ('active', 'inactive', 'maintenance')),
    CONSTRAINT warehouses_company_name_unique UNIQUE (company_id, name)
);

CREATE TABLE storage_locations (
    id BIGSERIAL PRIMARY KEY,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'bin',
    capacity_units INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT storage_locations_capacity_check CHECK (capacity_units > 0),
    CONSTRAINT storage_locations_type_check CHECK (type IN ('shelf', 'bin', 'rack', 'cold_storage', 'overflow', 'staging')),
    CONSTRAINT storage_locations_status_check CHECK (status IN ('active', 'inactive', 'maintenance')),
    CONSTRAINT storage_locations_warehouse_code_unique UNIQUE (warehouse_id, code)
);

-- =========================
-- Product/inventory tables
-- =========================

CREATE TABLE skus (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    unit_of_measure TEXT NOT NULL DEFAULT 'each',
    reorder_point INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT skus_reorder_point_check CHECK (reorder_point >= 0),
    CONSTRAINT skus_unit_check CHECK (unit_of_measure IN ('each', 'case', 'pallet', 'box', 'kg', 'lb')),
    CONSTRAINT skus_company_sku_unique UNIQUE (company_id, sku)
);

CREATE TABLE inventory_lots (
    id BIGSERIAL PRIMARY KEY,
    sku_id BIGINT NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    location_id BIGINT NOT NULL REFERENCES storage_locations(id) ON DELETE RESTRICT,
    lot_number TEXT,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    expiration_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT inventory_lots_quantity_on_hand_check CHECK (quantity_on_hand >= 0),
    CONSTRAINT inventory_lots_quantity_reserved_check CHECK (quantity_reserved >= 0),
    CONSTRAINT inventory_lots_reserved_not_more_than_on_hand CHECK (quantity_reserved <= quantity_on_hand),
    CONSTRAINT inventory_lots_unique UNIQUE (sku_id, location_id, lot_number)
);

-- =========================
-- Shipment tables
-- =========================

CREATE TABLE shipments (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    shipment_number TEXT NOT NULL,
    shipment_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    supplier_or_customer TEXT,
    expected_date DATE,
    completed_at TIMESTAMPTZ,
    created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT shipments_type_check CHECK (shipment_type IN ('inbound', 'outbound')),
    CONSTRAINT shipments_status_check CHECK (status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT shipments_company_number_unique UNIQUE (company_id, shipment_number)
);

CREATE TABLE shipment_lines (
    id BIGSERIAL PRIMARY KEY,
    shipment_id BIGINT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    sku_id BIGINT NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    received_quantity INTEGER NOT NULL DEFAULT 0,
    exported_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT shipment_lines_quantity_check CHECK (quantity > 0),
    CONSTRAINT shipment_lines_received_check CHECK (received_quantity >= 0),
    CONSTRAINT shipment_lines_exported_check CHECK (exported_quantity >= 0),
    CONSTRAINT shipment_lines_no_over_receive CHECK (received_quantity <= quantity),
    CONSTRAINT shipment_lines_no_over_export CHECK (exported_quantity <= quantity)
);

-- =========================
-- Movement/audit tables
-- =========================

CREATE TABLE stock_movements (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    sku_id BIGINT NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
    from_location_id BIGINT REFERENCES storage_locations(id) ON DELETE RESTRICT,
    to_location_id BIGINT REFERENCES storage_locations(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    movement_type TEXT NOT NULL,
    reference_type TEXT,
    reference_id BIGINT,
    performed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT stock_movements_quantity_check CHECK (quantity > 0),
    CONSTRAINT stock_movements_type_check CHECK (
        movement_type IN ('receive', 'move', 'adjust', 'reserve', 'release_reservation', 'export', 'return', 'cycle_count')
    ),
    CONSTRAINT stock_movements_has_location CHECK (from_location_id IS NOT NULL OR to_location_id IS NOT NULL)
);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id BIGINT,
    before_json JSONB,
    after_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- Helpful indexes
-- =========================

CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_warehouses_company_id ON warehouses(company_id);
CREATE INDEX idx_storage_locations_warehouse_id ON storage_locations(warehouse_id);
CREATE INDEX idx_skus_company_id ON skus(company_id);
CREATE INDEX idx_inventory_lots_sku_id ON inventory_lots(sku_id);
CREATE INDEX idx_inventory_lots_location_id ON inventory_lots(location_id);
CREATE INDEX idx_shipments_company_status ON shipments(company_id, status);
CREATE INDEX idx_shipment_lines_shipment_id ON shipment_lines(shipment_id);
CREATE INDEX idx_stock_movements_company_created ON stock_movements(company_id, created_at DESC);
CREATE INDEX idx_stock_movements_sku_created ON stock_movements(sku_id, created_at DESC);
CREATE INDEX idx_audit_logs_company_created ON audit_logs(company_id, created_at DESC);

COMMIT;