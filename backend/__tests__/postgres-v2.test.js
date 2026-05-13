const request = require('supertest');
const { app } = require('../server');
const { closePool, query } = require('../db/postgres');
const { receiveStock, exportStock, moveStock, reserveStock, releaseReservation } = require('../services/stockTransactions');

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

  it('rejects over-receiving a shipment line without changing line progress or inventory', async () => {
    const suffix = Date.now();
    const shipmentResult = await query(`
      INSERT INTO shipments (company_id, shipment_number, shipment_type, status, supplier_or_customer)
      VALUES (1, $1, 'inbound', 'scheduled', 'CI Over Receive Supplier')
      RETURNING id
    `, [`CI-IN-OVER-RECEIVE-${suffix}`]);
    const lineResult = await query(`
      INSERT INTO shipment_lines (shipment_id, sku_id, quantity)
      VALUES ($1, 6, 1)
      RETURNING id
    `, [shipmentResult.rows[0].id]);
    const shipmentLineId = lineResult.rows[0].id;
    const lotNumber = `CI-OVER-RECEIVE-${suffix}`;

    await expect(receiveStock({
      skuId: 6,
      locationId: 5,
      quantity: 2,
      lotNumber,
      shipmentLineId,
      notes: 'CI over-receive rollback check'
    })).rejects.toMatchObject({ status: 409 });

    const progressResult = await query(
      'SELECT received_quantity FROM shipment_lines WHERE id = $1',
      [shipmentLineId]
    );
    const lotResult = await query(
      'SELECT id FROM inventory_lots WHERE lot_number = $1',
      [lotNumber]
    );

    expect(progressResult.rows[0]).toHaveProperty('received_quantity', 0);
    expect(lotResult.rowCount).toBe(0);
  });

  it('rolls back a receive transaction if movement audit insertion fails', async () => {
    const suffix = Date.now();
    const lotNumber = `CI-RECEIVE-ROLLBACK-${suffix}`;

    await expect(receiveStock({
      skuId: 6,
      locationId: 5,
      quantity: 1,
      lotNumber,
      performedByUserId: 999999,
      notes: 'CI receive rollback check'
    })).rejects.toThrow();

    const lotResult = await query(
      'SELECT id FROM inventory_lots WHERE lot_number = $1',
      [lotNumber]
    );
    const movementResult = await query(
      'SELECT id FROM stock_movements WHERE notes = $1',
      ['CI receive rollback check']
    );

    expect(lotResult.rowCount).toBe(0);
    expect(movementResult.rowCount).toBe(0);
  });

  it('rejects over-exporting a shipment line without changing line progress or inventory', async () => {
    const suffix = Date.now();
    const shipmentResult = await query(`
      INSERT INTO shipments (company_id, shipment_number, shipment_type, status, supplier_or_customer)
      VALUES (1, $1, 'outbound', 'scheduled', 'CI Over Export Customer')
      RETURNING id
    `, [`CI-OUT-OVER-EXPORT-${suffix}`]);
    const lineResult = await query(`
      INSERT INTO shipment_lines (shipment_id, sku_id, quantity)
      VALUES ($1, 1, 1)
      RETURNING id
    `, [shipmentResult.rows[0].id]);
    const shipmentLineId = lineResult.rows[0].id;
    const beforeResult = await query(
      'SELECT COALESCE(SUM(quantity_on_hand), 0)::int AS quantity_on_hand FROM inventory_lots WHERE sku_id = 1'
    );

    await expect(exportStock({
      skuId: 1,
      quantity: 2,
      destination: 'CI Over Export Customer',
      shipmentLineId,
      notes: 'CI over-export rollback check'
    })).rejects.toMatchObject({ status: 409 });

    const progressResult = await query(
      'SELECT exported_quantity FROM shipment_lines WHERE id = $1',
      [shipmentLineId]
    );
    const afterResult = await query(
      'SELECT COALESCE(SUM(quantity_on_hand), 0)::int AS quantity_on_hand FROM inventory_lots WHERE sku_id = 1'
    );

    expect(progressResult.rows[0]).toHaveProperty('exported_quantity', 0);
    expect(afterResult.rows[0].quantity_on_hand).toBe(beforeResult.rows[0].quantity_on_hand);
  });

  it('rolls back an export transaction if movement audit insertion fails after lots are locked', async () => {
    const beforeResult = await query(
      'SELECT id, quantity_on_hand FROM inventory_lots WHERE sku_id = 1 ORDER BY expiration_date ASC NULLS LAST, location_id, id LIMIT 1'
    );
    const targetLot = beforeResult.rows[0];

    await expect(exportStock({
      skuId: 1,
      quantity: 1,
      destination: 'CI Rollback Customer',
      performedByUserId: 999999,
      notes: 'CI export rollback check'
    })).rejects.toThrow();

    const afterResult = await query(
      'SELECT quantity_on_hand FROM inventory_lots WHERE id = $1',
      [targetLot.id]
    );
    const movementResult = await query(
      'SELECT id FROM stock_movements WHERE notes = $1',
      ['CI export rollback check']
    );

    expect(afterResult.rows[0].quantity_on_hand).toBe(targetLot.quantity_on_hand);
    expect(movementResult.rowCount).toBe(0);
  });

  it('commits a manual stock move between active locations', async () => {
    const suffix = Date.now();
    const lotResult = await query(`
      INSERT INTO inventory_lots (sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved)
      VALUES (1, 1, $1, 8, 2)
      RETURNING id
    `, [`CI-MOVE-${suffix}`]);

    const res = await request(app)
      .post('/api/v2/move-stock')
      .send({
        inventoryLotId: lotResult.rows[0].id,
        destinationLocationId: 5,
        quantity: 3,
        notes: 'CI move stock success'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data.movement).toHaveProperty('movement_type', 'move');
    expect(res.body.data.movement).toHaveProperty('quantity', 3);
    expect(res.body.data.sourceLot).toHaveProperty('quantity_on_hand', 5);
    expect(res.body.data.destinationLot).toHaveProperty('quantity_on_hand', 3);
    expect(res.body.data.destinationLocation).toHaveProperty('code', 'STAGE-IN-01');
  });

  it('rejects stock moves when source lot available quantity is insufficient', async () => {
    const suffix = Date.now();
    const lotResult = await query(`
      INSERT INTO inventory_lots (sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved)
      VALUES (1, 1, $1, 4, 2)
      RETURNING id
    `, [`CI-MOVE-SHORT-${suffix}`]);

    await expect(moveStock({
      inventoryLotId: lotResult.rows[0].id,
      destinationLocationId: 5,
      quantity: 3,
      notes: 'CI move insufficient available'
    })).rejects.toMatchObject({ status: 409 });

    const unchangedLotResult = await query(
      'SELECT quantity_on_hand, quantity_reserved FROM inventory_lots WHERE id = $1',
      [lotResult.rows[0].id]
    );
    const movementResult = await query(
      'SELECT id FROM stock_movements WHERE notes = $1',
      ['CI move insufficient available']
    );

    expect(unchangedLotResult.rows[0]).toHaveProperty('quantity_on_hand', 4);
    expect(unchangedLotResult.rows[0]).toHaveProperty('quantity_reserved', 2);
    expect(movementResult.rowCount).toBe(0);
  });

  it('rejects stock moves into inactive or over-capacity destination locations', async () => {
    const suffix = Date.now();
    const inactiveLotResult = await query(`
      INSERT INTO inventory_lots (sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved)
      VALUES (1, 1, $1, 5, 0)
      RETURNING id
    `, [`CI-MOVE-INACTIVE-${suffix}`]);
    const fullLocationResult = await query(`
      INSERT INTO storage_locations (warehouse_id, code, name, type, capacity_units, status)
      VALUES (1, $1, 'CI Move Full Bin', 'bin', 2, 'active')
      RETURNING id
    `, [`CI-MOVE-FULL-${suffix}`]);
    await query(`
      INSERT INTO inventory_lots (sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved)
      VALUES (2, $1, $2, 2, 0)
    `, [fullLocationResult.rows[0].id, `CI-MOVE-FILLER-${suffix}`]);

    await expect(moveStock({
      inventoryLotId: inactiveLotResult.rows[0].id,
      destinationLocationId: 7,
      quantity: 1,
      notes: 'CI move inactive destination'
    })).rejects.toMatchObject({ status: 409 });

    await expect(moveStock({
      inventoryLotId: inactiveLotResult.rows[0].id,
      destinationLocationId: fullLocationResult.rows[0].id,
      quantity: 1,
      notes: 'CI move over capacity'
    })).rejects.toMatchObject({ status: 409 });

    const sourceLotResult = await query(
      'SELECT quantity_on_hand FROM inventory_lots WHERE id = $1',
      [inactiveLotResult.rows[0].id]
    );

    expect(sourceLotResult.rows[0]).toHaveProperty('quantity_on_hand', 5);
  });

  it('commits and audits a stock reservation', async () => {
    const suffix = Date.now();
    const lotResult = await query(`
      INSERT INTO inventory_lots (sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved)
      VALUES (1, 1, $1, 10, 2)
      RETURNING id
    `, [`CI-RESERVE-${suffix}`]);

    const res = await request(app)
      .post('/api/v2/reserve-stock')
      .send({
        inventoryLotId: lotResult.rows[0].id,
        quantity: 4,
        notes: 'CI reserve success'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('reservedQuantity', 4);
    expect(res.body.data.lot).toHaveProperty('quantity_on_hand', 10);
    expect(res.body.data.lot).toHaveProperty('quantity_reserved', 6);
    expect(res.body.data.movement).toHaveProperty('movement_type', 'reserve');
    expect(res.body.data.movement).toHaveProperty('reference_type', 'inventory_lot');
  });

  it('rejects reservations when available quantity is insufficient without changing the lot', async () => {
    const suffix = Date.now();
    const lotResult = await query(`
      INSERT INTO inventory_lots (sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved)
      VALUES (1, 1, $1, 5, 4)
      RETURNING id
    `, [`CI-RESERVE-SHORT-${suffix}`]);

    await expect(reserveStock({
      inventoryLotId: lotResult.rows[0].id,
      quantity: 2,
      notes: 'CI reserve insufficient available'
    })).rejects.toMatchObject({ status: 409 });

    const unchangedLotResult = await query(
      'SELECT quantity_on_hand, quantity_reserved FROM inventory_lots WHERE id = $1',
      [lotResult.rows[0].id]
    );
    const movementResult = await query(
      'SELECT id FROM stock_movements WHERE notes = $1',
      ['CI reserve insufficient available']
    );

    expect(unchangedLotResult.rows[0]).toHaveProperty('quantity_on_hand', 5);
    expect(unchangedLotResult.rows[0]).toHaveProperty('quantity_reserved', 4);
    expect(movementResult.rowCount).toBe(0);
  });

  it('commits and audits a reservation release', async () => {
    const suffix = Date.now();
    const lotResult = await query(`
      INSERT INTO inventory_lots (sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved)
      VALUES (1, 1, $1, 9, 5)
      RETURNING id
    `, [`CI-RELEASE-${suffix}`]);

    const res = await request(app)
      .post('/api/v2/release-reservation')
      .send({
        inventoryLotId: lotResult.rows[0].id,
        quantity: 3,
        notes: 'CI release success'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('releasedQuantity', 3);
    expect(res.body.data.lot).toHaveProperty('quantity_on_hand', 9);
    expect(res.body.data.lot).toHaveProperty('quantity_reserved', 2);
    expect(res.body.data.movement).toHaveProperty('movement_type', 'release_reservation');
  });

  it('rejects reservation releases above reserved quantity without changing the lot', async () => {
    const suffix = Date.now();
    const lotResult = await query(`
      INSERT INTO inventory_lots (sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved)
      VALUES (1, 1, $1, 7, 2)
      RETURNING id
    `, [`CI-RELEASE-OVER-${suffix}`]);

    await expect(releaseReservation({
      inventoryLotId: lotResult.rows[0].id,
      quantity: 3,
      notes: 'CI release over reserved'
    })).rejects.toMatchObject({ status: 409 });

    const unchangedLotResult = await query(
      'SELECT quantity_on_hand, quantity_reserved FROM inventory_lots WHERE id = $1',
      [lotResult.rows[0].id]
    );
    const movementResult = await query(
      'SELECT id FROM stock_movements WHERE notes = $1',
      ['CI release over reserved']
    );

    expect(unchangedLotResult.rows[0]).toHaveProperty('quantity_on_hand', 7);
    expect(unchangedLotResult.rows[0]).toHaveProperty('quantity_reserved', 2);
    expect(movementResult.rowCount).toBe(0);
  });
});
