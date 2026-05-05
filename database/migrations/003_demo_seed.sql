-- 003_demo_seed.sql
-- Inventrack optional demo data migration for portfolio/test environments.
-- Do not run against a production tenant database that already contains customer data.

BEGIN;

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