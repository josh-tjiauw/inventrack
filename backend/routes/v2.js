const express = require('express');
const { query, pingPostgres } = require('../db/postgres');

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

module.exports = router;
