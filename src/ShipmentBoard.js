import React, { useEffect, useState } from 'react';
import api from './api';
import './Dashboard.css';

const formatNumber = (value) => Number(value || 0).toLocaleString();

const getProgress = (shipment) => {
  const total = Number(shipment.total_quantity || 0);
  if (total === 0) return 0;

  const processed = shipment.shipment_type === 'inbound'
    ? Number(shipment.total_received_quantity || 0)
    : Number(shipment.total_exported_quantity || 0);

  return Math.min(100, Math.round((processed / total) * 100));
};

const ShipmentBoard = () => {
  const [shipments, setShipments] = useState([]);
  const [shipmentType, setShipmentType] = useState('all');
  const [status, setStatus] = useState('all');
  const [expandedShipmentId, setExpandedShipmentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchShipments = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ limit: '25' });
        if (shipmentType !== 'all') params.set('shipmentType', shipmentType);
        if (status !== 'all') params.set('status', status);

        const response = await api.get(`/api/v2/shipments?${params.toString()}`);
        setShipments(response.data.data || []);
        setError(null);
      } catch (err) {
        console.error('Shipment board error:', err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchShipments();
  }, [shipmentType, status]);

  const inboundCount = shipments.filter((shipment) => shipment.shipment_type === 'inbound').length;
  const outboundCount = shipments.filter((shipment) => shipment.shipment_type === 'outbound').length;
  const openCount = shipments.filter((shipment) => !['completed', 'cancelled'].includes(shipment.status)).length;

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading shipment board from PostgreSQL...</p>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <h2>Error Loading Shipment Board</h2>
      <p>{error}</p>
    </div>
  );

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">PostgreSQL v2 API</p>
          <h1>Shipment Board</h1>
          <p className="dashboard-subtitle">
            Inbound and outbound shipment summaries with line-level receive/export progress.
          </p>
        </div>
      </header>

      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>Visible Shipments</h3>
          <p>{shipments.length}</p>
        </div>
        <div className="summary-card">
          <h3>Inbound</h3>
          <p>{inboundCount}</p>
        </div>
        <div className="summary-card">
          <h3>Outbound</h3>
          <p>{outboundCount}</p>
        </div>
        <div className="summary-card">
          <h3>Open</h3>
          <p>{openCount}</p>
        </div>
      </div>

      <section className="inventory-section">
        <div className="section-heading-row">
          <div>
            <h2>Shipment Filters</h2>
            <p className="dashboard-subtitle">Filters call `/api/v2/shipments` directly.</p>
          </div>
        </div>

        <div className="filter-bar">
          <label>
            Type
            <select value={shipmentType} onChange={(event) => setShipmentType(event.target.value)}>
              <option value="all">All types</option>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
      </section>

      <section className="inventory-section">
        <h2>Shipment Queue</h2>
        <div className="shipment-board-list">
          {shipments.map((shipment) => {
            const progress = getProgress(shipment);
            const isExpanded = expandedShipmentId === shipment.shipment_id;

            return (
              <article key={shipment.shipment_id} className="shipment-card">
                <button
                  className="shipment-card-main"
                  type="button"
                  onClick={() => setExpandedShipmentId(isExpanded ? null : shipment.shipment_id)}
                >
                  <div>
                    <span className={`movement-type movement-${shipment.shipment_type === 'inbound' ? 'receive' : 'export'}`}>
                      {shipment.shipment_type}
                    </span>
                    <h3>{shipment.shipment_number}</h3>
                    <p>{shipment.supplier_or_customer || 'No counterparty listed'}</p>
                  </div>
                  <div>
                    <span className={`status-pill ${shipment.status === 'completed' ? 'status-ok' : 'status-warning'}`}>
                      {shipment.status.replace('_', ' ')}
                    </span>
                    <p className="shipment-meta">Expected {shipment.expected_date || 'TBD'}</p>
                  </div>
                  <div className="shipment-progress-block">
                    <strong>{progress}%</strong>
                    <div className="capacity-bar">
                      <div className="fill-level" style={{ width: `${progress}%` }} />
                    </div>
                    <small>{formatNumber(shipment.total_quantity)} total units</small>
                  </div>
                </button>

                {isExpanded && (
                  <div className="shipment-lines">
                    {shipment.lines.map((line) => (
                      <div key={line.shipmentLineId} className="shipment-line-row">
                        <div>
                          <strong>{line.sku}</strong>
                          <p>{line.skuName}</p>
                        </div>
                        <span>Qty {formatNumber(line.quantity)}</span>
                        <span>Received {formatNumber(line.receivedQuantity)}</span>
                        <span>Exported {formatNumber(line.exportedQuantity)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default ShipmentBoard;
