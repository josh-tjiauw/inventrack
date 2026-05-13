import React, { useEffect, useMemo, useState } from 'react';
import api from './api';
import './ExportShipment.css';
import './Dashboard.css';

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatDate = (value) => value ? new Date(value).toLocaleDateString() : 'No expiration';

const getLineRemaining = (line) => Math.max(0, Number(line.quantity || 0) - Number(line.exportedQuantity || 0));

const sortLotsForPicking = (a, b) => {
  const aExpiration = a.expiration_date ? new Date(a.expiration_date).getTime() : Number.MAX_SAFE_INTEGER;
  const bExpiration = b.expiration_date ? new Date(b.expiration_date).getTime() : Number.MAX_SAFE_INTEGER;
  return aExpiration - bExpiration || String(a.location_code).localeCompare(String(b.location_code));
};

const ExportShipment = () => {
  const [inventory, setInventory] = useState([]);
  const [skus, setSkus] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState('manual');
  const [selectedShipmentLineId, setSelectedShipmentLineId] = useState('');
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState(null);

  const fetchExportPlanningData = async () => {
    const [inventoryResponse, skuResponse, shipmentResponse] = await Promise.all([
      api.get('/api/v2/inventory'),
      api.get('/api/v2/skus'),
      api.get('/api/v2/shipments?shipmentType=outbound&limit=100')
    ]);

    setInventory(inventoryResponse.data.data || []);
    setSkus(skuResponse.data.data || []);
    setShipments(shipmentResponse.data.data || []);
  };

  useEffect(() => {
    const loadExportPlanningData = async () => {
      try {
        setLoading(true);
        await fetchExportPlanningData();
        setError(null);
      } catch (err) {
        console.error('Export planning error:', err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    loadExportPlanningData();
  }, []);

  const openOutboundShipments = shipments.filter((shipment) => (
    Array.isArray(shipment.lines) && shipment.lines.some((line) => getLineRemaining(line) > 0)
  ));
  const selectedShipment = openOutboundShipments.find((shipment) => String(shipment.shipment_id) === String(selectedShipmentId));
  const availableShipmentLines = selectedShipment?.lines?.filter((line) => getLineRemaining(line) > 0) || [];
  const selectedShipmentLine = availableShipmentLines.find((line) => String(line.shipmentLineId) === String(selectedShipmentLineId));
  const selectedSku = skus.find((sku) => String(sku.sku_id) === String(selectedSkuId));
  const requestedQuantity = Math.max(1, Number(quantity || 0));

  const pickPlan = useMemo(() => {
    if (!selectedSku) return [];

    let remaining = requestedQuantity;
    return inventory
      .filter((lot) => String(lot.sku_id) === String(selectedSku.sku_id) && Number(lot.quantity_available || 0) > 0)
      .sort(sortLotsForPicking)
      .map((lot) => {
        const available = Number(lot.quantity_available || 0);
        const pickQuantity = Math.min(available, remaining);
        remaining = Math.max(0, remaining - pickQuantity);
        return {
          ...lot,
          pickQuantity,
          availableAfterPick: available - pickQuantity
        };
      })
      .filter((lot) => lot.pickQuantity > 0);
  }, [inventory, requestedQuantity, selectedSku]);

  const availableForSku = selectedSku ? Number(selectedSku.total_available || 0) : 0;
  const plannedQuantity = pickPlan.reduce((sum, lot) => sum + lot.pickQuantity, 0);
  const isFullyAllocated = selectedSku && plannedQuantity >= requestedQuantity;
  const shortage = Math.max(0, requestedQuantity - plannedQuantity);

  const handleShipmentChange = (shipmentId) => {
    setSelectedShipmentId(shipmentId);
    setSelectedShipmentLineId('');

    if (shipmentId === 'manual') return;

    const shipment = openOutboundShipments.find((item) => String(item.shipment_id) === String(shipmentId));
    const firstOpenLine = shipment?.lines?.find((line) => getLineRemaining(line) > 0);
    if (firstOpenLine) {
      setSelectedShipmentLineId(String(firstOpenLine.shipmentLineId));
      setSelectedSkuId(String(firstOpenLine.skuId));
      setQuantity(getLineRemaining(firstOpenLine));
      setDestination(shipment.supplier_or_customer || shipment.shipment_number || 'Shipment export');
    }
  };

  const handleShipmentLineChange = (shipmentLineId) => {
    setSelectedShipmentLineId(shipmentLineId);
    const line = availableShipmentLines.find((item) => String(item.shipmentLineId) === String(shipmentLineId));
    if (line) {
      setSelectedSkuId(String(line.skuId));
      setQuantity(getLineRemaining(line));
    }
  };

  const handleExportStock = async () => {
    if (!selectedSku || !isFullyAllocated) return;

    try {
      setSubmitting(true);
      setSuccessMessage('');
      setError(null);

      const response = await api.post('/api/v2/export-stock', {
        skuId: selectedSku.sku_id,
        quantity: requestedQuantity,
        destination: destination || 'Manual export',
        shipmentLineId: selectedShipmentLine ? selectedShipmentLine.shipmentLineId : undefined
      });

      const exported = response.data.data;
      setSuccessMessage(`Exported ${formatNumber(exported.exportedQuantity)} units of ${selectedSku.sku} across ${exported.picks.length} lot(s).`);
      await fetchExportPlanningData();
    } catch (err) {
      console.error('Export stock error:', err);
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading PostgreSQL export planner...</p>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <h2>Error Loading Export Planner</h2>
      <p>{error}</p>
      <p className="error-hint">The planner uses `/api/v2/inventory` and `/api/v2/skus`.</p>
    </div>
  );

  return (
    <div className="export-shipment-container dashboard-container">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">PostgreSQL v2 API</p>
          <h1>Export Shipment Planner</h1>
          <p className="dashboard-subtitle">
            Plan and commit outbound picking from live lot-level inventory using FEFO-style expiration priority.
          </p>
        </div>
      </header>

      <section className="inventory-section">
        <div className="filter-bar export-filter-grid">
          <label>
            Outbound Shipment
            <select value={selectedShipmentId} onChange={(event) => handleShipmentChange(event.target.value)}>
              <option value="manual">Manual export / no shipment line</option>
              {openOutboundShipments.map((shipment) => (
                <option key={shipment.shipment_id} value={shipment.shipment_id}>
                  {shipment.shipment_number} — {shipment.supplier_or_customer || 'Outbound shipment'} ({formatNumber(shipment.total_quantity - shipment.total_exported_quantity)} remaining)
                </option>
              ))}
            </select>
          </label>
          {selectedShipment && (
            <label>
              Outbound Shipment Line
              <select value={selectedShipmentLineId} onChange={(event) => handleShipmentLineChange(event.target.value)}>
                <option value="">Select a shipment line</option>
                {availableShipmentLines.map((line) => {
                  const remaining = getLineRemaining(line);
                  const exported = Number(line.exportedQuantity || 0);
                  const progress = Number(line.quantity || 0) ? (exported / Number(line.quantity)) * 100 : 0;
                  return (
                    <option key={line.shipmentLineId} value={line.shipmentLineId}>
                      {line.sku} — {formatNumber(remaining)} remaining of {formatNumber(line.quantity)} ({progress.toFixed(0)}% exported)
                    </option>
                  );
                })}
              </select>
            </label>
          )}
          <label>
            Outbound SKU
            <select value={selectedSkuId} onChange={(event) => setSelectedSkuId(event.target.value)}>
              <option value="">Select a SKU</option>
              {skus.map((sku) => (
                <option key={sku.sku_id} value={sku.sku_id}>
                  {sku.sku} — {sku.name} ({formatNumber(sku.total_available)} available)
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantity to export
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <label>
            Destination / Customer
            <input
              type="text"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="e.g., Customer DC-14"
            />
          </label>
        </div>
      </section>

      {selectedSku && (
        <div className="dashboard-summary">
          <div className="summary-card">
            <h3>Selected SKU</h3>
            <p>{selectedSku.sku}</p>
          </div>
          <div className="summary-card">
            <h3>Requested</h3>
            <p>{formatNumber(requestedQuantity)}</p>
          </div>
          <div className="summary-card">
            <h3>Available</h3>
            <p>{formatNumber(availableForSku)}</p>
          </div>
          <div className="summary-card">
            <h3>Planned</h3>
            <p>{formatNumber(plannedQuantity)}</p>
          </div>
          <div className="summary-card">
            <h3>Status</h3>
            <p>{isFullyAllocated ? 'Ready' : 'Short'}</p>
          </div>
        </div>
      )}

      {selectedShipmentLine && (
        <section className="inventory-section">
          <h2>Outbound Line Progress</h2>
          <div className="dashboard-summary">
            <div className="summary-card">
              <h3>Shipment</h3>
              <p>{selectedShipment.shipment_number}</p>
            </div>
            <div className="summary-card">
              <h3>Exported</h3>
              <p>{formatNumber(selectedShipmentLine.exportedQuantity)}</p>
            </div>
            <div className="summary-card">
              <h3>Remaining</h3>
              <p>{formatNumber(getLineRemaining(selectedShipmentLine))}</p>
            </div>
            <div className="summary-card">
              <h3>Ordered</h3>
              <p>{formatNumber(selectedShipmentLine.quantity)}</p>
            </div>
          </div>
        </section>
      )}

      {selectedSku && (
        <div className={isFullyAllocated ? 'success-message' : 'error-message'}>
          {isFullyAllocated
            ? `${selectedShipmentLine ? 'Shipment-line' : 'Manual'} pick plan can fulfill ${formatNumber(requestedQuantity)} units${destination ? ` for ${destination}` : ''}.`
            : `Only ${formatNumber(plannedQuantity)} units are available to plan; shortage is ${formatNumber(shortage)} units.`}
        </div>
      )}

      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      <section className="inventory-section">
        <div className="section-heading-row">
          <div>
            <h2>Generated Pick Plan</h2>
            <p className="dashboard-subtitle">Lots are prioritized by earliest expiration date, then location code.</p>
          </div>
          <button
            className="submit-button"
            onClick={handleExportStock}
            disabled={!isFullyAllocated || submitting}
          >
            {submitting ? 'Exporting...' : 'Commit export'}
          </button>
        </div>

        {!selectedSku ? (
          <div className="empty-state-card">Choose a SKU to generate a pick plan.</div>
        ) : pickPlan.length === 0 ? (
          <div className="empty-state-card">No available inventory lots found for this SKU.</div>
        ) : (
          <div className="inventory-table-wrapper">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Pick Qty</th>
                  <th>SKU</th>
                  <th>Warehouse</th>
                  <th>Location</th>
                  <th>Lot</th>
                  <th>Expires</th>
                  <th>Available Before</th>
                  <th>Available After</th>
                </tr>
              </thead>
              <tbody>
                {pickPlan.map((lot) => (
                  <tr key={lot.inventory_lot_id}>
                    <td>{formatNumber(lot.pickQuantity)}</td>
                    <td>{lot.sku}</td>
                    <td>{lot.warehouse_name}</td>
                    <td>{lot.location_code}</td>
                    <td>{lot.lot_number || '—'}</td>
                    <td>{formatDate(lot.expiration_date)}</td>
                    <td>{formatNumber(lot.quantity_available)}</td>
                    <td>{formatNumber(lot.availableAfterPick)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default ExportShipment;
