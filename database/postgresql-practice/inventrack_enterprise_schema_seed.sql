-- Inventrack Enterprise PostgreSQL Practice Dataset
-- Purpose: practice relational database design, joins, constraints, transactions, and reporting.
-- Safe to rerun: drops and recreates the practice tables.

BEGIN;

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS shipment_lines CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS inventory_lots CASCADE;
DROP TABLE IF EXISTS skus CASCADE;
DROP TABLE IF EXISTS storage_locations CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

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

-- =========================
-- Sample data
-- =========================

INSERT INTO companies (id, name, plan) VALUES
    (1, 'Acme Distribution Co.', 'enterprise'),
    (2, 'Northwind Retail Supply', 'business');

INSERT INTO users (id, company_id, name, email, role) VALUES
    (1, 1, 'Maya Chen', 'maya.chen@acme.example', 'owner'),
    (2, 1, 'Luis Ramirez', 'luis.ramirez@acme.example', 'warehouse_manager'),
    (3, 1, 'Priya Patel', 'priya.patel@acme.example', 'inventory_clerk'),
    (4, 1, 'Owen Brooks', 'owen.brooks@acme.example', 'viewer'),
    (5, 2, 'Sarah Lee', 'sarah.lee@northwind.example', 'admin');

INSERT INTO warehouses (id, company_id, name, address, status) VALUES
    (1, 1, 'Orange County Fulfillment Center', '100 Harbor Blvd, Anaheim, CA', 'active'),
    (2, 1, 'Los Angeles Overflow Warehouse', '900 Alameda St, Los Angeles, CA', 'active'),
    (3, 2, 'Seattle Retail Warehouse', '500 Pike St, Seattle, WA', 'active');

INSERT INTO storage_locations (id, warehouse_id, code, name, type, capacity_units, status) VALUES
    (1, 1, 'A-01-BIN-01', 'Aisle A Bin 01', 'bin', 100, 'active'),
    (2, 1, 'A-01-BIN-02', 'Aisle A Bin 02', 'bin', 100, 'active'),
    (3, 1, 'B-02-RACK-01', 'Aisle B Rack 01', 'rack', 250, 'active'),
    (4, 1, 'COLD-01', 'Cold Storage 01', 'cold_storage', 80, 'active'),
    (5, 1, 'STAGE-IN-01', 'Inbound Staging Area', 'staging', 500, 'active'),
    (6, 2, 'OVF-01', 'Overflow Rack 01', 'overflow', 300, 'active'),
    (7, 2, 'OVF-02', 'Overflow Rack 02', 'overflow', 300, 'maintenance'),
    (8, 3, 'SEA-A-01', 'Seattle Aisle A Shelf 01', 'shelf', 150, 'active');

INSERT INTO skus (id, company_id, sku, name, category, description, unit_of_measure, reorder_point) VALUES
    (1, 1, 'ELEC-MON-27-4K', '27-inch 4K Monitor', 'Electronics', 'USB-C 27-inch 4K office monitor', 'each', 20),
    (2, 1, 'ELEC-KBD-MECH', 'Mechanical Keyboard', 'Electronics', 'Hot-swappable mechanical keyboard', 'each', 30),
    (3, 1, 'OFF-CHAIR-ERG', 'Ergonomic Office Chair', 'Furniture', 'Adjustable ergonomic office chair', 'each', 10),
    (4, 1, 'APP-TSHIRT-BLK-M', 'Black Company T-Shirt - Medium', 'Apparel', 'Medium black branded T-shirt', 'each', 50),
    (5, 1, 'FOOD-SNACK-BAR', 'Protein Snack Bar', 'Food', 'Boxed protein snack bar', 'box', 25),
    (6, 1, 'TOOL-SCAN-HAND', 'Handheld Barcode Scanner', 'Tools', 'USB handheld scanner', 'each', 5),
    (7, 2, 'NW-LAMP-DESK', 'LED Desk Lamp', 'Home Goods', 'Adjustable LED desk lamp', 'each', 15);

INSERT INTO inventory_lots (id, sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved, expiration_date) VALUES
    (1, 1, 1, 'MON-2026-01', 42, 5, NULL),
    (2, 1, 6, 'MON-2026-02', 120, 0, NULL),
    (3, 2, 2, 'KBD-2026-01', 76, 12, NULL),
    (4, 3, 3, 'CHAIR-2026-01', 18, 0, NULL),
    (5, 4, 3, 'TSHIRT-2026-MAY', 175, 20, NULL),
    (6, 5, 4, 'SNACK-EXP-2026-09', 34, 0, '2026-09-30'),
    (7, 6, 1, 'SCAN-2026-01', 4, 1, NULL),
    (8, 7, 8, 'LAMP-2026-01', 65, 4, NULL);

INSERT INTO shipments (id, company_id, shipment_number, shipment_type, status, supplier_or_customer, expected_date, completed_at, created_by_user_id) VALUES
    (1, 1, 'IN-2026-0001', 'inbound', 'completed', 'Pacific Tech Imports', '2026-05-01', '2026-05-01 14:30:00-07', 2),
    (2, 1, 'OUT-2026-0001', 'outbound', 'completed', 'Orange County Office Group', '2026-05-03', '2026-05-03 10:15:00-07', 3),
    (3, 1, 'IN-2026-0002', 'inbound', 'scheduled', 'ErgoWorks Manufacturing', '2026-05-09', NULL, 2),
    (4, 1, 'OUT-2026-0002', 'outbound', 'draft', 'LA Startup Hub', '2026-05-10', NULL, 3),
    (5, 2, 'NW-IN-2026-0001', 'inbound', 'completed', 'HomeLite Wholesale', '2026-05-02', '2026-05-02 16:00:00-07', 5);

INSERT INTO shipment_lines (id, shipment_id, sku_id, quantity, received_quantity, exported_quantity) VALUES
    (1, 1, 1, 50, 50, 0),
    (2, 1, 2, 80, 80, 0),
    (3, 2, 1, 8, 0, 8),
    (4, 2, 2, 12, 0, 12),
    (5, 3, 3, 40, 0, 0),
    (6, 3, 6, 10, 0, 0),
    (7, 4, 4, 30, 0, 0),
    (8, 5, 7, 65, 65, 0);

INSERT INTO stock_movements (
    id, company_id, sku_id, from_location_id, to_location_id, quantity,
    movement_type, reference_type, reference_id, performed_by_user_id, notes, created_at
) VALUES
    (1, 1, 1, NULL, 5, 50, 'receive', 'shipment', 1, 2, 'Received monitors into staging', '2026-05-01 09:00:00-07'),
    (2, 1, 1, 5, 1, 42, 'move', 'shipment', 1, 2, 'Moved monitors from staging to A-01-BIN-01', '2026-05-01 11:00:00-07'),
    (3, 1, 1, 5, 6, 8, 'move', 'shipment', 1, 2, 'Moved overflow monitors to LA warehouse', '2026-05-01 12:15:00-07'),
    (4, 1, 2, NULL, 2, 80, 'receive', 'shipment', 1, 2, 'Received keyboards', '2026-05-01 13:00:00-07'),
    (5, 1, 1, 1, NULL, 8, 'export', 'shipment', 2, 3, 'Exported monitors to customer', '2026-05-03 10:00:00-07'),
    (6, 1, 2, 2, NULL, 12, 'export', 'shipment', 2, 3, 'Exported keyboards to customer', '2026-05-03 10:05:00-07'),
    (7, 1, 6, 1, NULL, 1, 'reserve', 'order', 9001, 3, 'Reserved scanner for pending order', '2026-05-04 08:30:00-07'),
    (8, 1, 5, NULL, 4, 34, 'receive', 'manual_adjustment', 1001, 2, 'Loaded cold storage snack bars', '2026-05-04 09:00:00-07'),
    (9, 2, 7, NULL, 8, 65, 'receive', 'shipment', 5, 5, 'Received desk lamps in Seattle', '2026-05-02 16:00:00-07');

INSERT INTO audit_logs (company_id, actor_user_id, action, entity_type, entity_id, before_json, after_json, created_at) VALUES
    (1, 2, 'CREATE_WAREHOUSE', 'warehouse', 1, NULL, '{"name":"Orange County Fulfillment Center"}', '2026-04-25 10:00:00-07'),
    (1, 2, 'CREATE_LOCATION', 'storage_location', 1, NULL, '{"code":"A-01-BIN-01","capacity_units":100}', '2026-04-25 10:15:00-07'),
    (1, 3, 'EXPORT_SHIPMENT_COMPLETED', 'shipment', 2, '{"status":"in_progress"}', '{"status":"completed"}', '2026-05-03 10:15:00-07'),
    (1, 3, 'RESERVE_STOCK', 'inventory_lot', 7, '{"quantity_reserved":0}', '{"quantity_reserved":1}', '2026-05-04 08:30:00-07'),
    (2, 5, 'RECEIVE_SHIPMENT_COMPLETED', 'shipment', 5, '{"status":"in_progress"}', '{"status":"completed"}', '2026-05-02 16:00:00-07');

-- Reset sequences so future inserts continue correctly.
SELECT setval('companies_id_seq', (SELECT MAX(id) FROM companies));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('warehouses_id_seq', (SELECT MAX(id) FROM warehouses));
SELECT setval('storage_locations_id_seq', (SELECT MAX(id) FROM storage_locations));
SELECT setval('skus_id_seq', (SELECT MAX(id) FROM skus));
SELECT setval('inventory_lots_id_seq', (SELECT MAX(id) FROM inventory_lots));
SELECT setval('shipments_id_seq', (SELECT MAX(id) FROM shipments));
SELECT setval('shipment_lines_id_seq', (SELECT MAX(id) FROM shipment_lines));
SELECT setval('stock_movements_id_seq', (SELECT MAX(id) FROM stock_movements));
SELECT setval('audit_logs_id_seq', (SELECT MAX(id) FROM audit_logs));

COMMIT;

-- =========================
-- Practice queries
-- =========================

-- 1. Current stock by SKU and location
SELECT
    c.name AS company,
    w.name AS warehouse,
    sl.code AS location_code,
    s.sku,
    s.name AS item_name,
    il.lot_number,
    il.quantity_on_hand,
    il.quantity_reserved,
    il.quantity_on_hand - il.quantity_reserved AS quantity_available
FROM inventory_lots il
JOIN skus s ON s.id = il.sku_id
JOIN storage_locations sl ON sl.id = il.location_id
JOIN warehouses w ON w.id = sl.warehouse_id
JOIN companies c ON c.id = s.company_id
ORDER BY c.name, w.name, sl.code, s.sku;

-- 2. Low stock report
SELECT
    c.name AS company,
    s.sku,
    s.name,
    s.reorder_point,
    SUM(il.quantity_on_hand - il.quantity_reserved) AS available_quantity
FROM skus s
JOIN companies c ON c.id = s.company_id
LEFT JOIN inventory_lots il ON il.sku_id = s.id
GROUP BY c.name, s.id, s.sku, s.name, s.reorder_point
HAVING SUM(COALESCE(il.quantity_on_hand - il.quantity_reserved, 0)) <= s.reorder_point
ORDER BY available_quantity ASC;

-- 3. Stock movement history for one SKU
SELECT
    sm.created_at,
    s.sku,
    s.name,
    sm.movement_type,
    from_loc.code AS from_location,
    to_loc.code AS to_location,
    sm.quantity,
    u.name AS performed_by,
    sm.notes
FROM stock_movements sm
JOIN skus s ON s.id = sm.sku_id
LEFT JOIN storage_locations from_loc ON from_loc.id = sm.from_location_id
LEFT JOIN storage_locations to_loc ON to_loc.id = sm.to_location_id
LEFT JOIN users u ON u.id = sm.performed_by_user_id
WHERE s.sku = 'ELEC-MON-27-4K'
ORDER BY sm.created_at DESC;

-- 4. Shipment detail with lines
SELECT
    sh.shipment_number,
    sh.shipment_type,
    sh.status,
    sh.supplier_or_customer,
    s.sku,
    s.name,
    line.quantity,
    line.received_quantity,
    line.exported_quantity
FROM shipments sh
JOIN shipment_lines line ON line.shipment_id = sh.id
JOIN skus s ON s.id = line.sku_id
ORDER BY sh.shipment_number, s.sku;

-- 5. Location capacity usage
SELECT
    w.name AS warehouse,
    sl.code AS location_code,
    sl.capacity_units,
    COALESCE(SUM(il.quantity_on_hand), 0) AS used_units,
    sl.capacity_units - COALESCE(SUM(il.quantity_on_hand), 0) AS remaining_units,
    ROUND((COALESCE(SUM(il.quantity_on_hand), 0)::NUMERIC / sl.capacity_units) * 100, 2) AS percent_full
FROM storage_locations sl
JOIN warehouses w ON w.id = sl.warehouse_id
LEFT JOIN inventory_lots il ON il.location_id = sl.id
GROUP BY w.name, sl.id, sl.code, sl.capacity_units
ORDER BY percent_full DESC;
