import React, { useState, useEffect } from 'react';
import api from './api';
import './Dashboard.css';

const formatNumber = (value) => Number(value || 0).toLocaleString();

const Dashboard = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [skus, setSkus] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(false);

  useEffect(() => {
    const fetchEnterpriseInventory = async () => {
      try {
        setLoading(true);
        const [warehousesResponse, skusResponse, inventoryResponse, movementsResponse] = await Promise.all([
          api.get('/api/v2/warehouses'),
          api.get('/api/v2/skus'),
          api.get('/api/v2/inventory'),
          api.get('/api/v2/stock-movements?limit=6')
        ]);

        const recommendationsResponse = await api
          .get('/api/v2/storage-recommendations')
          .catch((recommendationsError) => {
            console.warn('Storage recommendations unavailable:', recommendationsError.message);
            return { data: { data: [] } };
          });

        setWarehouses(warehousesResponse.data.data || []);
        setSkus(skusResponse.data.data || []);
        setInventory(inventoryResponse.data.data || []);
        setMovements(movementsResponse.data.data || []);
        setRecommendations(recommendationsResponse.data.data || []);
        setError(null);
      } catch (err) {
        console.error('API Error:', err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEnterpriseInventory();
  }, [reload]);

  const totalCapacity = warehouses.reduce((sum, warehouse) => sum + Number(warehouse.total_capacity_units || 0), 0);
  const totalOnHand = inventory.reduce((sum, lot) => sum + Number(lot.quantity_on_hand || 0), 0);
  const totalAvailable = inventory.reduce((sum, lot) => sum + Number(lot.quantity_available || 0), 0);
  const lowStockSkus = skus.filter((sku) => Number(sku.total_available || 0) <= Number(sku.reorder_point || 0));

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading PostgreSQL inventory data...</p>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <h2>Error Loading Data</h2>
      <p>{error}</p>
      <p className="error-hint">
        Make sure the Render API is awake and Vercel has REACT_APP_API_BASE_URL set to the Render backend URL.
      </p>
      <button onClick={() => setReload(prev => !prev)} className="retry-button">
        Retry
      </button>
    </div>
  );

  return (
    <div className="dashboard-container">
      {lowStockSkus.length > 0 && (
        <div className="alert-banner">
          <div className="alert-content">
            <span className="alert-icon">⚠️</span>
            <span>
              Low Stock Alert: {lowStockSkus.length} SKU{lowStockSkus.length !== 1 ? 's' : ''} at or below reorder point
            </span>
          </div>
        </div>
      )}

      <header className="dashboard-header">
        <div>
          <p className="eyebrow">PostgreSQL v2 API</p>
          <h1>Enterprise Inventory Dashboard</h1>
          <p className="dashboard-subtitle">
            Live data from the Render backend and Neon PostgreSQL database.
          </p>
        </div>
        <div className="header-actions">
          <button onClick={() => setReload(prev => !prev)} className="secondary-button">
            Refresh Data
          </button>
        </div>
      </header>

      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>Warehouses</h3>
          <p>{warehouses.length}</p>
        </div>
        <div className="summary-card">
          <h3>SKUs</h3>
          <p>{skus.length}</p>
        </div>
        <div className="summary-card">
          <h3>On Hand</h3>
          <p>{formatNumber(totalOnHand)} units</p>
        </div>
        <div className="summary-card">
          <h3>Available</h3>
          <p>{formatNumber(totalAvailable)} units</p>
        </div>
        <div className="summary-card">
          <h3>Total Capacity</h3>
          <p>{formatNumber(totalCapacity)} units</p>
        </div>
      </div>

      <section className="storage-visualization">
        <h2>Warehouse Capacity</h2>
        <div className="shelves-grid">
          {warehouses.map((warehouse) => {
            const percentFull = Number(warehouse.percent_full || 0);
            const color = percentFull >= 80 ? '#F44336' : percentFull >= 60 ? '#FF9800' : '#3b82f6';

            return (
              <div key={warehouse.warehouse_id} className="shelf-card enterprise-card">
                <div className="shelf-header">
                  <h3>{warehouse.warehouse_name}</h3>
                  <span className="shelf-status" style={{ color }}>
                    {percentFull.toFixed(2)}% Full
                  </span>
                </div>
                <p className="card-meta">{warehouse.company_name}</p>
                <div className="capacity-bar">
                  <div
                    className="fill-level"
                    style={{ width: `${Math.min(percentFull, 100)}%`, backgroundColor: color }}
                  />
                </div>
                <div className="shelf-meta">
                  <span>{formatNumber(warehouse.total_quantity_on_hand)} on hand</span>
                  <span>{formatNumber(warehouse.total_capacity_units)} capacity</span>
                </div>
                <div className="shelf-meta">
                  <span>{warehouse.location_count} locations</span>
                  <span>{warehouse.warehouse_status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="recommendations-section">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Rule-based engine</p>
            <h2>Storage Recommendations</h2>
          </div>
          <span className="recommendation-count">{recommendations.length} active</span>
        </div>

        {recommendations.length === 0 ? (
          <div className="empty-state-card">
            No capacity, reorder, or expiration recommendations right now.
          </div>
        ) : (
          <div className="recommendations-grid">
            {recommendations.slice(0, 6).map((recommendation, index) => (
              <article key={`${recommendation.type}-${index}`} className="recommendation-card">
                <div className="recommendation-card-header">
                  <span className={`recommendation-type recommendation-${recommendation.type}`}>
                    {recommendation.type}
                  </span>
                  <span className={`priority-pill priority-${recommendation.priority}`}>
                    {recommendation.priority}
                  </span>
                </div>
                <h3>{recommendation.title}</h3>
                <p>{recommendation.action}</p>
                <small>{recommendation.reason}</small>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="inventory-section">
        <h2>Current Inventory by Location</h2>
        <div className="inventory-table-wrapper">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item</th>
                <th>Warehouse</th>
                <th>Location</th>
                <th>Lot</th>
                <th>On Hand</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((lot) => (
                <tr key={lot.inventory_lot_id} onClick={() => setSelectedInventory(lot)}>
                  <td>{lot.sku}</td>
                  <td>{lot.sku_name}</td>
                  <td>{lot.warehouse_name}</td>
                  <td>{lot.location_code}</td>
                  <td>{lot.lot_number}</td>
                  <td>{formatNumber(lot.quantity_on_hand)}</td>
                  <td>{formatNumber(lot.quantity_available)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="movement-section">
        <h2>Recent Stock Movements</h2>
        <div className="movement-list">
          {movements.map((movement) => (
            <div key={movement.stock_movement_id} className="movement-card">
              <span className={`movement-type movement-${movement.movement_type}`}>{movement.movement_type}</span>
              <div>
                <strong>{movement.sku}</strong> — {formatNumber(movement.quantity)} units
                <p>{movement.notes || 'No notes'}</p>
              </div>
              <span className="movement-user">{movement.performed_by_user_name}</span>
            </div>
          ))}
        </div>
      </section>

      {selectedInventory && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-content">
              <div className="modal-header">
                <h2>{selectedInventory.sku}</h2>
                <button
                  className="modal-close"
                  onClick={() => setSelectedInventory(null)}
                  aria-label="Close modal"
                >
                  &times;
                </button>
              </div>

              <div className="modal-body">
                <div className="shelf-stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Name:</span>
                    <span className="stat-value">{selectedInventory.sku_name}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Category:</span>
                    <span className="stat-value">{selectedInventory.category}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Warehouse:</span>
                    <span className="stat-value">{selectedInventory.warehouse_name}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Location:</span>
                    <span className="stat-value">{selectedInventory.location_code}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Lot:</span>
                    <span className="stat-value">{selectedInventory.lot_number}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Reserved:</span>
                    <span className="stat-value">{formatNumber(selectedInventory.quantity_reserved)} units</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
