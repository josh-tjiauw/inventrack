-- Inventrack Enterprise PostgreSQL Transaction Practice
-- Purpose: practice safe inventory writes using transactions and the stock movement ledger.
-- Load inventrack_enterprise_schema_seed.sql first.
-- These examples intentionally ROLLBACK so the seed data stays reusable.

-- =========================
-- Scenario 1: receive inbound stock into staging
-- =========================
-- Business rule:
-- 1. Shipment line received_quantity cannot exceed quantity.
-- 2. Receiving stock creates/updates inventory_lots.
-- 3. Every quantity change writes a stock_movements ledger row.

BEGIN;

WITH inbound_line AS (
    SELECT
        sh.company_id,
        line.id AS shipment_line_id,
        line.shipment_id,
        line.sku_id,
        line.quantity,
        line.received_quantity,
        5::BIGINT AS receiving_location_id,
        2::BIGINT AS performed_by_user_id,
        'RECEIVE-PRACTICE-001'::TEXT AS lot_number,
        10::INTEGER AS receive_quantity
    FROM shipments sh
    JOIN shipment_lines line ON line.shipment_id = sh.id
    WHERE sh.shipment_number = 'IN-2026-0002'
      AND line.sku_id = (SELECT id FROM skus WHERE sku = 'TOOL-SCAN-HAND')
), validated AS (
    SELECT *
    FROM inbound_line
    WHERE received_quantity + receive_quantity <= quantity
), upsert_lot AS (
    INSERT INTO inventory_lots (
        sku_id,
        location_id,
        lot_number,
        quantity_on_hand,
        quantity_reserved
    )
    SELECT
        sku_id,
        receiving_location_id,
        lot_number,
        receive_quantity,
        0
    FROM validated
    ON CONFLICT (sku_id, location_id, lot_number)
    DO UPDATE SET
        quantity_on_hand = inventory_lots.quantity_on_hand + EXCLUDED.quantity_on_hand,
        updated_at = NOW()
    RETURNING id, sku_id, location_id, quantity_on_hand
), update_line AS (
    UPDATE shipment_lines line
    SET
        received_quantity = line.received_quantity + validated.receive_quantity,
        updated_at = NOW()
    FROM validated
    WHERE line.id = validated.shipment_line_id
    RETURNING line.id, line.received_quantity
), ledger AS (
    INSERT INTO stock_movements (
        company_id,
        sku_id,
        from_location_id,
        to_location_id,
        quantity,
        movement_type,
        reference_type,
        reference_id,
        performed_by_user_id,
        notes
    )
    SELECT
        company_id,
        sku_id,
        NULL,
        receiving_location_id,
        receive_quantity,
        'receive',
        'shipment',
        shipment_id,
        performed_by_user_id,
        'Practice receive transaction into staging'
    FROM validated
    RETURNING id, created_at
)
SELECT
    'receive_transaction_preview' AS scenario,
    update_line.id AS shipment_line_id,
    update_line.received_quantity,
    upsert_lot.id AS inventory_lot_id,
    upsert_lot.quantity_on_hand,
    ledger.id AS stock_movement_id
FROM update_line
CROSS JOIN upsert_lot
CROSS JOIN ledger;

ROLLBACK;

-- =========================
-- Scenario 2: export outbound stock using row locks
-- =========================
-- Business rule:
-- 1. Available quantity is quantity_on_hand - quantity_reserved.
-- 2. Exporting stock decrements quantity_on_hand.
-- 3. The selected lot is locked FOR UPDATE so two exports cannot spend the same stock.
-- 4. Every export writes a stock_movements ledger row.

BEGIN;

WITH outbound_request AS (
    SELECT
        sh.company_id,
        line.id AS shipment_line_id,
        line.shipment_id,
        line.sku_id,
        line.quantity,
        line.exported_quantity,
        3::BIGINT AS performed_by_user_id,
        5::INTEGER AS export_quantity
    FROM shipments sh
    JOIN shipment_lines line ON line.shipment_id = sh.id
    WHERE sh.shipment_number = 'OUT-2026-0002'
      AND line.sku_id = (SELECT id FROM skus WHERE sku = 'APP-TSHIRT-BLK-M')
), candidate_lot AS (
    SELECT il.*
    FROM inventory_lots il
    JOIN outbound_request req ON req.sku_id = il.sku_id
    WHERE il.quantity_on_hand - il.quantity_reserved >= req.export_quantity
    ORDER BY il.expiration_date NULLS LAST, il.id
    LIMIT 1
    FOR UPDATE OF il
), validated AS (
    SELECT
        req.*,
        lot.id AS inventory_lot_id,
        lot.location_id
    FROM outbound_request req
    JOIN candidate_lot lot ON lot.sku_id = req.sku_id
    WHERE req.exported_quantity + req.export_quantity <= req.quantity
), update_lot AS (
    UPDATE inventory_lots lot
    SET
        quantity_on_hand = lot.quantity_on_hand - validated.export_quantity,
        updated_at = NOW()
    FROM validated
    WHERE lot.id = validated.inventory_lot_id
    RETURNING lot.id, lot.quantity_on_hand, lot.quantity_reserved
), update_line AS (
    UPDATE shipment_lines line
    SET
        exported_quantity = line.exported_quantity + validated.export_quantity,
        updated_at = NOW()
    FROM validated
    WHERE line.id = validated.shipment_line_id
    RETURNING line.id, line.exported_quantity
), ledger AS (
    INSERT INTO stock_movements (
        company_id,
        sku_id,
        from_location_id,
        to_location_id,
        quantity,
        movement_type,
        reference_type,
        reference_id,
        performed_by_user_id,
        notes
    )
    SELECT
        company_id,
        sku_id,
        location_id,
        NULL,
        export_quantity,
        'export',
        'shipment',
        shipment_id,
        performed_by_user_id,
        'Practice export transaction from available lot'
    FROM validated
    RETURNING id, created_at
)
SELECT
    'export_transaction_preview' AS scenario,
    update_line.id AS shipment_line_id,
    update_line.exported_quantity,
    update_lot.id AS inventory_lot_id,
    update_lot.quantity_on_hand,
    update_lot.quantity_reserved,
    ledger.id AS stock_movement_id
FROM update_line
CROSS JOIN update_lot
CROSS JOIN ledger;

ROLLBACK;

-- =========================
-- Scenario 3: prove insufficient stock is blocked
-- =========================
-- This SELECT should return zero rows because the requested export quantity is too high.
-- In an API service, zero validated rows should become a 409 Conflict / validation error.

WITH impossible_export AS (
    SELECT
        il.id AS inventory_lot_id,
        s.sku,
        il.quantity_on_hand - il.quantity_reserved AS available_quantity,
        9999::INTEGER AS requested_quantity
    FROM inventory_lots il
    JOIN skus s ON s.id = il.sku_id
    WHERE s.sku = 'TOOL-SCAN-HAND'
), validated AS (
    SELECT *
    FROM impossible_export
    WHERE available_quantity >= requested_quantity
)
SELECT *
FROM validated;
