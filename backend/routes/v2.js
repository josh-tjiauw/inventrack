const express = require('express');
const { query, withTransaction, pingPostgres } = require('../db/postgres');
const { receiveStock, exportStock, moveStock } = require('../services/stockTransactions');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const parsePositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const optionalInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const positiveIntOrThrow = (value, fieldName) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    const err = new Error(`${fieldName} must be a positive integer`);
    err.status = 400;
    throw err;
  }
  return parsed;
};

const requiredString = (value, fieldName) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    const err = new Error(`${fieldName} is required`);
    err.status = 400;
    throw err;
  }
  return normalized;
};

const nonNegativeIntOrThrow = (value, fieldName, fallback = 0) => {
  const input = value === undefined || value === null || value === '' ? fallback : value;
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const err = new Error(`${fieldName} must be a non-negative integer`);
    err.status = 400;
    throw err;
  }
  return parsed;
};

const optionalEnumOrThrow = (value, fieldName, allowedValues, fallback) => {
  const normalized = String(value || fallback).trim();
  if (!allowedValues.includes(normalized)) {
    const err = new Error(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
    err.status = 400;
    throw err;
  }
  return normalized;
};

router.get('/health', asyncHandler(async (req, res) => {
  const [{ rows: tableCounts }, ping] = await Promise.all([
    query(`
      SELECT
        (SELECT COUNT(*)::int FROM companies) AS companies,
        (SELECT COUNT(*)::int FROM warehouses) AS warehouses,
        (SELECT COUNT(*)::int FROM storage_locations) AS storage_locations,
        (SELECT COUNT(*)::int FROM skus) AS skus,
        (SELECT COUNT(*)::int FROM inventory_lots) AS inventory_lots,
        (SELECT COUNT(*)::int FROM stock_movements) AS stock_movements
    `),
    pingPostgres()
  ]);

  res.json({
    success: true,
    status: 'OK',
    database: 'PostgreSQL',
    checkedAt: ping.now,
    counts: tableCounts[0]
  });
}));

router.post('/warehouses', asyncHandler(async (req, res) => {
  const companyId = positiveIntOrThrow(req.body.companyId, 'companyId');
  const name = requiredString(req.body.name, 'name');
  const address = req.body.address ? String(req.body.address).trim() : null;
  const status = optionalEnumOrThrow(req.body.status, 'status', ['active', 'inactive', 'maintenance'], 'active');

  const result = await query(`
    INSERT INTO warehouses (company_id, name, address, status)
    VALUES ($1, $2, $3, $4)
    RETURNING id AS warehouse_id, company_id, name AS warehouse_name, address, status AS warehouse_status, created_at
  `, [companyId, name, address, status]);

  res.status(201).json({ success: true, data: result.rows[0] });
}));

router.post('/storage-locations', asyncHandler(async (req, res) => {
  const warehouseId = positiveIntOrThrow(req.body.warehouseId, 'warehouseId');
  const code = requiredString(req.body.code, 'code');
  const name = requiredString(req.body.name, 'name');
  const type = optionalEnumOrThrow(req.body.type, 'type', ['shelf', 'bin', 'rack', 'cold_storage', 'overflow', 'staging'], 'bin');
  const capacityUnits = positiveIntOrThrow(req.body.capacityUnits || req.body.capacity_units, 'capacityUnits');
  const status = optionalEnumOrThrow(req.body.status, 'status', ['active', 'inactive', 'maintenance'], 'active');

  const result = await query(`
    INSERT INTO storage_locations (warehouse_id, code, name, type, capacity_units, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id AS location_id, warehouse_id, code AS location_code, name AS location_name, type AS location_type, capacity_units, status AS location_status, created_at
  `, [warehouseId, code, name, type, capacityUnits, status]);

  res.status(201).json({ success: true, data: result.rows[0] });
}));

router.post('/skus', asyncHandler(async (req, res) => {
  const companyId = positiveIntOrThrow(req.body.companyId, 'companyId');
  const sku = requiredString(req.body.sku, 'sku');
  const name = requiredString(req.body.name, 'name');
  const category = requiredString(req.body.category, 'category');
  const description = req.body.description ? String(req.body.description).trim() : null;
  const unitOfMeasure = optionalEnumOrThrow(req.body.unitOfMeasure || req.body.unit_of_measure, 'unitOfMeasure', ['each', 'case', 'pallet', 'box', 'kg', 'lb'], 'each');
  const reorderPoint = nonNegativeIntOrThrow(req.body.reorderPoint || req.body.reorder_point, 'reorderPoint', 0);

  const result = await query(`
    INSERT INTO skus (company_id, sku, name, category, description, unit_of_measure, reorder_point)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id AS sku_id, company_id, sku, name, category, description, unit_of_measure, reorder_point, created_at
  `, [companyId, sku, name, category, description, unitOfMeasure, reorderPoint]);

  res.status(201).json({ success: true, data: result.rows[0] });
}));

router.get('/warehouses', asyncHandler(async (req, res) => {
  const companyId = optionalInt(req.query.companyId);
  const params = [];
  const where = [];

  if (companyId) {
    params.push(companyId);
    where.push(`company_id = $${params.length}`);
  }

  const result = await query(`
    SELECT
      company_id,
      company_name,
      warehouse_id,
      warehouse_name,
      warehouse_status,
      location_count,
      total_capacity_units,
      total_quantity_on_hand,
      percent_full
    FROM v_warehouse_capacity_summary
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY company_name, warehouse_name
  `, params);

  res.json({ success: true, data: result.rows });
}));

router.get('/storage-locations', asyncHandler(async (req, res) => {
  const companyId = optionalInt(req.query.companyId);
  const warehouseId = optionalInt(req.query.warehouseId);
  const status = req.query.status;
  const params = [];
  const where = [];

  if (companyId) {
    params.push(companyId);
    where.push(`w.company_id = $${params.length}`);
  }

  if (warehouseId) {
    params.push(warehouseId);
    where.push(`sl.warehouse_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    where.push(`sl.status = $${params.length}`);
  }

  const result = await query(`
    SELECT
      c.id AS company_id,
      c.name AS company_name,
      w.id AS warehouse_id,
      w.name AS warehouse_name,
      w.address AS warehouse_address,
      w.status AS warehouse_status,
      sl.id AS location_id,
      sl.code AS location_code,
      sl.name AS location_name,
      sl.type AS location_type,
      sl.capacity_units,
      sl.status AS location_status,
      COALESCE(SUM(il.quantity_on_hand), 0)::int AS quantity_on_hand,
      COALESCE(SUM(il.quantity_reserved), 0)::int AS quantity_reserved,
      COALESCE(SUM(il.quantity_on_hand - il.quantity_reserved), 0)::int AS quantity_available,
      COUNT(DISTINCT il.sku_id)::int AS sku_count,
      CASE
        WHEN sl.capacity_units = 0 THEN 0
        ELSE ROUND((COALESCE(SUM(il.quantity_on_hand), 0)::numeric / sl.capacity_units) * 100, 2)
      END AS percent_full
    FROM storage_locations sl
    JOIN warehouses w ON w.id = sl.warehouse_id
    JOIN companies c ON c.id = w.company_id
    LEFT JOIN inventory_lots il ON il.location_id = sl.id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    GROUP BY c.id, c.name, w.id, w.name, w.address, w.status, sl.id, sl.code, sl.name, sl.type, sl.capacity_units, sl.status
    ORDER BY c.name, w.name, sl.code
  `, params);

  res.json({ success: true, data: result.rows });
}));

router.get('/skus', asyncHandler(async (req, res) => {
  const companyId = optionalInt(req.query.companyId);
  const category = req.query.category;
  const lowStockOnly = req.query.lowStock === 'true';
  const params = [];
  const where = [];

  if (companyId) {
    params.push(companyId);
    where.push(`s.company_id = $${params.length}`);
  }

  if (category) {
    params.push(category);
    where.push(`s.category = $${params.length}`);
  }

  const baseQuery = `
    SELECT
      c.id AS company_id,
      c.name AS company_name,
      s.id AS sku_id,
      s.sku,
      s.name,
      s.category,
      s.description,
      s.unit_of_measure,
      s.reorder_point,
      COALESCE(SUM(il.quantity_on_hand), 0)::int AS total_on_hand,
      COALESCE(SUM(il.quantity_reserved), 0)::int AS total_reserved,
      COALESCE(SUM(il.quantity_on_hand - il.quantity_reserved), 0)::int AS total_available
    FROM skus s
    JOIN companies c ON c.id = s.company_id
    LEFT JOIN inventory_lots il ON il.sku_id = s.id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    GROUP BY c.id, c.name, s.id, s.sku, s.name, s.category, s.description, s.unit_of_measure, s.reorder_point
    ${lowStockOnly ? 'HAVING COALESCE(SUM(il.quantity_on_hand - il.quantity_reserved), 0) <= s.reorder_point' : ''}
    ORDER BY c.name, s.sku
  `;

  const result = await query(baseQuery, params);
  res.json({ success: true, data: result.rows });
}));

router.get('/inventory', asyncHandler(async (req, res) => {
  const companyId = optionalInt(req.query.companyId);
  const warehouseId = optionalInt(req.query.warehouseId);
  const skuId = optionalInt(req.query.skuId);
  const lowStockOnly = req.query.lowStock === 'true';
  const params = [];
  const where = [];

  if (companyId) {
    params.push(companyId);
    where.push(`company_id = $${params.length}`);
  }

  if (warehouseId) {
    params.push(warehouseId);
    where.push(`warehouse_id = $${params.length}`);
  }

  if (skuId) {
    params.push(skuId);
    where.push(`sku_id = $${params.length}`);
  }

  if (lowStockOnly) {
    where.push('quantity_available <= reorder_point');
  }

  const result = await query(`
    SELECT
      company_id,
      company_name,
      warehouse_id,
      warehouse_name,
      location_id,
      location_code,
      location_name,
      location_type,
      sku_id,
      sku,
      sku_name,
      category,
      inventory_lot_id,
      lot_number,
      expiration_date,
      quantity_on_hand,
      quantity_reserved,
      quantity_available,
      reorder_point,
      inventory_updated_at
    FROM v_current_inventory_by_location
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY company_name, warehouse_name, location_code, sku
  `, params);

  res.json({ success: true, data: result.rows });
}));

router.get('/stock-movements', asyncHandler(async (req, res) => {
  const companyId = optionalInt(req.query.companyId);
  const skuId = optionalInt(req.query.skuId);
  const movementType = req.query.movementType;
  const limit = parsePositiveInt(req.query.limit, 50, 200);
  const params = [];
  const where = [];

  if (companyId) {
    params.push(companyId);
    where.push(`company_id = $${params.length}`);
  }

  if (skuId) {
    params.push(skuId);
    where.push(`sku_id = $${params.length}`);
  }

  if (movementType) {
    params.push(movementType);
    where.push(`movement_type = $${params.length}`);
  }

  params.push(limit);
  const limitParam = `$${params.length}`;

  const result = await query(`
    SELECT
      stock_movement_id,
      company_id,
      company_name,
      created_at,
      movement_type,
      quantity,
      sku_id,
      sku,
      sku_name,
      from_warehouse_name,
      from_location_code,
      from_location_name,
      to_warehouse_name,
      to_location_code,
      to_location_name,
      reference_type,
      reference_id,
      performed_by_user_id,
      performed_by_user_name,
      performed_by_user_role,
      notes
    FROM v_stock_movement_history
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC, stock_movement_id DESC
    LIMIT ${limitParam}
  `, params);

  res.json({ success: true, data: result.rows });
}));

router.get('/shipments', asyncHandler(async (req, res) => {
  const companyId = optionalInt(req.query.companyId);
  const shipmentType = req.query.shipmentType;
  const status = req.query.status;
  const limit = parsePositiveInt(req.query.limit, 50, 200);
  const params = [];
  const where = [];

  if (companyId) {
    params.push(companyId);
    where.push(`sh.company_id = $${params.length}`);
  }

  if (shipmentType) {
    params.push(shipmentType);
    where.push(`sh.shipment_type = $${params.length}`);
  }

  if (status) {
    params.push(status);
    where.push(`sh.status = $${params.length}`);
  }

  params.push(limit);
  const limitParam = `$${params.length}`;

  const result = await query(`
    SELECT
      sh.id AS shipment_id,
      sh.company_id,
      c.name AS company_name,
      sh.shipment_number,
      sh.shipment_type,
      sh.status,
      sh.supplier_or_customer,
      sh.expected_date,
      sh.completed_at,
      sh.created_at,
      u.id AS created_by_user_id,
      u.name AS created_by_user_name,
      COUNT(sl.id)::int AS line_count,
      COALESCE(SUM(sl.quantity), 0)::int AS total_quantity,
      COALESCE(SUM(sl.received_quantity), 0)::int AS total_received_quantity,
      COALESCE(SUM(sl.exported_quantity), 0)::int AS total_exported_quantity,
      COALESCE(
        json_agg(
          json_build_object(
            'shipmentLineId', sl.id,
            'skuId', s.id,
            'sku', s.sku,
            'skuName', s.name,
            'quantity', sl.quantity,
            'receivedQuantity', sl.received_quantity,
            'exportedQuantity', sl.exported_quantity
          ) ORDER BY s.sku
        ) FILTER (WHERE sl.id IS NOT NULL),
        '[]'::json
      ) AS lines
    FROM shipments sh
    JOIN companies c ON c.id = sh.company_id
    LEFT JOIN users u ON u.id = sh.created_by_user_id
    LEFT JOIN shipment_lines sl ON sl.shipment_id = sh.id
    LEFT JOIN skus s ON s.id = sl.sku_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    GROUP BY sh.id, c.name, u.id, u.name
    ORDER BY sh.expected_date DESC NULLS LAST, sh.created_at DESC, sh.id DESC
    LIMIT ${limitParam}
  `, params);

  res.json({ success: true, data: result.rows });
}));

router.post('/shipments', asyncHandler(async (req, res) => {
  const companyId = positiveIntOrThrow(req.body.companyId, 'companyId');
  const shipmentNumber = requiredString(req.body.shipmentNumber || req.body.shipment_number, 'shipmentNumber');
  const shipmentType = optionalEnumOrThrow(req.body.shipmentType || req.body.shipment_type, 'shipmentType', ['inbound', 'outbound'], 'inbound');
  const status = optionalEnumOrThrow(req.body.status, 'status', ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'], 'draft');
  const supplierOrCustomer = req.body.supplierOrCustomer || req.body.supplier_or_customer
    ? String(req.body.supplierOrCustomer || req.body.supplier_or_customer).trim()
    : null;
  const expectedDate = req.body.expectedDate || req.body.expected_date || null;
  const createdByUserId = optionalInt(req.body.createdByUserId || req.body.created_by_user_id) || null;
  const lines = Array.isArray(req.body.lines) ? req.body.lines : [];

  if (lines.length === 0) {
    const err = new Error('lines must include at least one shipment line');
    err.status = 400;
    throw err;
  }

  const normalizedLines = lines.map((line, index) => ({
    skuId: positiveIntOrThrow(line.skuId || line.sku_id, `lines[${index}].skuId`),
    quantity: positiveIntOrThrow(line.quantity, `lines[${index}].quantity`)
  }));

  const result = await withTransaction(async (client) => {
    const shipmentResult = await client.query(`
      INSERT INTO shipments (company_id, shipment_number, shipment_type, status, supplier_or_customer, expected_date, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id AS shipment_id, company_id, shipment_number, shipment_type, status, supplier_or_customer, expected_date, created_by_user_id, created_at
    `, [companyId, shipmentNumber, shipmentType, status, supplierOrCustomer, expectedDate, createdByUserId]);

    const shipment = shipmentResult.rows[0];
    const insertedLines = [];

    for (const line of normalizedLines) {
      const skuResult = await client.query('SELECT id, sku, name FROM skus WHERE id = $1 AND company_id = $2', [line.skuId, companyId]);
      if (skuResult.rowCount === 0) {
        const err = new Error(`SKU ${line.skuId} does not exist for company ${companyId}`);
        err.status = 400;
        throw err;
      }

      const lineResult = await client.query(`
        INSERT INTO shipment_lines (shipment_id, sku_id, quantity)
        VALUES ($1, $2, $3)
        RETURNING id AS shipment_line_id, shipment_id, sku_id, quantity, received_quantity, exported_quantity, created_at
      `, [shipment.shipment_id, line.skuId, line.quantity]);

      insertedLines.push({
        ...lineResult.rows[0],
        sku: skuResult.rows[0].sku,
        skuName: skuResult.rows[0].name
      });
    }

    return {
      ...shipment,
      lines: insertedLines
    };
  });

  res.status(201).json({ success: true, data: result });
}));

router.post('/receive-stock', asyncHandler(async (req, res) => {
  const skuId = positiveIntOrThrow(req.body.skuId, 'skuId');
  const locationId = positiveIntOrThrow(req.body.locationId, 'locationId');
  const quantity = positiveIntOrThrow(req.body.quantity, 'quantity');
  const performedByUserId = optionalInt(req.body.performedByUserId || req.body.userId) || null;
  const lotNumber = String(req.body.lotNumber || `LOT-${new Date().toISOString().slice(0, 10)}`).trim();
  const supplier = String(req.body.supplier || req.body.reference || 'Manual receive').trim();
  const notes = String(req.body.notes || `Received from ${supplier}`).trim();
  const expirationDate = req.body.expirationDate || null;
  const shipmentLineId = optionalInt(req.body.shipmentLineId || req.body.shipment_line_id) || null;

  const result = await receiveStock({
    skuId,
    locationId,
    quantity,
    performedByUserId,
    lotNumber,
    supplier,
    notes,
    expirationDate,
    shipmentLineId
  });

  res.status(201).json({ success: true, data: result });
}));

router.post('/export-stock', asyncHandler(async (req, res) => {
  const skuId = positiveIntOrThrow(req.body.skuId, 'skuId');
  const quantity = positiveIntOrThrow(req.body.quantity, 'quantity');
  const performedByUserId = optionalInt(req.body.performedByUserId || req.body.userId) || null;
  const destination = String(req.body.destination || req.body.customer || 'Manual export').trim();
  const notes = String(req.body.notes || `Exported to ${destination}`).trim();
  const shipmentLineId = optionalInt(req.body.shipmentLineId || req.body.shipment_line_id) || null;

  const result = await exportStock({
    skuId,
    quantity,
    performedByUserId,
    destination,
    notes,
    shipmentLineId
  });

  res.status(201).json({ success: true, data: result });
}));

router.post('/move-stock', asyncHandler(async (req, res) => {
  const inventoryLotId = positiveIntOrThrow(req.body.inventoryLotId || req.body.inventory_lot_id, 'inventoryLotId');
  const destinationLocationId = positiveIntOrThrow(req.body.destinationLocationId || req.body.toLocationId || req.body.destination_location_id, 'destinationLocationId');
  const quantity = positiveIntOrThrow(req.body.quantity, 'quantity');
  const performedByUserId = optionalInt(req.body.performedByUserId || req.body.userId) || null;
  const notes = String(req.body.notes || 'Manual stock move').trim();

  const result = await moveStock({
    inventoryLotId,
    destinationLocationId,
    quantity,
    performedByUserId,
    notes
  });

  res.status(201).json({ success: true, data: result });
}));

router.get('/storage-recommendations', asyncHandler(async (req, res) => {
  const companyId = optionalInt(req.query.companyId);
  const params = [];
  const capacityWhere = [];
  const skuWhere = [];
  const inventoryWhere = [];

  if (companyId) {
    params.push(companyId);
    const companyParam = `$${params.length}`;
    capacityWhere.push(`company_id = ${companyParam}`);
    skuWhere.push(`s.company_id = ${companyParam}`);
    inventoryWhere.push(`company_id = ${companyParam}`);
  }

  const [capacityResult, lowStockResult, expiringResult] = await Promise.all([
    query(`
      SELECT
        company_name,
        warehouse_id,
        warehouse_name,
        total_capacity_units,
        total_quantity_on_hand,
        percent_full
      FROM v_warehouse_capacity_summary
      ${capacityWhere.length ? `WHERE ${capacityWhere.join(' AND ')}` : ''}
      ORDER BY percent_full DESC, warehouse_name
    `, params),
    query(`
      SELECT
        c.name AS company_name,
        s.id AS sku_id,
        s.sku,
        s.name,
        s.reorder_point,
        COALESCE(SUM(il.quantity_on_hand - il.quantity_reserved), 0)::int AS total_available
      FROM skus s
      JOIN companies c ON c.id = s.company_id
      LEFT JOIN inventory_lots il ON il.sku_id = s.id
      ${skuWhere.length ? `WHERE ${skuWhere.join(' AND ')}` : ''}
      GROUP BY c.name, s.id, s.sku, s.name, s.reorder_point
      HAVING COALESCE(SUM(il.quantity_on_hand - il.quantity_reserved), 0) <= s.reorder_point
      ORDER BY (s.reorder_point - COALESCE(SUM(il.quantity_on_hand - il.quantity_reserved), 0)) DESC, s.sku
      LIMIT 8
    `, params),
    query(`
      SELECT
        company_name,
        warehouse_name,
        location_code,
        sku,
        sku_name,
        lot_number,
        expiration_date,
        quantity_available
      FROM v_current_inventory_by_location
      WHERE expiration_date IS NOT NULL
        AND expiration_date <= CURRENT_DATE + INTERVAL '30 days'
        ${inventoryWhere.length ? `AND ${inventoryWhere.join(' AND ')}` : ''}
      ORDER BY expiration_date ASC, sku
      LIMIT 8
    `, params)
  ]);

  const capacityRecommendations = capacityResult.rows
    .filter((warehouse) => Number(warehouse.percent_full || 0) >= 80)
    .map((warehouse) => ({
      type: 'capacity',
      priority: Number(warehouse.percent_full) >= 90 ? 'high' : 'medium',
      title: `${warehouse.warehouse_name} is ${Number(warehouse.percent_full).toFixed(1)}% full`,
      action: 'Move slow-moving or overflow inventory into a warehouse with more open capacity before receiving another large shipment.',
      reason: `${warehouse.company_name} has ${warehouse.total_quantity_on_hand} units on hand across ${warehouse.total_capacity_units} units of capacity.`,
      warehouseId: warehouse.warehouse_id
    }));

  const lowStockRecommendations = lowStockResult.rows.map((sku) => ({
    type: 'reorder',
    priority: Number(sku.total_available || 0) <= 0 ? 'high' : 'medium',
    title: `${sku.sku} is at or below reorder point`,
    action: 'Create a purchase/receive plan and prioritize replenishment before allocating more outbound stock.',
    reason: `${sku.name} has ${sku.total_available} available units vs reorder point ${sku.reorder_point}.`,
    skuId: sku.sku_id
  }));

  const expiringRecommendations = expiringResult.rows.map((lot) => ({
    type: 'rotation',
    priority: 'medium',
    title: `${lot.sku} lot ${lot.lot_number} expires soon`,
    action: 'Pick this lot first for outbound shipments or review it for markdown/return handling.',
    reason: `${lot.quantity_available} available units at ${lot.warehouse_name} / ${lot.location_code}, expiring ${lot.expiration_date}.`
  }));

  const recommendations = [
    ...capacityRecommendations,
    ...lowStockRecommendations,
    ...expiringRecommendations
  ];

  res.json({
    success: true,
    strategy: 'rule_based',
    generatedAt: new Date().toISOString(),
    data: recommendations
  });
}));

module.exports = router;
