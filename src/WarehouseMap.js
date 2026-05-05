import React, { useEffect, useMemo, useState } from 'react';
import api from './api';
import './Dashboard.css';

const formatNumber = (value) => Number(value || 0).toLocaleString();

const getCapacityColor = (percentFull) => {
  if (percentFull >= 90) return '#dc2626';
  if (percentFull >= 70) return '#f59e0b';
  return '#2563eb';
};

const WarehouseMap = () => {
  const [locations, setLocations] = useState([]);
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (warehouseFilter !== 'all') params.set('warehouseId', warehouseFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);

        const response = await api.get(`/api/v2/storage-locations${params.toString() ? `?${params.toString()}` : ''}`);
        setLocations(response.data.data || []);
        setError(null);
      } catch (err) {
        console.error('Warehouse map error:', err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, [warehouseFilter, statusFilter]);

  const warehouses = useMemo(() => {
    const unique = new Map();
    locations.forEach((location) => {
      unique.set(location.warehouse_id, location.warehouse_name);
    });
    return Array.from(unique.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [locations]);

  const totalCapacity = locations.reduce((sum, location) => sum + Number(location.capacity_units || 0), 0);
  const totalOnHand = locations.reduce((sum, location) => sum + Number(location.quantity_on_hand || 0), 0);
  const maintenanceCount = locations.filter((location) => location.location_status === 'maintenance').length;
  const activeCount = locations.filter((location) => location.location_status === 'active').length;

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading warehouse location map from PostgreSQL...</p>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <h2>Error Loading Warehouse Map</h2>
      <p>{error}</p>
    </div>
  );

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">PostgreSQL v2 API</p>
          <h1>Warehouse Location Map</h1>
          <p className="dashboard-subtitle">
            Storage-location capacity, status, SKU mix, and available quantity across warehouses.
          </p>
        </div>
      </header>

      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>Locations</h3>
          <p>{locations.length}</p>
        </div>
        <div className="summary-card">
          <h3>Active</h3>
          <p>{activeCount}</p>
        </div>
        <div className="summary-card">
          <h3>Maintenance</h3>
          <p>{maintenanceCount}</p>
        </div>
        <div className="summary-card">
          <h3>On Hand</h3>
          <p>{formatNumber(totalOnHand)}</p>
        </div>
        <div className="summary-card">
          <h3>Capacity</h3>
          <p>{formatNumber(totalCapacity)}</p>
        </div>
      </div>

      <section className="inventory-section">
        <div className="section-heading-row">
          <div>
            <h2>Location Filters</h2>
            <p className="dashboard-subtitle">Filters call `/api/v2/storage-locations` directly.</p>
          </div>
        </div>

        <div className="filter-bar">
          <label>
            Warehouse
            <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)}>
              <option value="all">All warehouses</option>
              {warehouses.map(([warehouseId, warehouseName]) => (
                <option key={warehouseId} value={warehouseId}>{warehouseName}</option>
              ))}
            </select>
          </label>
          <label>
            Location Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
      </section>

      <section className="inventory-section">
        <h2>Storage Locations</h2>
        <div className="warehouse-map-grid">
          {locations.map((location) => {
            const percentFull = Number(location.percent_full || 0);
            const color = getCapacityColor(percentFull);

            return (
              <article key={location.location_id} className="warehouse-location-card">
                <div className="location-card-header">
                  <div>
                    <h3>{location.location_code}</h3>
                    <p>{location.location_name}</p>
                  </div>
                  <span className={`status-pill ${location.location_status === 'active' ? 'status-ok' : 'status-warning'}`}>
                    {location.location_status}
                  </span>
                </div>

                <p className="card-meta">{location.warehouse_name}</p>
                <div className="capacity-bar">
                  <div className="fill-level" style={{ width: `${Math.min(percentFull, 100)}%`, backgroundColor: color }} />
                </div>

                <div className="location-metrics">
                  <span>{percentFull.toFixed(2)}% full</span>
                  <span>{formatNumber(location.quantity_on_hand)} / {formatNumber(location.capacity_units)}</span>
                  <span>{formatNumber(location.quantity_available)} available</span>
                  <span>{location.sku_count} SKU{Number(location.sku_count) === 1 ? '' : 's'}</span>
                </div>

                <div className="location-type-pill">{location.location_type.replace('_', ' ')}</div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default WarehouseMap;
