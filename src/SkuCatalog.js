import React, { useEffect, useState } from 'react';
import api from './api';
import './Dashboard.css';

const formatNumber = (value) => Number(value || 0).toLocaleString();
const categoryOptions = ['Apparel', 'Electronics', 'Food', 'Furniture', 'Home Goods', 'Tools'];

const SkuCatalog = () => {
  const [skus, setSkus] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSkus = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (categoryFilter !== 'all') params.set('category', categoryFilter);
        if (lowStockOnly) params.set('lowStock', 'true');

        const response = await api.get(`/api/v2/skus${params.toString() ? `?${params.toString()}` : ''}`);
        setSkus(response.data.data || []);
        setError(null);
      } catch (err) {
        console.error('SKU catalog error:', err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSkus();
  }, [categoryFilter, lowStockOnly]);

  const totalAvailable = skus.reduce((sum, sku) => sum + Number(sku.total_available || 0), 0);
  const lowStockCount = skus.filter((sku) => Number(sku.total_available || 0) <= Number(sku.reorder_point || 0)).length;

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading SKU catalog from PostgreSQL...</p>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <h2>Error Loading SKU Catalog</h2>
      <p>{error}</p>
    </div>
  );

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">PostgreSQL v2 API</p>
          <h1>SKU Catalog</h1>
          <p className="dashboard-subtitle">
            Searchable enterprise SKU read model with available inventory and reorder thresholds.
          </p>
        </div>
      </header>

      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>Visible SKUs</h3>
          <p>{skus.length}</p>
        </div>
        <div className="summary-card">
          <h3>Available Units</h3>
          <p>{formatNumber(totalAvailable)}</p>
        </div>
        <div className="summary-card">
          <h3>Low Stock</h3>
          <p>{lowStockCount}</p>
        </div>
      </div>

      <section className="inventory-section">
        <div className="section-heading-row">
          <div>
            <h2>Catalog Filters</h2>
            <p className="dashboard-subtitle">Filters call `/api/v2/skus` directly.</p>
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
            Category
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="inventory-section">
        <h2>SKU Inventory Position</h2>
        <div className="inventory-table-wrapper">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>On Hand</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Reorder Point</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {skus.map((sku) => {
                const available = Number(sku.total_available || 0);
                const reorderPoint = Number(sku.reorder_point || 0);
                const lowStock = available <= reorderPoint;

                return (
                  <tr key={sku.sku_id}>
                    <td>{sku.sku}</td>
                    <td>{sku.name}</td>
                    <td>{sku.category}</td>
                    <td>{formatNumber(sku.total_on_hand)}</td>
                    <td>{formatNumber(sku.total_reserved)}</td>
                    <td>{formatNumber(available)}</td>
                    <td>{formatNumber(reorderPoint)}</td>
                    <td>
                      <span className={`status-pill ${lowStock ? 'status-warning' : 'status-ok'}`}>
                        {lowStock ? 'Reorder' : 'Healthy'}
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

export default SkuCatalog;
