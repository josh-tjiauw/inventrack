const { test, expect } = require('@playwright/test');

const json = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(data)
});

const buildWorkflowApi = () => {
  let nextShipmentId = 300;
  let nextShipmentLineId = 900;
  let nextMovementId = 700;

  const skus = [
    {
      sku_id: 1,
      sku: 'WHEY-001',
      name: 'Whey Protein 5lb',
      category: 'nutrition',
      reorder_point: 25,
      total_on_hand: 125,
      total_reserved: 0,
      total_available: 125
    }
  ];

  const locations = [
    {
      location_id: 10,
      location_code: 'A-01-01',
      location_name: 'Aisle 1 Bin 1',
      location_type: 'bin',
      warehouse_name: 'Anaheim DC',
      status: 'active',
      capacity_units: 500,
      quantity_on_hand: 125
    }
  ];

  const inventory = [
    {
      inventory_lot_id: 50,
      sku_id: 1,
      sku: 'WHEY-001',
      warehouse_name: 'Anaheim DC',
      location_code: 'A-01-01',
      lot_number: 'LOT-DEMO-1',
      expiration_date: '2026-12-31',
      quantity_on_hand: 125,
      quantity_reserved: 0,
      quantity_available: 125
    }
  ];

  const shipments = [
    {
      shipment_id: 201,
      shipment_number: 'OUT-E2E-001',
      shipment_type: 'outbound',
      status: 'scheduled',
      supplier_or_customer: 'Demo Customer',
      expected_date: '2026-05-14',
      total_quantity: 5,
      total_received_quantity: 0,
      total_exported_quantity: 0,
      lines: [
        {
          shipmentLineId: 501,
          skuId: 1,
          sku: 'WHEY-001',
          skuName: 'Whey Protein 5lb',
          quantity: 5,
          receivedQuantity: 0,
          exportedQuantity: 0
        }
      ]
    }
  ];

  const movements = [];

  const findShipmentLine = (shipmentLineId) => {
    for (const shipment of shipments) {
      const line = shipment.lines.find((candidate) => String(candidate.shipmentLineId) === String(shipmentLineId));
      if (line) return { shipment, line };
    }
    return null;
  };

  return async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (request.method() === 'GET' && path === '/api/v2/skus') {
      await route.fulfill(json({ data: skus }));
      return;
    }

    if (request.method() === 'GET' && path === '/api/v2/storage-locations') {
      await route.fulfill(json({ data: locations }));
      return;
    }

    if (request.method() === 'GET' && path === '/api/v2/storage-recommendations') {
      await route.fulfill(json({ data: [] }));
      return;
    }

    if (request.method() === 'GET' && path === '/api/v2/inventory') {
      await route.fulfill(json({ data: inventory }));
      return;
    }

    if (request.method() === 'GET' && path === '/api/v2/shipments') {
      const type = url.searchParams.get('shipmentType');
      const data = type ? shipments.filter((shipment) => shipment.shipment_type === type) : shipments;
      await route.fulfill(json({ data }));
      return;
    }

    if (request.method() === 'GET' && path === '/api/v2/stock-movements') {
      await route.fulfill(json({ data: movements.slice().reverse() }));
      return;
    }

    if (request.method() === 'POST' && path === '/api/v2/shipments') {
      const payload = request.postDataJSON();
      const created = {
        shipment_id: nextShipmentId++,
        shipment_number: payload.shipmentNumber,
        shipment_type: payload.shipmentType,
        status: payload.status,
        supplier_or_customer: payload.supplierOrCustomer,
        expected_date: payload.expectedDate,
        total_quantity: payload.lines.reduce((sum, line) => sum + Number(line.quantity), 0),
        total_received_quantity: 0,
        total_exported_quantity: 0,
        lines: payload.lines.map((line) => ({
          shipmentLineId: nextShipmentLineId++,
          skuId: line.skuId,
          sku: 'WHEY-001',
          skuName: 'Whey Protein 5lb',
          quantity: Number(line.quantity),
          receivedQuantity: 0,
          exportedQuantity: 0
        }))
      };
      shipments.push(created);
      await route.fulfill(json({ data: created }));
      return;
    }

    if (request.method() === 'POST' && path === '/api/v2/receive-stock') {
      const payload = request.postDataJSON();
      const match = findShipmentLine(payload.shipmentLineId);
      if (match) {
        match.line.receivedQuantity += Number(payload.quantity);
        match.shipment.total_received_quantity += Number(payload.quantity);
      }
      const movement = {
        stock_movement_id: nextMovementId++,
        created_at: '2026-05-13T14:00:00.000Z',
        movement_type: 'receive',
        sku: 'WHEY-001',
        quantity: Number(payload.quantity),
        from_location_code: null,
        to_location_code: 'A-01-01',
        performed_by_user_name: 'Demo User',
        reference_type: 'shipment_line',
        reference_id: payload.shipmentLineId
      };
      movements.push(movement);
      await route.fulfill(json({
        data: {
          movement,
          location: { code: 'A-01-01' }
        }
      }));
      return;
    }

    if (request.method() === 'POST' && path === '/api/v2/export-stock') {
      const payload = request.postDataJSON();
      const match = findShipmentLine(payload.shipmentLineId);
      if (match) {
        match.line.exportedQuantity += Number(payload.quantity);
        match.shipment.total_exported_quantity += Number(payload.quantity);
      }
      const movement = {
        stock_movement_id: nextMovementId++,
        created_at: '2026-05-13T14:05:00.000Z',
        movement_type: 'export',
        sku: 'WHEY-001',
        quantity: Number(payload.quantity),
        from_location_code: 'A-01-01',
        to_location_code: null,
        performed_by_user_name: 'Demo User',
        reference_type: 'shipment_line',
        reference_id: payload.shipmentLineId
      };
      movements.push(movement);
      await route.fulfill(json({
        data: {
          exportedQuantity: Number(payload.quantity),
          picks: [{ inventoryLotId: 50, quantity: Number(payload.quantity) }]
        }
      }));
      return;
    }

    await route.abort();
  };
};

test('portfolio flow creates a shipment, receives against a line, exports against a line, and audits movement history', async ({ page }) => {
  await page.route('http://localhost:5000/api/v2/**', buildWorkflowApi());

  await page.goto('/shipments');
  await expect(page.getByRole('heading', { name: 'Shipment Board' })).toBeVisible();

  await page.getByLabel('Shipment #').fill('IN-E2E-001');
  await page.getByLabel('Supplier / Customer').fill('Demo Supplier');
  await page.getByLabel('SKU').selectOption('1');
  await page.getByLabel('Quantity').fill('12');
  await page.getByRole('button', { name: 'Create Shipment' }).click();
  await expect(page.getByText('Created shipment IN-E2E-001 with 1 line(s).')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'IN-E2E-001' })).toBeVisible();

  await page.goto('/receive');
  await expect(page.getByRole('heading', { name: 'Receive Shipment Planner' })).toBeVisible();
  await page.locator('select').first().selectOption('300');
  await expect(page.getByText(/Planning shipment-line receipt for 12 units of WHEY-001/)).toBeVisible();
  await page.getByRole('button', { name: 'Receive here' }).click();
  await expect(page.getByText('Received 12 units of WHEY-001 into A-01-01.')).toBeVisible();

  await page.goto('/export');
  await expect(page.getByRole('heading', { name: 'Export Shipment Planner' })).toBeVisible();
  await page.locator('select').first().selectOption('201');
  await expect(page.getByText(/Shipment-line pick plan can fulfill 5 units/)).toBeVisible();
  await page.getByRole('button', { name: 'Commit export' }).click();
  await expect(page.getByText('Exported 5 units of WHEY-001 across 1 lot(s).')).toBeVisible();

  await page.goto('/movements');
  await expect(page.getByRole('heading', { name: 'Stock Movement History' })).toBeVisible();
  await expect(page.locator('.movement-type', { hasText: 'receive' })).toBeVisible();
  await expect(page.locator('.movement-type', { hasText: 'export' })).toBeVisible();
  await expect(page.getByText(/shipment_line #/)).toHaveCount(2);
});
