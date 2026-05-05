import React, { useCallback, useEffect, useState } from 'react';
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

const newLine = () => ({ skuId: '', quantity: 1 });
const defaultShipmentNumber = (type = 'inbound') => `${type === 'inbound' ? 'IN' : 'OUT'}-${Date.now()}`;

const ShipmentBoard = () => {
  const [shipments, setShipments] = useState([]);
  const [skus, setSkus] = useState([]);
  const [shipmentType, setShipmentType] = useState('all');
  const [status, setStatus] = useState('all');
  const [expandedShipmentId, setExpandedShipmentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [draftShipment, setDraftShipment] = useState({
    shipmentNumber: defaultShipmentNumber('inbound'),
    shipmentType: 'inbound',
    status: 'scheduled',
    supplierOrCustomer: '',
    expectedDate: new Date().toISOString().slice(0, 10),
    lines: [newLine()]
  });

  const fetchShipments = useCallback(async () => {
    const params = new URLSearchParams({ limit: '25' });
    if (shipmentType !== 'all') params.set('shipmentType', shipmentType);
    if (status !== 'all') params.set('status', status);

    const response = await api.get(`/api/v2/shipments?${params.toString()}`);
    setShipments(response.data.data || []);
  }, [shipmentType, status]);

  useEffect(() => {
    const loadBoardData = async () => {
      try {
        setLoading(true);
        const [shipmentResponse, skuResponse] = await Promise.all([
          fetchShipments(),
          api.get('/api/v2/skus')
        ]);
        setSkus(skuResponse.data.data || []);
        setError(null);
        return shipmentResponse;
      } catch (err) {
        console.error('Shipment board error:', err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    loadBoardData();
  }, [fetchShipments]);

  const updateDraft = (field, value) => {
    setDraftShipment((prev) => ({ ...prev, [field]: value }));
  };

  const updateLine = (index, field, value) => {
    setDraftShipment((prev) => ({
      ...prev,
      lines: prev.lines.map((line, lineIndex) => (
        lineIndex === index ? { ...line, [field]: value } : line
      ))
    }));
  };

  const addLine = () => {
    setDraftShipment((prev) => ({ ...prev, lines: [...prev.lines, newLine()] }));
  };

  const removeLine = (index) => {
    setDraftShipment((prev) => ({
      ...prev,
      lines: prev.lines.length === 1 ? prev.lines : prev.lines.filter((_, lineIndex) => lineIndex !== index)
    }));
  };

  const handleCreateShipment = async (event) => {
    event.preventDefault();

    const lines = draftShipment.lines
      .filter((line) => line.skuId && Number(line.quantity || 0) > 0)
      .map((line) => ({ skuId: Number(line.skuId), quantity: Number(line.quantity) }));

    if (!draftShipment.shipmentNumber || lines.length === 0) {
      setError('Shipment number and at least one valid line are required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage('');

      const response = await api.post('/api/v2/shipments', {
        companyId: 1,
        shipmentNumber: draftShipment.shipmentNumber,
        shipmentType: draftShipment.shipmentType,
        status: draftShipment.status,
        supplierOrCustomer: draftShipment.supplierOrCustomer || 'Manual shipment',
        expectedDate: draftShipment.expectedDate || null,
        createdByUserId: 2,
        lines
      });

      setSuccessMessage(`Created shipment ${response.data.data.shipment_number} with ${response.data.data.lines.length} line(s).`);
      setDraftShipment((prev) => ({
        ...prev,
        shipmentNumber: defaultShipmentNumber(prev.shipmentType),
        supplierOrCustomer: '',
        lines: [newLine()]
      }));
      await fetchShipments();
    } catch (err) {
      console.error('Create shipment error:', err);
      setError(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const inboundCount = shipments.filter((shipment) => shipment.shipment_type === 'inbound').length;
  const outboundCount = shipments.filter((shipment) => shipment.shipment_type === 'outbound').length;
  const openCount = shipments.filter((shipment) => !['completed', 'cancelled'].includes(shipment.status)).length;

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading shipment board from PostgreSQL...</p>
    </div>
  );

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">PostgreSQL v2 API</p>
          <h1>Shipment Board</h1>
          <p className="dashboard-subtitle">
            Inbound and outbound shipment summaries with line-level receive/export progress and shipment creation.
          </p>
        </div>
      </header>

      {error && (
        <div className="error-message">{error}</div>
      )}
      {successMessage && (
        <div className="success-message">{successMessage}</div>
      )}

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
            <h2>Create Shipment</h2>
            <p className="dashboard-subtitle">Submits to transactional `POST /api/v2/shipments`.</p>
          </div>
        </div>

        <form onSubmit={handleCreateShipment} className="shipment-create-form">
          <div className="filter-bar shipment-create-grid">
            <label>
              Shipment #
              <input value={draftShipment.shipmentNumber} onChange={(event) => updateDraft('shipmentNumber', event.target.value)} />
            </label>
            <label>
              Type
              <select value={draftShipment.shipmentType} onChange={(event) => updateDraft('shipmentType', event.target.value)}>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </label>
            <label>
              Status
              <select value={draftShipment.status} onChange={(event) => updateDraft('status', event.target.value)}>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In progress</option>
              </select>
            </label>
            <label>
              Supplier / Customer
              <input value={draftShipment.supplierOrCustomer} onChange={(event) => updateDraft('supplierOrCustomer', event.target.value)} placeholder="Counterparty" />
            </label>
            <label>
              Expected Date
              <input type="date" value={draftShipment.expectedDate} onChange={(event) => updateDraft('expectedDate', event.target.value)} />
            </label>
          </div>

          <div className="shipment-lines-editor">
            {draftShipment.lines.map((line, index) => (
              <div key={`draft-line-${index}`} className="shipment-line-editor-row">
                <label>
                  SKU
                  <select value={line.skuId} onChange={(event) => updateLine(index, 'skuId', event.target.value)}>
                    <option value="">Select SKU</option>
                    {skus.map((sku) => (
                      <option key={sku.sku_id} value={sku.sku_id}>{sku.sku} — {sku.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity
                  <input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} />
                </label>
                <button type="button" className="secondary-button" onClick={() => removeLine(index)} disabled={draftShipment.lines.length === 1}>Remove</button>
              </div>
            ))}
          </div>

          <div className="header-actions">
            <button type="button" className="secondary-button" onClick={addLine}>Add Line</button>
            <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Creating...' : 'Create Shipment'}</button>
          </div>
        </form>
      </section>

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
