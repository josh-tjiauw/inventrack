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

  it('creates a PostgreSQL warehouse', async () => {
    const res = await request(app)
      .post('/api/v2/warehouses')
      .send({
        companyId: 1,
        name: 'CI Automation Warehouse',
        address: '100 CI Way',
        status: 'active'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('warehouse_name', 'CI Automation Warehouse');
    expect(res.body.data).toHaveProperty('warehouse_status', 'active');
  });

  it('creates a PostgreSQL storage location', async () => {
    const res = await request(app)
      .post('/api/v2/storage-locations')
      .send({
        warehouseId: 1,
        code: 'CI-BIN-01',
        name: 'CI Test Bin 01',
        type: 'bin',
        capacityUnits: 75,
        status: 'active'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('location_code', 'CI-BIN-01');
    expect(res.body.data).toHaveProperty('capacity_units', 75);
  });

  it('creates a PostgreSQL SKU', async () => {
    const res = await request(app)
      .post('/api/v2/skus')
      .send({
        companyId: 1,
        sku: 'CI-SKU-WRITE-001',
        name: 'CI Write Test SKU',
        category: 'Tools',
        unitOfMeasure: 'each',
        reorderPoint: 3
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('sku', 'CI-SKU-WRITE-001');
    expect(res.body.data).toHaveProperty('reorder_point', 3);
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

  it('creates a shipment with line assignments', async () => {
    const res = await request(app)
      .post('/api/v2/shipments')
      .send({
        companyId: 1,
        shipmentNumber: 'CI-IN-2026-0001',
        shipmentType: 'inbound',
        status: 'scheduled',
        supplierOrCustomer: 'CI Supplier',
        expectedDate: '2026-06-01',
        createdByUserId: 2,
        lines: [
          { skuId: 1, quantity: 5 },
          { skuId: 2, quantity: 7 }
        ]
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('shipment_number', 'CI-IN-2026-0001');
    expect(res.body.data).toHaveProperty('shipment_type', 'inbound');
    expect(Array.isArray(res.body.data.lines)).toBe(true);
    expect(res.body.data.lines).toHaveLength(2);
    expect(res.body.data.lines[0]).toHaveProperty('quantity');
    expect(res.body.data.lines[0]).toHaveProperty('sku');
  });

  it('receives against an inbound shipment line and completes the shipment', async () => {
    const suffix = Date.now();
    const shipmentRes = await request(app)
      .post('/api/v2/shipments')
      .send({
        companyId: 1,
        shipmentNumber: `CI-IN-RECEIVE-${suffix}`,
        shipmentType: 'inbound',
        status: 'scheduled',
        supplierOrCustomer: 'CI Shipment Supplier',
        lines: [{ skuId: 6, quantity: 2 }]
      });

    expect(shipmentRes.statusCode).toBe(201);
    const shipmentLineId = shipmentRes.body.data.lines[0].shipment_line_id;

    const receiveRes = await request(app)
      .post('/api/v2/receive-stock')
      .send({
        skuId: 6,
        locationId: 5,
        quantity: 2,
        supplier: 'CI Shipment Supplier',
        lotNumber: `CI-SHIP-RECEIVE-${suffix}`,
        shipmentLineId
      });

    expect(receiveRes.statusCode).toBe(201);
    expect(receiveRes.body).toHaveProperty('success', true);
    expect(receiveRes.body.data.movement).toHaveProperty('reference_type', 'shipment_line');
    expect(receiveRes.body.data.shipmentLine).toHaveProperty('received_quantity', 2);
    expect(receiveRes.body.data.shipment).toHaveProperty('status', 'completed');
  });

  it('exports against an outbound shipment line and completes the shipment', async () => {
    const suffix = Date.now();
    const shipmentRes = await request(app)
      .post('/api/v2/shipments')
      .send({
        companyId: 1,
        shipmentNumber: `CI-OUT-EXPORT-${suffix}`,
        shipmentType: 'outbound',
        status: 'scheduled',
        supplierOrCustomer: 'CI Shipment Customer',
        lines: [{ skuId: 1, quantity: 2 }]
      });

    expect(shipmentRes.statusCode).toBe(201);
    const shipmentLineId = shipmentRes.body.data.lines[0].shipment_line_id;

    const exportRes = await request(app)
      .post('/api/v2/export-stock')
      .send({
        skuId: 1,
        quantity: 2,
        destination: 'CI Shipment Customer',
        shipmentLineId
      });

    expect(exportRes.statusCode).toBe(201);
    expect(exportRes.body).toHaveProperty('success', true);
    expect(exportRes.body.data.picks[0]).toHaveProperty('quantity');
    expect(exportRes.body.data.shipmentLine).toHaveProperty('exported_quantity', 2);
    expect(exportRes.body.data.shipment).toHaveProperty('status', 'completed');
  });

  it('rejects shipment creation without line assignments', async () => {
    const res = await request(app)
      .post('/api/v2/shipments')
      .send({
        companyId: 1,
        shipmentNumber: 'CI-IN-EMPTY',
        shipmentType: 'inbound',
        lines: []
      });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.message).toMatch(/lines must include/i);
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

  it('commits a manual stock receipt transaction', async () => {
    const res = await request(app)
      .post('/api/v2/receive-stock')
      .send({
        skuId: 6,
        locationId: 5,
        quantity: 2,
        supplier: 'CI Test Supplier',
        lotNumber: 'CI-RECEIVE-SCAN-001'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data.movement).toHaveProperty('movement_type', 'receive');
    expect(res.body.data.movement).toHaveProperty('quantity', 2);
    expect(res.body.data.lot).toHaveProperty('lot_number', 'CI-RECEIVE-SCAN-001');
    expect(res.body.data.location).toHaveProperty('locationId', '5');
  });

  it('rejects receive transactions that exceed location capacity', async () => {
    const res = await request(app)
      .post('/api/v2/receive-stock')
      .send({
        skuId: 1,
        locationId: 1,
        quantity: 10000,
        supplier: 'CI Overflow Test'
      });

    expect(res.statusCode).toBe(409);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.message).toMatch(/exceed location capacity/i);
  });

  it('commits a manual stock export transaction with FEFO picks', async () => {
    const res = await request(app)
      .post('/api/v2/export-stock')
      .send({
        skuId: 1,
        quantity: 5,
        destination: 'CI Test Customer'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('requestedQuantity', 5);
    expect(res.body.data).toHaveProperty('exportedQuantity', 5);
    expect(Array.isArray(res.body.data.picks)).toBe(true);
    expect(res.body.data.picks.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.picks[0]).toHaveProperty('quantity');
    expect(res.body.data.picks[0]).toHaveProperty('movementId');
  });

  it('rejects export transactions when available stock is insufficient', async () => {
    const res = await request(app)
      .post('/api/v2/export-stock')
      .send({
        skuId: 6,
        quantity: 10000,
        destination: 'CI Shortage Test'
      });

    expect(res.statusCode).toBe(409);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.message).toMatch(/available for export/i);
  });
});
