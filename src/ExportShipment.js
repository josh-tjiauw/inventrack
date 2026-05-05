import React, { useEffect, useMemo, useState } from 'react';
import api from './api';
import './ExportShipment.css';
import './Dashboard.css';

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatDate = (value) => value ? new Date(value).toLocaleDateString() : 'No expiration';

const sortLotsForPicking = (a, b) => {
  const aExpiration = a.expiration_date ? new Date(a.expiration_date).getTime() : Number.MAX_SAFE_INTEGER;
  const bExpiration = b.expiration_date ? new Date(b.expiration_date).getTime() : Number.MAX_SAFE_INTEGER;
  return aExpiration - bExpiration || String(a.location_code).localeCompare(String(b.location_code));
};

const ExportShipment = () => {
  const [inventory, setInventory] = useState([]);
  const [skus, setSkus] = useState([]);
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchExportPlanningData = async () => {
      try {
        setLoading(true);
        const [inventoryResponse, skuResponse] = await Promise.all([
          api.get('/api/v2/inventory'),
          api.get('/api/v2/skus')
        ]);

        setInventory(inventoryResponse.data.data || []);
        setSkus(skuResponse.data.data || []);
        setError(null);
      } catch (err) {
        console.error('Export planning error:', err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchExportPlanningData();
  }, []);

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
            Plan outbound picking from live lot-level inventory using FEFO-style expiration priority. Write endpoints are intentionally not called yet.
          </p>
        </div>
      </header>

      <section className="inventory-section">
        <div className="filter-bar export-filter-grid">
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

      {selectedSku && (
        <div className={isFullyAllocated ? 'success-message' : 'error-message'}>
          {isFullyAllocated
            ? `Pick plan can fulfill ${formatNumber(requestedQuantity)} units${destination ? ` for ${destination}` : ''}.`
            : `Only ${formatNumber(plannedQuantity)} units are available to plan; shortage is ${formatNumber(shortage)} units.`}
        </div>
      )}

      <section className="inventory-section">
        <div className="section-heading-row">
          <div>
            <h2>Generated Pick Plan</h2>
            <p className="dashboard-subtitle">Lots are prioritized by earliest expiration date, then location code.</p>
          </div>
          <button className="submit-button export-disabled-button" disabled>
            Write endpoint pending
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
