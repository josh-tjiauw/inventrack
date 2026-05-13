const { withTransaction } = require('../db/postgres');

const badRequest = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

const conflict = (message) => {
  const err = new Error(message);
  err.status = 409;
  return err;
};

const updateShipmentStatus = async (client, shipmentId, shipmentType) => {
  const progressResult = await client.query(`
    SELECT
      COUNT(*)::int AS line_count,
      BOOL_AND(
        CASE
          WHEN $2 = 'inbound' THEN received_quantity >= quantity
          ELSE exported_quantity >= quantity
        END
      ) AS all_complete,
      BOOL_OR(received_quantity > 0 OR exported_quantity > 0) AS any_progress
    FROM shipment_lines
    WHERE shipment_id = $1
  `, [shipmentId, shipmentType]);

  const progress = progressResult.rows[0];
  const nextStatus = progress.all_complete
    ? 'completed'
    : progress.any_progress
      ? 'in_progress'
      : 'scheduled';

  const result = await client.query(`
    UPDATE shipments
    SET status = $1,
        completed_at = CASE WHEN $1 = 'completed' THEN COALESCE(completed_at, NOW()) ELSE NULL END,
        updated_at = NOW()
    WHERE id = $2
    RETURNING id AS shipment_id, shipment_number, shipment_type, status, completed_at
  `, [nextStatus, shipmentId]);

  return result.rows[0];
};

const receiveStock = async ({
  skuId,
  locationId,
  quantity,
  performedByUserId = null,
  lotNumber,
  expirationDate = null,
  notes,
  shipmentLineId = null
}) => withTransaction(async (client) => {
  let shipmentProgress = null;

  if (shipmentLineId) {
    const lineResult = await client.query(`
      SELECT
        sl.id AS shipment_line_id,
        sl.shipment_id,
        sl.sku_id,
        sl.quantity,
        sl.received_quantity,
        sh.shipment_type,
        sh.status,
        sh.shipment_number
      FROM shipment_lines sl
      JOIN shipments sh ON sh.id = sl.shipment_id
      WHERE sl.id = $1
      FOR UPDATE OF sl, sh
    `, [shipmentLineId]);

    if (lineResult.rowCount === 0) {
      throw badRequest('shipmentLineId does not exist');
    }

    const line = lineResult.rows[0];
    if (line.shipment_type !== 'inbound') {
      throw conflict('Only inbound shipment lines can be received');
    }
    if (Number(line.sku_id) !== Number(skuId)) {
      throw conflict('Shipment line SKU does not match receive SKU');
    }
    if (Number(line.received_quantity) + quantity > Number(line.quantity)) {
      throw conflict('Receiving this quantity would exceed the shipment line quantity');
    }

    shipmentProgress = line;
  }

  const skuLocationResult = await client.query(`
    SELECT
      s.id AS sku_id,
      s.company_id,
      s.sku,
      s.name AS sku_name,
      sl.id AS location_id,
      sl.code AS location_code,
      sl.status AS location_status,
      sl.capacity_units,
      w.name AS warehouse_name
    FROM skus s
    CROSS JOIN storage_locations sl
    JOIN warehouses w ON w.id = sl.warehouse_id
    WHERE s.id = $1 AND sl.id = $2 AND w.company_id = s.company_id
    FOR UPDATE OF s, sl
  `, [skuId, locationId]);

  if (skuLocationResult.rowCount === 0) {
    throw badRequest('SKU and location must exist under the same company');
  }

  const skuLocation = skuLocationResult.rows[0];
  if (skuLocation.location_status !== 'active') {
    throw conflict(`Location ${skuLocation.location_code} is not active`);
  }

  const locationQuantityResult = await client.query(`
    SELECT COALESCE(SUM(quantity_on_hand), 0)::int AS location_quantity_on_hand
    FROM inventory_lots
    WHERE location_id = $1
  `, [locationId]);

  const projectedQuantity = Number(locationQuantityResult.rows[0].location_quantity_on_hand || 0) + quantity;
  if (projectedQuantity > Number(skuLocation.capacity_units || 0)) {
    throw conflict(`Receiving ${quantity} units would exceed location capacity`);
  }

  const upsertLotResult = await client.query(`
    INSERT INTO inventory_lots (sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved, expiration_date)
    VALUES ($1, $2, $3, $4, 0, $5)
    ON CONFLICT (sku_id, location_id, lot_number)
    DO UPDATE SET
      quantity_on_hand = inventory_lots.quantity_on_hand + EXCLUDED.quantity_on_hand,
      expiration_date = COALESCE(EXCLUDED.expiration_date, inventory_lots.expiration_date),
      updated_at = NOW()
    RETURNING id, sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved, expiration_date
  `, [skuId, locationId, lotNumber, quantity, expirationDate]);

  const movementResult = await client.query(`
    INSERT INTO stock_movements (
      company_id, sku_id, from_location_id, to_location_id, quantity,
      movement_type, reference_type, reference_id, performed_by_user_id, notes
    )
    VALUES ($1, $2, NULL, $3, $4, 'receive', $8, $5, $6, $7)
    RETURNING id, company_id, sku_id, to_location_id, quantity, movement_type, reference_type, notes, created_at
  `, [
    skuLocation.company_id,
    skuId,
    locationId,
    quantity,
    shipmentLineId || upsertLotResult.rows[0].id,
    performedByUserId,
    notes,
    shipmentLineId ? 'shipment_line' : 'manual_receive'
  ]);

  let shipment = null;
  if (shipmentProgress) {
    const lineUpdateResult = await client.query(`
      UPDATE shipment_lines
      SET received_quantity = received_quantity + $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING id AS shipment_line_id, shipment_id, sku_id, quantity, received_quantity, exported_quantity
    `, [quantity, shipmentLineId]);

    shipment = await updateShipmentStatus(client, shipmentProgress.shipment_id, 'inbound');
    shipmentProgress = lineUpdateResult.rows[0];
  }

  return {
    lot: upsertLotResult.rows[0],
    movement: movementResult.rows[0],
    sku: {
      skuId: skuLocation.sku_id,
      sku: skuLocation.sku,
      name: skuLocation.sku_name
    },
    location: {
      locationId: skuLocation.location_id,
      code: skuLocation.location_code,
      warehouseName: skuLocation.warehouse_name,
      quantityOnHandAfterReceive: projectedQuantity,
      capacityUnits: skuLocation.capacity_units
    },
    shipment,
    shipmentLine: shipmentProgress
  };
});

const exportStock = async ({
  skuId,
  quantity,
  performedByUserId = null,
  destination,
  notes,
  shipmentLineId = null
}) => withTransaction(async (client) => {
  let shipmentProgress = null;

  if (shipmentLineId) {
    const lineResult = await client.query(`
      SELECT
        sl.id AS shipment_line_id,
        sl.shipment_id,
        sl.sku_id,
        sl.quantity,
        sl.exported_quantity,
        sh.shipment_type,
        sh.status,
        sh.shipment_number
      FROM shipment_lines sl
      JOIN shipments sh ON sh.id = sl.shipment_id
      WHERE sl.id = $1
      FOR UPDATE OF sl, sh
    `, [shipmentLineId]);

    if (lineResult.rowCount === 0) {
      throw badRequest('shipmentLineId does not exist');
    }

    const line = lineResult.rows[0];
    if (line.shipment_type !== 'outbound') {
      throw conflict('Only outbound shipment lines can be exported');
    }
    if (Number(line.sku_id) !== Number(skuId)) {
      throw conflict('Shipment line SKU does not match export SKU');
    }
    if (Number(line.exported_quantity) + quantity > Number(line.quantity)) {
      throw conflict('Exporting this quantity would exceed the shipment line quantity');
    }

    shipmentProgress = line;
  }

  const skuResult = await client.query('SELECT id, company_id, sku, name FROM skus WHERE id = $1 FOR UPDATE', [skuId]);
  if (skuResult.rowCount === 0) {
    throw badRequest('SKU does not exist');
  }

  const sku = skuResult.rows[0];
  const lotsResult = await client.query(`
    SELECT
      il.id AS inventory_lot_id,
      il.location_id,
      il.lot_number,
      il.expiration_date,
      il.quantity_on_hand,
      il.quantity_reserved,
      (il.quantity_on_hand - il.quantity_reserved)::int AS quantity_available,
      sl.code AS location_code,
      w.name AS warehouse_name
    FROM inventory_lots il
    JOIN storage_locations sl ON sl.id = il.location_id
    JOIN warehouses w ON w.id = sl.warehouse_id
    WHERE il.sku_id = $1
      AND w.company_id = $2
      AND (il.quantity_on_hand - il.quantity_reserved) > 0
    ORDER BY il.expiration_date ASC NULLS LAST, sl.code, il.id
    FOR UPDATE OF il
  `, [skuId, sku.company_id]);

  const totalAvailable = lotsResult.rows.reduce((sum, lot) => sum + Number(lot.quantity_available || 0), 0);
  if (totalAvailable < quantity) {
    throw conflict(`Only ${totalAvailable} units are available for export`);
  }

  let remaining = quantity;
  const picks = [];

  for (const lot of lotsResult.rows) {
    if (remaining <= 0) break;

    const pickQuantity = Math.min(Number(lot.quantity_available || 0), remaining);
    remaining -= pickQuantity;

    await client.query(`
      UPDATE inventory_lots
      SET quantity_on_hand = quantity_on_hand - $1,
          updated_at = NOW()
      WHERE id = $2
    `, [pickQuantity, lot.inventory_lot_id]);

    const movementResult = await client.query(`
      INSERT INTO stock_movements (
        company_id, sku_id, from_location_id, to_location_id, quantity,
        movement_type, reference_type, reference_id, performed_by_user_id, notes
      )
        VALUES ($1, $2, $3, NULL, $4, 'export', $8, $5, $6, $7)
        RETURNING id, quantity, created_at
      `, [
        sku.company_id,
        skuId,
        lot.location_id,
        pickQuantity,
        shipmentLineId || lot.inventory_lot_id,
        performedByUserId,
        notes,
        shipmentLineId ? 'shipment_line' : 'manual_export'
      ]);

    picks.push({
      movementId: movementResult.rows[0].id,
      inventoryLotId: lot.inventory_lot_id,
      locationId: lot.location_id,
      locationCode: lot.location_code,
      warehouseName: lot.warehouse_name,
      lotNumber: lot.lot_number,
      expirationDate: lot.expiration_date,
      quantity: pickQuantity,
      quantityOnHandAfterExport: Number(lot.quantity_on_hand) - pickQuantity
    });
  }

    let shipment = null;
    if (shipmentProgress) {
      const lineUpdateResult = await client.query(`
        UPDATE shipment_lines
        SET exported_quantity = exported_quantity + $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING id AS shipment_line_id, shipment_id, sku_id, quantity, received_quantity, exported_quantity
      `, [quantity, shipmentLineId]);

      shipment = await updateShipmentStatus(client, shipmentProgress.shipment_id, 'outbound');
      shipmentProgress = lineUpdateResult.rows[0];
    }

  return {
    sku: {
      skuId: sku.id,
      sku: sku.sku,
      name: sku.name
    },
    requestedQuantity: quantity,
    exportedQuantity: picks.reduce((sum, pick) => sum + pick.quantity, 0),
    destination,
    picks,
    shipment,
    shipmentLine: shipmentProgress
  };
});

const moveStock = async ({
  inventoryLotId,
  destinationLocationId,
  quantity,
  performedByUserId = null,
  notes
}) => withTransaction(async (client) => {
  const sourceResult = await client.query(`
    SELECT
      il.id AS inventory_lot_id,
      il.sku_id,
      il.location_id AS source_location_id,
      il.lot_number,
      il.expiration_date,
      il.quantity_on_hand,
      il.quantity_reserved,
      (il.quantity_on_hand - il.quantity_reserved)::int AS quantity_available,
      s.company_id,
      s.sku,
      s.name AS sku_name,
      source_location.code AS source_location_code,
      source_location.name AS source_location_name,
      source_warehouse.name AS source_warehouse_name
    FROM inventory_lots il
    JOIN skus s ON s.id = il.sku_id
    JOIN storage_locations source_location ON source_location.id = il.location_id
    JOIN warehouses source_warehouse ON source_warehouse.id = source_location.warehouse_id
    WHERE il.id = $1
    FOR UPDATE OF il
  `, [inventoryLotId]);

  if (sourceResult.rowCount === 0) {
    throw badRequest('inventoryLotId does not exist');
  }

  const source = sourceResult.rows[0];
  if (Number(source.source_location_id) === Number(destinationLocationId)) {
    throw conflict('Destination location must be different from the source location');
  }

  if (Number(source.quantity_available || 0) < quantity) {
    throw conflict(`Only ${source.quantity_available} units are available to move from this lot`);
  }

  const destinationResult = await client.query(`
    SELECT
      sl.id AS destination_location_id,
      sl.code AS destination_location_code,
      sl.name AS destination_location_name,
      sl.status AS destination_location_status,
      sl.capacity_units,
      w.id AS destination_warehouse_id,
      w.name AS destination_warehouse_name,
      w.company_id
    FROM storage_locations sl
    JOIN warehouses w ON w.id = sl.warehouse_id
    WHERE sl.id = $1
    FOR UPDATE OF sl
  `, [destinationLocationId]);

  if (destinationResult.rowCount === 0) {
    throw badRequest('destinationLocationId does not exist');
  }

  const destination = destinationResult.rows[0];
  if (Number(destination.company_id) !== Number(source.company_id)) {
    throw badRequest('Destination location must belong to the same company as the SKU');
  }

  if (destination.destination_location_status !== 'active') {
    throw conflict(`Location ${destination.destination_location_code} is not active`);
  }

  const destinationQuantityResult = await client.query(`
    SELECT COALESCE(SUM(quantity_on_hand), 0)::int AS destination_quantity_on_hand
    FROM inventory_lots
    WHERE location_id = $1
  `, [destinationLocationId]);

  const destinationQuantityBefore = Number(destinationQuantityResult.rows[0].destination_quantity_on_hand || 0);
  const destinationQuantityAfter = destinationQuantityBefore + quantity;
  if (destinationQuantityAfter > Number(destination.capacity_units || 0)) {
    throw conflict(`Moving ${quantity} units would exceed destination location capacity`);
  }

  const destinationLotResult = await client.query(`
    UPDATE inventory_lots
    SET quantity_on_hand = quantity_on_hand + $1,
        expiration_date = COALESCE(expiration_date, $5),
        updated_at = NOW()
    WHERE sku_id = $2
      AND location_id = $3
      AND lot_number IS NOT DISTINCT FROM $4
    RETURNING id, sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved, expiration_date
  `, [quantity, source.sku_id, destinationLocationId, source.lot_number, source.expiration_date]);

  let destinationLot = destinationLotResult.rows[0];
  if (!destinationLot) {
    const insertedDestinationLotResult = await client.query(`
      INSERT INTO inventory_lots (sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved, expiration_date)
      VALUES ($1, $2, $3, $4, 0, $5)
      RETURNING id, sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved, expiration_date
    `, [source.sku_id, destinationLocationId, source.lot_number, quantity, source.expiration_date]);
    destinationLot = insertedDestinationLotResult.rows[0];
  }

  const sourceLotResult = await client.query(`
    UPDATE inventory_lots
    SET quantity_on_hand = quantity_on_hand - $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING id, sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved, expiration_date
  `, [quantity, inventoryLotId]);

  const movementResult = await client.query(`
    INSERT INTO stock_movements (
      company_id, sku_id, from_location_id, to_location_id, quantity,
      movement_type, reference_type, reference_id, performed_by_user_id, notes
    )
    VALUES ($1, $2, $3, $4, $5, 'move', 'inventory_lot', $6, $7, $8)
    RETURNING id, company_id, sku_id, from_location_id, to_location_id, quantity, movement_type, reference_type, reference_id, notes, created_at
  `, [
    source.company_id,
    source.sku_id,
    source.source_location_id,
    destinationLocationId,
    quantity,
    inventoryLotId,
    performedByUserId,
    notes
  ]);

  return {
    sku: {
      skuId: source.sku_id,
      sku: source.sku,
      name: source.sku_name
    },
    sourceLocation: {
      locationId: source.source_location_id,
      code: source.source_location_code,
      name: source.source_location_name,
      warehouseName: source.source_warehouse_name
    },
    destinationLocation: {
      locationId: destination.destination_location_id,
      code: destination.destination_location_code,
      name: destination.destination_location_name,
      warehouseName: destination.destination_warehouse_name,
      quantityOnHandAfterMove: destinationQuantityAfter,
      capacityUnits: destination.capacity_units
    },
    sourceLot: sourceLotResult.rows[0],
    destinationLot,
    movement: movementResult.rows[0]
  };
});

const reserveStock = async ({
  inventoryLotId,
  quantity,
  performedByUserId = null,
  notes
}) => withTransaction(async (client) => {
  const lotResult = await client.query(`
    SELECT
      il.id AS inventory_lot_id,
      il.sku_id,
      il.location_id,
      il.lot_number,
      il.quantity_on_hand,
      il.quantity_reserved,
      (il.quantity_on_hand - il.quantity_reserved)::int AS quantity_available,
      s.company_id,
      s.sku,
      s.name AS sku_name,
      sl.code AS location_code,
      sl.name AS location_name,
      w.name AS warehouse_name
    FROM inventory_lots il
    JOIN skus s ON s.id = il.sku_id
    JOIN storage_locations sl ON sl.id = il.location_id
    JOIN warehouses w ON w.id = sl.warehouse_id
    WHERE il.id = $1
    FOR UPDATE OF il
  `, [inventoryLotId]);

  if (lotResult.rowCount === 0) {
    throw badRequest('inventoryLotId does not exist');
  }

  const lot = lotResult.rows[0];
  if (Number(lot.quantity_available || 0) < quantity) {
    throw conflict(`Only ${lot.quantity_available} units are available to reserve from this lot`);
  }

  const updatedLotResult = await client.query(`
    UPDATE inventory_lots
    SET quantity_reserved = quantity_reserved + $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING id, sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved, expiration_date
  `, [quantity, inventoryLotId]);

  const movementResult = await client.query(`
    INSERT INTO stock_movements (
      company_id, sku_id, from_location_id, to_location_id, quantity,
      movement_type, reference_type, reference_id, performed_by_user_id, notes
    )
    VALUES ($1, $2, $3, NULL, $4, 'reserve', 'inventory_lot', $5, $6, $7)
    RETURNING id, company_id, sku_id, from_location_id, to_location_id, quantity, movement_type, reference_type, reference_id, notes, created_at
  `, [
    lot.company_id,
    lot.sku_id,
    lot.location_id,
    quantity,
    inventoryLotId,
    performedByUserId,
    notes
  ]);

  return {
    sku: {
      skuId: lot.sku_id,
      sku: lot.sku,
      name: lot.sku_name
    },
    location: {
      locationId: lot.location_id,
      code: lot.location_code,
      name: lot.location_name,
      warehouseName: lot.warehouse_name
    },
    lot: updatedLotResult.rows[0],
    reservedQuantity: quantity,
    movement: movementResult.rows[0]
  };
});

const releaseReservation = async ({
  inventoryLotId,
  quantity,
  performedByUserId = null,
  notes
}) => withTransaction(async (client) => {
  const lotResult = await client.query(`
    SELECT
      il.id AS inventory_lot_id,
      il.sku_id,
      il.location_id,
      il.lot_number,
      il.quantity_on_hand,
      il.quantity_reserved,
      s.company_id,
      s.sku,
      s.name AS sku_name,
      sl.code AS location_code,
      sl.name AS location_name,
      w.name AS warehouse_name
    FROM inventory_lots il
    JOIN skus s ON s.id = il.sku_id
    JOIN storage_locations sl ON sl.id = il.location_id
    JOIN warehouses w ON w.id = sl.warehouse_id
    WHERE il.id = $1
    FOR UPDATE OF il
  `, [inventoryLotId]);

  if (lotResult.rowCount === 0) {
    throw badRequest('inventoryLotId does not exist');
  }

  const lot = lotResult.rows[0];
  if (Number(lot.quantity_reserved || 0) < quantity) {
    throw conflict(`Only ${lot.quantity_reserved} units are reserved on this lot`);
  }

  const updatedLotResult = await client.query(`
    UPDATE inventory_lots
    SET quantity_reserved = quantity_reserved - $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING id, sku_id, location_id, lot_number, quantity_on_hand, quantity_reserved, expiration_date
  `, [quantity, inventoryLotId]);

  const movementResult = await client.query(`
    INSERT INTO stock_movements (
      company_id, sku_id, from_location_id, to_location_id, quantity,
      movement_type, reference_type, reference_id, performed_by_user_id, notes
    )
    VALUES ($1, $2, $3, NULL, $4, 'release_reservation', 'inventory_lot', $5, $6, $7)
    RETURNING id, company_id, sku_id, from_location_id, to_location_id, quantity, movement_type, reference_type, reference_id, notes, created_at
  `, [
    lot.company_id,
    lot.sku_id,
    lot.location_id,
    quantity,
    inventoryLotId,
    performedByUserId,
    notes
  ]);

  return {
    sku: {
      skuId: lot.sku_id,
      sku: lot.sku,
      name: lot.sku_name
    },
    location: {
      locationId: lot.location_id,
      code: lot.location_code,
      name: lot.location_name,
      warehouseName: lot.warehouse_name
    },
    lot: updatedLotResult.rows[0],
    releasedQuantity: quantity,
    movement: movementResult.rows[0]
  };
});

module.exports = {
  receiveStock,
  exportStock,
  moveStock,
  reserveStock,
  releaseReservation
};
