import React, { useEffect, useState } from 'react';
import api from './api';
import './Dashboard.css';

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatDateTime = (value) => value ? new Date(value).toLocaleString() : '—';
const movementTypes = ['receive', 'export', 'move', 'reserve', 'release_reservation', 'adjust', 'return', 'cycle_count'];

const MovementHistory = () => {
  const [movements, setMovements] = useState([]);
  const [skus, setSkus] = useState([]);
  const [movementType, setMovementType] = useState('all');
  const [skuId, setSkuId] = useState('all');
  const [limit, setLimit] = useState('25');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSkus = async () => {
      try {
        const response = await api.get('/api/v2/skus');
        setSkus(response.data.data || []);
      } catch (err) {
        console.warn('Unable to load SKU filter list:', err.message);
      }
    };

    fetchSkus();
  }, []);

  useEffect(() => {
    const fetchMovements = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ limit });
        if (movementType !== 'all') params.set('movementType', movementType);
        if (skuId !== 'all') params.set('skuId', skuId);

        const response = await api.get(`/api/v2/stock-movements?${params.toString()}`);
        setMovements(response.data.data || []);
        setError(null);
      } catch (err) {
        console.error('Movement history error:', err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMovements();
  }, [movementType, skuId, limit]);

  const totalQuantity = movements.reduce((sum, movement) => sum + Number(movement.quantity || 0), 0);
  const receiveCount = movements.filter((movement) => movement.movement_type === 'receive').length;
  const exportCount = movements.filter((movement) => movement.movement_type === 'export').length;

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading movement history from PostgreSQL...</p>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <h2>Error Loading Movement History</h2>
      <p>{error}</p>
    </div>
  );

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">PostgreSQL v2 API</p>
          <h1>Stock Movement History</h1>
          <p className="dashboard-subtitle">
            Audit-friendly inventory ledger using `/api/v2/stock-movements` with movement and SKU filters.
          </p>
        </div>
      </header>

      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>Visible Movements</h3>
          <p>{movements.length}</p>
        </div>
        <div className="summary-card">
          <h3>Total Units</h3>
          <p>{formatNumber(totalQuantity)}</p>
        </div>
        <div className="summary-card">
          <h3>Receives</h3>
          <p>{receiveCount}</p>
        </div>
        <div className="summary-card">
          <h3>Exports</h3>
          <p>{exportCount}</p>
        </div>
      </div>

      <section className="inventory-section">
        <div className="section-heading-row">
          <div>
            <h2>Ledger Filters</h2>
            <p className="dashboard-subtitle">Filters call `/api/v2/stock-movements` directly.</p>
          </div>
        </div>

        <div className="filter-bar">
          <label>
            Movement Type
            <select value={movementType} onChange={(event) => setMovementType(event.target.value)}>
              <option value="all">All movement types</option>
              {movementTypes.map((type) => (
                <option key={type} value={type}>{type.replace('_', ' ')}</option>
              ))}
            </select>
          </label>
          <label>
            SKU
            <select value={skuId} onChange={(event) => setSkuId(event.target.value)}>
              <option value="all">All SKUs</option>
              {skus.map((sku) => (
                <option key={sku.sku_id} value={sku.sku_id}>{sku.sku}</option>
              ))}
            </select>
          </label>
          <label>
            Limit
            <select value={limit} onChange={(event) => setLimit(event.target.value)}>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>
      </section>

      <section className="inventory-section">
        <h2>Ledger Rows</h2>
        <div className="inventory-table-wrapper">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>SKU</th>
                <th>Qty</th>
                <th>From</th>
                <th>To</th>
                <th>User</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.stock_movement_id}>
                  <td>{formatDateTime(movement.created_at)}</td>
                  <td>
                    <span className={`movement-type movement-${movement.movement_type}`}>
                      {movement.movement_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{movement.sku}</td>
                  <td>{formatNumber(movement.quantity)}</td>
                  <td>{movement.from_location_code || '—'}</td>
                  <td>{movement.to_location_code || '—'}</td>
                  <td>{movement.performed_by_user_name || '—'}</td>
                  <td>{movement.reference_type ? `${movement.reference_type} #${movement.reference_id}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default MovementHistory;
