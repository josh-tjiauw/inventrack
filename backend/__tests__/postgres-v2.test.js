const request = require('supertest');
const { app } = require('../server');
const { closePool } = require('../db/postgres');

const describeIfPostgres = process.env.DATABASE_URL || process.env.POSTGRES_URL ? describe : describe.skip;

describeIfPostgres('PostgreSQL v2 API', () => {
  afterAll(async () => {
    await closePool();
  });

  it('returns PostgreSQL health and table counts', async () => {
    const res = await request(app).get('/api/v2/health');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('database', 'PostgreSQL');
    expect(res.body.counts.companies).toBeGreaterThanOrEqual(1);
    expect(res.body.counts.skus).toBeGreaterThanOrEqual(1);
  });

  it('returns warehouse capacity summaries', async () => {
    const res = await request(app).get('/api/v2/warehouses');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('warehouse_name');
    expect(res.body.data[0]).toHaveProperty('percent_full');
  });

  it('returns storage location capacity and inventory summaries', async () => {
    const res = await request(app).get('/api/v2/storage-locations');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('location_code');
    expect(res.body.data[0]).toHaveProperty('capacity_units');
    expect(res.body.data[0]).toHaveProperty('percent_full');
  });

  it('returns low-stock SKUs', async () => {
    const res = await request(app).get('/api/v2/skus?lowStock=true');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some(sku => sku.sku === 'TOOL-SCAN-HAND')).toBe(true);
  });

  it('returns current inventory by location', async () => {
    const res = await request(app).get('/api/v2/inventory');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('location_code');
    expect(res.body.data[0]).toHaveProperty('quantity_available');
  });

  it('returns stock movement history with a limit', async () => {
    const res = await request(app).get('/api/v2/stock-movements?limit=3');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(3);
    expect(res.body.data[0]).toHaveProperty('movement_type');
  });

  it('returns shipment summaries with line details', async () => {
    const res = await request(app).get('/api/v2/shipments?limit=3');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(3);
    expect(res.body.data[0]).toHaveProperty('shipment_number');
    expect(res.body.data[0]).toHaveProperty('line_count');
    expect(Array.isArray(res.body.data[0].lines)).toBe(true);
  });

  it('returns rule-based storage recommendations', async () => {
    const res = await request(app).get('/api/v2/storage-recommendations');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('strategy', 'rule_based');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0]).toHaveProperty('type');
    expect(res.body.data[0]).toHaveProperty('priority');
    expect(res.body.data[0]).toHaveProperty('action');
  });
});
