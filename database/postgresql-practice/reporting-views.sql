-- Inventrack Enterprise PostgreSQL Reporting Views
-- Purpose: reusable read models for dashboards, reports, and API responses.
-- Load inventrack_enterprise_schema_seed.sql first, then run this file.
-- Safe to rerun: CREATE OR REPLACE VIEW refreshes the view definitions.

BEGIN;

-- =========================
-- Current inventory by lot/location
-- =========================
-- One row per inventory lot, enriched with tenant, warehouse, location, and SKU context.

CREATE OR REPLACE VIEW v_current_inventory_by_location AS
SELECT
    c.id AS company_id,
    c.name AS company_name,
    w.id AS warehouse_id,
    w.name AS warehouse_name,
    sl.id AS location_id,
    sl.code AS location_code,
    sl.name AS location_name,
    sl.type AS location_type,
    s.id AS sku_id,
    s.sku,
    s.name AS sku_name,
    s.category,
    il.id AS inventory_lot_id,
    il.lot_number,
    il.expiration_date,
    il.quantity_on_hand,
    il.quantity_reserved,
    il.quantity_on_hand - il.quantity_reserved AS quantity_available,
    s.reorder_point,
    il.updated_at AS inventory_updated_at
FROM inventory_lots il
JOIN skus s ON s.id = il.sku_id
JOIN storage_locations sl ON sl.id = il.location_id
JOIN warehouses w ON w.id = sl.warehouse_id
JOIN companies c ON c.id = s.company_id
WHERE w.company_id = s.company_id;

COMMENT ON VIEW v_current_inventory_by_location IS
    'Current inventory lot balances enriched with company, warehouse, location, and SKU details.';

-- =========================
-- Low-stock SKUs
-- =========================
-- One row per SKU whose total available quantity is at or below its reorder point.

CREATE OR REPLACE VIEW v_low_stock_skus AS
SELECT
    c.id AS company_id,
    c.name AS company_name,
    s.id AS sku_id,
    s.sku,
    s.name AS sku_name,
    s.category,
    s.reorder_point,
    COALESCE(SUM(il.quantity_on_hand), 0)::INTEGER AS total_on_hand,
    COALESCE(SUM(il.quantity_reserved), 0)::INTEGER AS total_reserved,
    COALESCE(SUM(il.quantity_on_hand - il.quantity_reserved), 0)::INTEGER AS total_available,
    (s.reorder_point - COALESCE(SUM(il.quantity_on_hand - il.quantity_reserved), 0))::INTEGER AS reorder_gap
FROM skus s
JOIN companies c ON c.id = s.company_id
LEFT JOIN inventory_lots il ON il.sku_id = s.id
GROUP BY
    c.id,
    c.name,
    s.id,
    s.sku,
    s.name,
    s.category,
    s.reorder_point
HAVING COALESCE(SUM(il.quantity_on_hand - il.quantity_reserved), 0) <= s.reorder_point;

COMMENT ON VIEW v_low_stock_skus IS
    'SKUs whose total available inventory is at or below the configured reorder point.';

-- =========================
-- Warehouse capacity summary
-- =========================
-- One row per warehouse with location capacity and current on-hand utilization.

CREATE OR REPLACE VIEW v_warehouse_capacity_summary AS
WITH location_balances AS (
    SELECT
        sl.id AS location_id,
        sl.warehouse_id,
        sl.capacity_units,
        COALESCE(SUM(il.quantity_on_hand), 0)::INTEGER AS quantity_on_hand
    FROM storage_locations sl
    LEFT JOIN inventory_lots il ON il.location_id = sl.id
    GROUP BY sl.id, sl.warehouse_id, sl.capacity_units
)
SELECT
    c.id AS company_id,
    c.name AS company_name,
    w.id AS warehouse_id,
    w.name AS warehouse_name,
    w.status AS warehouse_status,
    COUNT(lb.location_id)::INTEGER AS location_count,
    SUM(lb.capacity_units)::INTEGER AS total_capacity_units,
    SUM(lb.quantity_on_hand)::INTEGER AS total_quantity_on_hand,
    ROUND(
        (SUM(lb.quantity_on_hand)::NUMERIC / NULLIF(SUM(lb.capacity_units), 0)) * 100,
        2
    ) AS percent_full
FROM warehouses w
JOIN companies c ON c.id = w.company_id
JOIN location_balances lb ON lb.warehouse_id = w.id
GROUP BY c.id, c.name, w.id, w.name, w.status;

COMMENT ON VIEW v_warehouse_capacity_summary IS
    'Warehouse-level capacity utilization based on storage location capacity and current on-hand stock.';

-- =========================
-- Stock movement history
-- =========================
-- Audit-friendly ledger report with readable source/destination locations and actor metadata.

CREATE OR REPLACE VIEW v_stock_movement_history AS
SELECT
    sm.id AS stock_movement_id,
    sm.company_id,
    c.name AS company_name,
    sm.created_at,
    sm.movement_type,
    sm.quantity,
    s.id AS sku_id,
    s.sku,
    s.name AS sku_name,
    from_wh.name AS from_warehouse_name,
    from_loc.code AS from_location_code,
    from_loc.name AS from_location_name,
    to_wh.name AS to_warehouse_name,
    to_loc.code AS to_location_code,
    to_loc.name AS to_location_name,
    sm.reference_type,
    sm.reference_id,
    u.id AS performed_by_user_id,
    u.name AS performed_by_user_name,
    u.role AS performed_by_user_role,
    sm.notes
FROM stock_movements sm
JOIN companies c ON c.id = sm.company_id
JOIN skus s ON s.id = sm.sku_id
LEFT JOIN storage_locations from_loc ON from_loc.id = sm.from_location_id
LEFT JOIN warehouses from_wh ON from_wh.id = from_loc.warehouse_id
LEFT JOIN storage_locations to_loc ON to_loc.id = sm.to_location_id
LEFT JOIN warehouses to_wh ON to_wh.id = to_loc.warehouse_id
LEFT JOIN users u ON u.id = sm.performed_by_user_id;

COMMENT ON VIEW v_stock_movement_history IS
    'Readable stock movement ledger for audit trails, operations review, and reporting APIs.';

COMMIT;

-- =========================
-- Suggested checks after loading
-- =========================

SELECT *
FROM v_current_inventory_by_location
ORDER BY company_name, warehouse_name, sku;

SELECT *
FROM v_low_stock_skus
ORDER BY reorder_gap DESC, sku;

SELECT *
FROM v_warehouse_capacity_summary
ORDER BY company_name, warehouse_name;

SELECT *
FROM v_stock_movement_history
ORDER BY created_at DESC, stock_movement_id DESC;
