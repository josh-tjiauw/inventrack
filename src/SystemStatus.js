import React, { useEffect, useState } from 'react';
import api, { apiBaseUrl } from './api';
import './Dashboard.css';

const endpointChecks = [
  { label: 'Warehouses', path: '/api/v2/warehouses' },
  { label: 'Storage Locations', path: '/api/v2/storage-locations' },
  { label: 'SKUs', path: '/api/v2/skus' },
  { label: 'Inventory', path: '/api/v2/inventory' },
  { label: 'Shipments', path: '/api/v2/shipments?limit=5' },
  { label: 'Movements', path: '/api/v2/stock-movements?limit=5' },
  { label: 'Recommendations', path: '/api/v2/storage-recommendations' }
];

const formatCheckedAt = (value) => {
  if (!value) return 'Not checked';
  return new Date(value).toLocaleString();
};

const SystemStatus = () => {
  const [status, setStatus] = useState(null);
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const runChecks = async () => {
    try {
      setLoading(true);
      setError(null);

      const [legacyHealth, postgresHealth, endpointResults] = await Promise.all([
        api.get('/api/health'),
        api.get('/api/v2/health'),
        Promise.allSettled(endpointChecks.map((check) => api.get(check.path)))
      ]);

      setStatus({
        legacyHealth: legacyHealth.data,
        postgresHealth: postgresHealth.data,
        checkedAt: new Date().toISOString()
      });

      setChecks(endpointResults.map((result, index) => {
        const check = endpointChecks[index];
        if (result.status === 'fulfilled') {
          const payload = result.value.data;
          return {
            ...check,
            ok: true,
            count: Array.isArray(payload.data) ? payload.data.length : null,
            message: 'OK'
          };
        }

        return {
          ...check,
          ok: false,
          count: null,
          message: result.reason?.response?.data?.message || result.reason?.message || 'Request failed'
        };
      }));
    } catch (err) {
      console.error('System status error:', err);
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runChecks();
  }, []);

  const healthyEndpointCount = checks.filter((check) => check.ok).length;
  const postgresCounts = status?.postgresHealth?.counts || {};

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Checking Inventrack deployment health...</p>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <h2>System Status Check Failed</h2>
      <p>{error}</p>
      <p className="error-hint">The Render backend may be waking up. Try again in a few seconds.</p>
      <button onClick={runChecks} className="retry-button">Retry Checks</button>
    </div>
  );

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Deployment diagnostics</p>
          <h1>System Status</h1>
          <p className="dashboard-subtitle">
            Live health checks for the Vercel frontend configuration, Render backend, and Neon PostgreSQL read API.
          </p>
        </div>
        <div className="header-actions">
          <button onClick={runChecks} className="secondary-button">Run Checks</button>
        </div>
      </header>

      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>API Base URL</h3>
          <p className="summary-card-text">{apiBaseUrl}</p>
        </div>
        <div className="summary-card">
          <h3>Backend Mode</h3>
          <p>{status?.legacyHealth?.mode || 'unknown'}</p>
        </div>
        <div className="summary-card">
          <h3>PostgreSQL</h3>
          <p>{status?.legacyHealth?.postgres?.status || status?.postgresHealth?.status || 'unknown'}</p>
        </div>
        <div className="summary-card">
          <h3>v2 Endpoints</h3>
          <p>{healthyEndpointCount}/{checks.length} OK</p>
        </div>
      </div>

      <section className="inventory-section">
        <div className="section-heading-row">
          <div>
            <h2>Database Counts</h2>
            <p className="dashboard-subtitle">From `/api/v2/health`, useful for quick demo validation.</p>
          </div>
          <span className="recommendation-count">Checked {formatCheckedAt(status?.checkedAt)}</span>
        </div>

        <div className="status-grid">
          {Object.entries(postgresCounts).map(([name, count]) => (
            <div key={name} className="status-card">
              <span>{name.replaceAll('_', ' ')}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="inventory-section">
        <h2>v2 Endpoint Smoke Checks</h2>
        <div className="status-check-list">
          {checks.map((check) => (
            <div key={check.path} className="status-check-row">
              <div>
                <strong>{check.label}</strong>
                <p>{check.path}</p>
              </div>
              <span>{check.count !== null ? `${check.count} rows` : check.message}</span>
              <span className={`status-pill ${check.ok ? 'status-ok' : 'status-warning'}`}>
                {check.ok ? 'OK' : 'Fail'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SystemStatus;
