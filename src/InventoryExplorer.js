import React, { useEffect, useMemo, useState } from 'react';
import api from './api';
import './Dashboard.css';

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatDate = (value) => value ? new Date(value).toLocaleDateString() : '—';

const InventoryExplorer = () => {
  const [inventory, setInventory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [skus, setSkus] = useState([]);
  const [warehouseId, setWarehouseId] = useState('all');
  const [skuId, setSkuId] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [warehouseResponse, skuResponse] = await Promise.all([
          api.get('/api/v2/warehouses'),
          api.get('/api/v2/skus')
        ]);
        setWarehouses(warehouseResponse.data.data || []);
        setSkus(skuResponse.data.data || []);
      } catch (err) {
        console.warn('Unable to load inventory filter metadata:', err.message);
      }
    };

    fetchFilters();
  }, []);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (warehouseId !== 'all') params.set('warehouseId', warehouseId);
        if (skuId !== 'all') params.set('skuId', skuId);
        if (lowStockOnly) params.set('lowStock', 'true');

        const response = await api.get(`/api/v2/inventory${params.toString() ? `?${params.toString()}` : ''}`);
        setInventory(response.data.data || []);
        setError(null);
      } catch (err) {
        console.error('Inventory explorer error:', err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, [warehouseId, skuId, lowStockOnly]);

  const totalOnHand = inventory.reduce((sum, lot) => sum + Number(lot.quantity_on_hand || 0), 0);
  const totalAvailable = inventory.reduce((sum, lot) => sum + Number(lot.quantity_available || 0), 0);
  const totalReserved = inventory.reduce((sum, lot) => sum + Number(lot.quantity_reserved || 0), 0);
  const lowStockLots = inventory.filter((lot) => Number(lot.quantity_available || 0) <= Number(lot.reorder_point || 0)).length;
  const categories = useMemo(() => new Set(inventory.map((lot) => lot.category)).size, [inventory]);

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading inventory explorer from PostgreSQL...</p>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <h2>Error Loading Inventory Explorer</h2>
      <p>{error}</p>
    </div>
  );

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">PostgreSQL v2 API</p>
          <h1>Inventory Explorer</h1>
          <p className="dashboard-subtitle">
            Lot-level inventory by warehouse location using `/api/v2/inventory` filters.
          </p>
        </div>
      </header>

      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>Lots</h3>
          <p>{inventory.length}</p>
        </div>
        <div className="summary-card">
          <h3>On Hand</h3>
          <p>{formatNumber(totalOnHand)}</p>
        </div>
        <div className="summary-card">
          <h3>Available</h3>
          <p>{formatNumber(totalAvailable)}</p>
        </div>
        <div className="summary-card">
          <h3>Reserved</h3>
          <p>{formatNumber(totalReserved)}</p>
        </div>
        <div className="summary-card">
          <h3>Low Stock Lots</h3>
          <p>{lowStockLots}</p>
        </div>
        <div className="summary-card">
          <h3>Categories</h3>
          <p>{categories}</p>
        </div>
      </div>

      <section className="inventory-section">
        <div className="section-heading-row">
          <div>
            <h2>Inventory Filters</h2>
            <p className="dashboard-subtitle">Filters call `/api/v2/inventory` directly.</p>
          </div>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(event) => setLowStockOnly(event.target.checked)}
            />
            Low stock only
          </label>
        </div>

        <div className="filter-bar">
          <label>
            Warehouse
            <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
              <option value="all">All warehouses</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.warehouse_id} value={warehouse.warehouse_id}>{warehouse.warehouse_name}</option>
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
        </div>
      </section>

      <section className="inventory-section">
        <h2>Lot-Level Inventory</h2>
        <div className="inventory-table-wrapper">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item</th>
                <th>Warehouse</th>
                <th>Location</th>
                <th>Lot</th>
                <th>Expires</th>
                <th>On Hand</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((lot) => {
                const lowStock = Number(lot.quantity_available || 0) <= Number(lot.reorder_point || 0);

                return (
                  <tr key={lot.inventory_lot_id}>
                    <td>{lot.sku}</td>
                    <td>{lot.sku_name}</td>
                    <td>{lot.warehouse_name}</td>
                    <td>{lot.location_code}</td>
                    <td>{lot.lot_number || '—'}</td>
                    <td>{formatDate(lot.expiration_date)}</td>
                    <td>{formatNumber(lot.quantity_on_hand)}</td>
                    <td>{formatNumber(lot.quantity_reserved)}</td>
                    <td>{formatNumber(lot.quantity_available)}</td>
                    <td>
                      <span className={`status-pill ${lowStock ? 'status-warning' : 'status-ok'}`}>
                        {lowStock ? 'Low' : 'OK'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default InventoryExplorer;
