-- Inventrack Enterprise PostgreSQL API Read Model Queries
-- Purpose: show how normalized PostgreSQL tables can power backend API response shapes.
-- Load inventrack_enterprise_schema_seed.sql first.
-- These SELECT-only examples are safe to rerun.

-- =========================
-- GET /api/warehouses/:warehouseId/inventory
-- =========================
-- Returns current lot balances for one tenant-scoped warehouse inventory screen.
-- Application code should bind company_id and warehouse_id from auth/context + route params.

WITH request_params AS (
    SELECT
        1::BIGINT AS company_id,
        1::BIGINT AS warehouse_id
)
SELECT
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
    il.quantity_on_hand - il.quantity_reserved AS quantity_available
FROM request_params params
JOIN warehouses w
    ON w.id = params.warehouse_id
   AND w.company_id = params.company_id
JOIN storage_locations sl ON sl.warehouse_id = w.id
JOIN inventory_lots il ON il.location_id = sl.id
JOIN skus s
    ON s.id = il.sku_id
   AND s.company_id = params.company_id
ORDER BY sl.code, s.sku, il.lot_number;

-- =========================
-- GET /api/skus/:skuId/availability
-- =========================
-- Returns a SKU summary plus location-level availability for allocation decisions.

WITH request_params AS (
    SELECT
        1::BIGINT AS company_id,
        1::BIGINT AS sku_id
), lot_balances AS (
    SELECT
        il.sku_id,
        w.id AS warehouse_id,
        w.name AS warehouse_name,
        sl.id AS location_id,
        sl.code AS location_code,
        il.lot_number,
        il.expiration_date,
        il.quantity_on_hand,
        il.quantity_reserved,
        il.quantity_on_hand - il.quantity_reserved AS quantity_available
    FROM request_params params
    JOIN skus s
        ON s.id = params.sku_id
       AND s.company_id = params.company_id
    JOIN inventory_lots il ON il.sku_id = s.id
    JOIN storage_locations sl ON sl.id = il.location_id
    JOIN warehouses w
        ON w.id = sl.warehouse_id
       AND w.company_id = params.company_id
)
SELECT
    s.id AS sku_id,
    s.sku,
    s.name AS sku_name,
    s.category,
    s.reorder_point,
    COALESCE(SUM(lot.quantity_on_hand), 0)::INTEGER AS total_on_hand,
    COALESCE(SUM(lot.quantity_reserved), 0)::INTEGER AS total_reserved,
    COALESCE(SUM(lot.quantity_available), 0)::INTEGER AS total_available,
    COUNT(lot.location_id)::INTEGER AS stocked_location_count
FROM request_params params
JOIN skus s
    ON s.id = params.sku_id
   AND s.company_id = params.company_id
LEFT JOIN lot_balances lot ON lot.sku_id = s.id
GROUP BY s.id, s.sku, s.name, s.category, s.reorder_point;

-- Location rows for the same endpoint can be fetched as a second result set.
WITH request_params AS (
    SELECT
        1::BIGINT AS company_id,
        1::BIGINT AS sku_id
)
SELECT
    w.id AS warehouse_id,
    w.name AS warehouse_name,
    sl.id AS location_id,
    sl.code AS location_code,
    il.lot_number,
    il.expiration_date,
    il.quantity_on_hand,
    il.quantity_reserved,
    il.quantity_on_hand - il.quantity_reserved AS quantity_available
FROM request_params params
JOIN skus s
    ON s.id = params.sku_id
   AND s.company_id = params.company_id
JOIN inventory_lots il ON il.sku_id = s.id
JOIN storage_locations sl ON sl.id = il.location_id
JOIN warehouses w
    ON w.id = sl.warehouse_id
   AND w.company_id = params.company_id
ORDER BY il.expiration_date NULLS LAST, w.name, sl.code;

-- =========================
-- GET /api/shipments/:shipmentNumber
-- =========================
-- Returns shipment header + line data for receive/export workflows.

WITH request_params AS (
    SELECT
        1::BIGINT AS company_id,
        'OUT-2026-0002'::TEXT AS shipment_number
)
SELECT
    sh.id AS shipment_id,
    sh.shipment_number,
    sh.shipment_type,
    sh.status,
    sh.supplier_or_customer,
    sh.expected_date,
    sh.completed_at,
    creator.name AS created_by_user_name,
    line.id AS shipment_line_id,
    s.id AS sku_id,
    s.sku,
    s.name AS sku_name,
    line.quantity,
    line.received_quantity,
    line.exported_quantity,
    CASE
        WHEN sh.shipment_type = 'inbound' THEN line.quantity - line.received_quantity
        WHEN sh.shipment_type = 'outbound' THEN line.quantity - line.exported_quantity
        ELSE line.quantity
    END AS remaining_quantity
FROM request_params params
JOIN shipments sh
    ON sh.company_id = params.company_id
   AND sh.shipment_number = params.shipment_number
JOIN shipment_lines line ON line.shipment_id = sh.id
JOIN skus s
    ON s.id = line.sku_id
   AND s.company_id = params.company_id
LEFT JOIN users creator ON creator.id = sh.created_by_user_id
ORDER BY line.id;

-- =========================
-- GET /api/stock-movements?skuId=&limit=&before=
-- =========================
-- Returns a cursor-friendly movement ledger slice for audit/history screens.

WITH request_params AS (
    SELECT
        1::BIGINT AS company_id,
        1::BIGINT AS sku_id,
        NULL::TIMESTAMPTZ AS before_created_at,
        10::INTEGER AS page_limit
)
SELECT
    sm.id AS stock_movement_id,
    sm.created_at,
    sm.movement_type,
    sm.quantity,
    s.sku,
    s.name AS sku_name,
    from_loc.code AS from_location_code,
    to_loc.code AS to_location_code,
    sm.reference_type,
    sm.reference_id,
    u.name AS performed_by_user_name,
    sm.notes
FROM request_params params
JOIN stock_movements sm
    ON sm.company_id = params.company_id
   AND sm.sku_id = params.sku_id
JOIN skus s ON s.id = sm.sku_id
LEFT JOIN storage_locations from_loc ON from_loc.id = sm.from_location_id
LEFT JOIN storage_locations to_loc ON to_loc.id = sm.to_location_id
LEFT JOIN users u ON u.id = sm.performed_by_user_id
WHERE params.before_created_at IS NULL
   OR sm.created_at < params.before_created_at
ORDER BY sm.created_at DESC, sm.id DESC
LIMIT (SELECT page_limit FROM request_params);

-- =========================
-- GET /api/dashboard/operations-summary
-- =========================
-- Returns compact tenant dashboard metrics without leaking another company's rows.

WITH request_params AS (
    SELECT 1::BIGINT AS company_id
), sku_totals AS (
    SELECT
        s.id AS sku_id,
        s.reorder_point,
        COALESCE(SUM(il.quantity_on_hand - il.quantity_reserved), 0)::INTEGER AS total_available
    FROM request_params params
    JOIN skus s ON s.company_id = params.company_id
    LEFT JOIN inventory_lots il ON il.sku_id = s.id
    GROUP BY s.id, s.reorder_point
), warehouse_totals AS (
    SELECT
        w.id AS warehouse_id,
        COALESCE(SUM(sl.capacity_units), 0)::INTEGER AS capacity_units,
        COALESCE(SUM(il.quantity_on_hand), 0)::INTEGER AS quantity_on_hand
    FROM request_params params
    JOIN warehouses w ON w.company_id = params.company_id
    JOIN storage_locations sl ON sl.warehouse_id = w.id
    LEFT JOIN inventory_lots il ON il.location_id = sl.id
    GROUP BY w.id
)
SELECT
    (SELECT COUNT(*) FROM skus s JOIN request_params params ON s.company_id = params.company_id)::INTEGER AS sku_count,
    (SELECT COUNT(*) FROM sku_totals WHERE total_available <= reorder_point)::INTEGER AS low_stock_sku_count,
    (SELECT COUNT(*) FROM shipments sh JOIN request_params params ON sh.company_id = params.company_id WHERE sh.status IN ('draft', 'scheduled', 'in_progress'))::INTEGER AS open_shipment_count,
    (SELECT COUNT(*) FROM stock_movements sm JOIN request_params params ON sm.company_id = params.company_id WHERE sm.created_at >= NOW() - INTERVAL '7 days')::INTEGER AS movements_last_7_days,
    (SELECT ROUND((SUM(quantity_on_hand)::NUMERIC / NULLIF(SUM(capacity_units), 0)) * 100, 2) FROM warehouse_totals) AS warehouse_capacity_percent_full;
