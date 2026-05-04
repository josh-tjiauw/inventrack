-- Inventrack Enterprise PostgreSQL Validation Checks
-- Purpose: verify the practice dataset still satisfies important enterprise inventory invariants.
-- Expected result after loading inventrack_enterprise_schema_seed.sql: zero rows returned.

\echo 'Running Inventrack enterprise validation checks...'

WITH validation_failures AS (
    -- Every inventory lot should connect a SKU to a location owned by the same company.
    SELECT
        'inventory_lots stay inside one tenant' AS check_name,
        COUNT(*) AS failure_count
    FROM inventory_lots il
    JOIN skus s ON s.id = il.sku_id
    JOIN storage_locations sl ON sl.id = il.location_id
    JOIN warehouses w ON w.id = sl.warehouse_id
    WHERE s.company_id <> w.company_id

    UNION ALL

    -- Shipment lines should never attach another company's SKU to a shipment.
    SELECT
        'shipment_lines match shipment tenant' AS check_name,
        COUNT(*) AS failure_count
    FROM shipment_lines line
    JOIN shipments sh ON sh.id = line.shipment_id
    JOIN skus s ON s.id = line.sku_id
    WHERE sh.company_id <> s.company_id

    UNION ALL

    -- Stock movement company_id should match the moved SKU.
    SELECT
        'stock_movements match sku tenant' AS check_name,
        COUNT(*) AS failure_count
    FROM stock_movements sm
    JOIN skus s ON s.id = sm.sku_id
    WHERE sm.company_id <> s.company_id

    UNION ALL

    -- Source locations on movements should belong to the movement company.
    SELECT
        'stock_movements from_location matches tenant' AS check_name,
        COUNT(*) AS failure_count
    FROM stock_movements sm
    JOIN storage_locations sl ON sl.id = sm.from_location_id
    JOIN warehouses w ON w.id = sl.warehouse_id
    WHERE sm.from_location_id IS NOT NULL
      AND sm.company_id <> w.company_id

    UNION ALL

    -- Destination locations on movements should belong to the movement company.
    SELECT
        'stock_movements to_location matches tenant' AS check_name,
        COUNT(*) AS failure_count
    FROM stock_movements sm
    JOIN storage_locations sl ON sl.id = sm.to_location_id
    JOIN warehouses w ON w.id = sl.warehouse_id
    WHERE sm.to_location_id IS NOT NULL
      AND sm.company_id <> w.company_id

    UNION ALL

    -- Reserved quantity should never exceed on-hand stock.
    SELECT
        'inventory_lots reserved quantity is available' AS check_name,
        COUNT(*) AS failure_count
    FROM inventory_lots
    WHERE quantity_reserved > quantity_on_hand

    UNION ALL

    -- Location capacity should not be overfilled by current lot balances.
    SELECT
        'storage_locations are within capacity' AS check_name,
        COUNT(*) AS failure_count
    FROM (
        SELECT
            sl.id,
            sl.capacity_units,
            COALESCE(SUM(il.quantity_on_hand), 0) AS used_units
        FROM storage_locations sl
        LEFT JOIN inventory_lots il ON il.location_id = sl.id
        GROUP BY sl.id, sl.capacity_units
    ) location_usage
    WHERE used_units > capacity_units

    UNION ALL

    -- Completed inbound shipments should not have over-received lines.
    SELECT
        'shipment_lines do not over receive' AS check_name,
        COUNT(*) AS failure_count
    FROM shipment_lines
    WHERE received_quantity > quantity

    UNION ALL

    -- Completed outbound shipments should not have over-exported lines.
    SELECT
        'shipment_lines do not over export' AS check_name,
        COUNT(*) AS failure_count
    FROM shipment_lines
    WHERE exported_quantity > quantity

    UNION ALL

    -- Receive movements should add inventory to a destination and not remove it from a source.
    SELECT
        'receive movements have only destination locations' AS check_name,
        COUNT(*) AS failure_count
    FROM stock_movements
    WHERE movement_type = 'receive'
      AND (from_location_id IS NOT NULL OR to_location_id IS NULL)

    UNION ALL

    -- Export movements should remove inventory from a source and not add it to a destination.
    SELECT
        'export movements have only source locations' AS check_name,
        COUNT(*) AS failure_count
    FROM stock_movements
    WHERE movement_type = 'export'
      AND (from_location_id IS NULL OR to_location_id IS NOT NULL)

    UNION ALL

    -- Move movements should have both a source and destination location.
    SELECT
        'move movements have source and destination locations' AS check_name,
        COUNT(*) AS failure_count
    FROM stock_movements
    WHERE movement_type = 'move'
      AND (from_location_id IS NULL OR to_location_id IS NULL)
)
SELECT check_name, failure_count
FROM validation_failures
WHERE failure_count > 0
ORDER BY check_name;

\echo 'Done. A healthy seed dataset returns zero rows above.'
