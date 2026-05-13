import React, { useEffect, useMemo, useState } from 'react';
import api from './api';
import './ShipmentReceiver.css';

const formatNumber = (value) => Number(value || 0).toLocaleString();

const getLineRemaining = (line, direction) => {
  const completed = direction === 'inbound' ? line.receivedQuantity : line.exportedQuantity;
  return Math.max(0, Number(line.quantity || 0) - Number(completed || 0));
};

const ShipmentReceiver = () => {
  const [skus, setSkus] = useState([]);
  const [locations, setLocations] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState('manual');
  const [selectedShipmentLineId, setSelectedShipmentLineId] = useState('');
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [quantity, setQuantity] = useState(25);
  const [supplier, setSupplier] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingLocationId, setSubmittingLocationId] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState(null);

  const fetchReceivePlanningData = async () => {
    const [skuResponse, locationResponse, recommendationResponse, shipmentResponse] = await Promise.all([
      api.get('/api/v2/skus'),
      api.get('/api/v2/storage-locations?status=active'),
      api.get('/api/v2/storage-recommendations'),
      api.get('/api/v2/shipments?shipmentType=inbound&limit=100')
    ]);

    setSkus(skuResponse.data.data || []);
    setLocations(locationResponse.data.data || []);
    setRecommendations(recommendationResponse.data.data || []);
    setShipments(shipmentResponse.data.data || []);
  };

  useEffect(() => {
    const loadReceivePlanningData = async () => {
      try {
        setLoading(true);
        await fetchReceivePlanningData();
        setError(null);
      } catch (err) {
        console.error('Receive planning error:', err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    loadReceivePlanningData();
  }, []);

  const openInboundShipments = shipments.filter((shipment) => (
    Array.isArray(shipment.lines) && shipment.lines.some((line) => getLineRemaining(line, 'inbound') > 0)
  ));
  const selectedShipment = openInboundShipments.find((shipment) => String(shipment.shipment_id) === String(selectedShipmentId));
  const availableShipmentLines = selectedShipment?.lines?.filter((line) => getLineRemaining(line, 'inbound') > 0) || [];
  const selectedShipmentLine = availableShipmentLines.find((line) => String(line.shipmentLineId) === String(selectedShipmentLineId));
  const selectedSku = skus.find((sku) => String(sku.sku_id) === String(selectedSkuId));
  const requestedQuantity = Math.max(1, Number(quantity || 0));

  const candidateLocations = useMemo(() => {
    return locations
      .map((location) => {
        const availableCapacity = Number(location.capacity_units || 0) - Number(location.quantity_on_hand || 0);
        const percentAfterReceive = location.capacity_units
          ? ((Number(location.quantity_on_hand || 0) + requestedQuantity) / Number(location.capacity_units)) * 100
          : 100;

        return {
          ...location,
          availableCapacity,
          percentAfterReceive
        };
      })
      .filter((location) => location.availableCapacity >= requestedQuantity)
      .sort((a, b) => {
        const aScore = Math.abs(75 - a.percentAfterReceive);
        const bScore = Math.abs(75 - b.percentAfterReceive);
        return aScore - bScore || b.availableCapacity - a.availableCapacity;
      })
      .slice(0, 6);
  }, [locations, requestedQuantity]);

  const skuRecommendations = recommendations.filter((recommendation) => (
    selectedSku && String(recommendation.skuId) === String(selectedSku.sku_id)
  ));

  const handleShipmentChange = (shipmentId) => {
    setSelectedShipmentId(shipmentId);
    setSelectedShipmentLineId('');

    if (shipmentId === 'manual') return;

    const shipment = openInboundShipments.find((item) => String(item.shipment_id) === String(shipmentId));
    const firstOpenLine = shipment?.lines?.find((line) => getLineRemaining(line, 'inbound') > 0);
    if (firstOpenLine) {
      setSelectedShipmentLineId(String(firstOpenLine.shipmentLineId));
      setSelectedSkuId(String(firstOpenLine.skuId));
      setQuantity(getLineRemaining(firstOpenLine, 'inbound'));
      setSupplier(shipment.supplier_or_customer || shipment.shipment_number || 'Shipment receive');
    }
  };

  const handleShipmentLineChange = (shipmentLineId) => {
    setSelectedShipmentLineId(shipmentLineId);
    const line = availableShipmentLines.find((item) => String(item.shipmentLineId) === String(shipmentLineId));
    if (line) {
      setSelectedSkuId(String(line.skuId));
      setQuantity(getLineRemaining(line, 'inbound'));
    }
  };

  const handleReceiveStock = async (location) => {
    if (!selectedSku) return;

    try {
      setSubmittingLocationId(location.location_id);
      setSuccessMessage('');
      setError(null);

      const response = await api.post('/api/v2/receive-stock', {
        skuId: selectedSku.sku_id,
        locationId: location.location_id,
        quantity: requestedQuantity,
        supplier: supplier || 'Manual receive',
        lotNumber: `${selectedSku.sku}-${new Date().toISOString().slice(0, 10)}`,
        shipmentLineId: selectedShipmentLine ? selectedShipmentLine.shipmentLineId : undefined
      });

      const received = response.data.data;
      setSuccessMessage(`Received ${formatNumber(received.movement.quantity)} units of ${selectedSku.sku} into ${received.location.code}.`);
      await fetchReceivePlanningData();
    } catch (err) {
      console.error('Receive stock error:', err);
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmittingLocationId(null);
    }
  };

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading PostgreSQL receive planner...</p>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <h2>Error Loading Receive Planner</h2>
      <p>{error}</p>
      <p className="error-hint">The planner uses `/api/v2/skus`, `/api/v2/storage-locations`, and `/api/v2/storage-recommendations`.</p>
    </div>
  );

  return (
    <div className="shipment-receiver">
      <p className="eyebrow">PostgreSQL v2 API</p>
      <h1>Receive Shipment Planner</h1>
      <p className="recommendation-subtitle">
        Plan and commit inbound receiving with live SKU, location capacity, and rule-based recommendation data.
      </p>

      <div className="input-section">
        <div className="form-group">
          <label>Inbound Shipment</label>
          <select value={selectedShipmentId} onChange={(event) => handleShipmentChange(event.target.value)}>
            <option value="manual">Manual receive / no shipment line</option>
            {openInboundShipments.map((shipment) => (
              <option key={shipment.shipment_id} value={shipment.shipment_id}>
                {shipment.shipment_number} — {shipment.supplier_or_customer || 'Inbound shipment'} ({formatNumber(shipment.total_quantity - shipment.total_received_quantity)} remaining)
              </option>
            ))}
          </select>
        </div>

        {selectedShipment && (
          <div className="form-group">
            <label>Inbound Shipment Line</label>
            <select value={selectedShipmentLineId} onChange={(event) => handleShipmentLineChange(event.target.value)}>
              <option value="">Select a shipment line</option>
              {availableShipmentLines.map((line) => {
                const remaining = getLineRemaining(line, 'inbound');
                const received = Number(line.receivedQuantity || 0);
                const progress = Number(line.quantity || 0) ? (received / Number(line.quantity)) * 100 : 0;
                return (
                  <option key={line.shipmentLineId} value={line.shipmentLineId}>
                    {line.sku} — {formatNumber(remaining)} remaining of {formatNumber(line.quantity)} ({progress.toFixed(0)}% received)
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <div className="form-group">
          <label>Inbound SKU</label>
          <select value={selectedSkuId} onChange={(event) => setSelectedSkuId(event.target.value)}>
            <option value="">Select a SKU</option>
            {skus.map((sku) => (
              <option key={sku.sku_id} value={sku.sku_id}>
                {sku.sku} — {sku.name} ({formatNumber(sku.total_available)} available)
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Inbound Quantity</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Supplier / Reference</label>
          <input
            type="text"
            value={supplier}
            onChange={(event) => setSupplier(event.target.value)}
            placeholder="e.g., Acme Supply PO-1042"
          />
        </div>
      </div>

      {selectedSku && (
        <div className="success-message">
          <span className="success-icon">✓</span>
          Planning {selectedShipmentLine ? 'shipment-line' : 'manual'} receipt for {formatNumber(requestedQuantity)} units of {selectedSku.sku}{supplier ? ` from ${supplier}` : ''}.
        </div>
      )}

      {selectedShipmentLine && (
        <div className="recommendations-section">
          <h2>Inbound Line Progress</h2>
          <div className="shelf-recommendation">
            <div className="shelf-info">
              <h3>{selectedShipment.shipment_number} · {selectedShipmentLine.sku}</h3>
              <div className="shelf-meta">
                <span>{formatNumber(selectedShipmentLine.receivedQuantity)} received</span>
                <span>{formatNumber(getLineRemaining(selectedShipmentLine, 'inbound'))} remaining</span>
                <span>{formatNumber(selectedShipmentLine.quantity)} ordered</span>
              </div>
              <div className="capacity-visualization">
                <div className="capacity-bar">
                  <div
                    className="fill-level"
                    style={{ width: `${Math.min(100, (Number(selectedShipmentLine.receivedQuantity || 0) / Number(selectedShipmentLine.quantity || 1)) * 100)}%` }}
                  />
                </div>
                <span className="capacity-percentage">Shipment-line receive progress</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="success-message">
          <span className="success-icon">✓</span>
          {successMessage}
        </div>
      )}

      {selectedSku && skuRecommendations.length > 0 && (
        <div className="recommendations-section">
          <h2>Rule-Based SKU Alerts</h2>
          <div className="recommendations-grid">
            {skuRecommendations.map((recommendation, index) => (
              <div key={`${recommendation.type}-${index}`} className="shelf-recommendation">
                <div className="shelf-info">
                  <h3>{recommendation.title}</h3>
                  <div className="ai-recommendation-details">
                    <p className="ai-reason">{recommendation.action}</p>
                    <p>{recommendation.reason}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="recommendations-section">
        <h2>Recommended Active Storage Locations</h2>
        {!selectedSku ? (
          <div className="error-message">Choose a SKU to see capacity-ranked receive locations.</div>
        ) : candidateLocations.length === 0 ? (
          <div className="error-message">No active location has enough free capacity for this quantity.</div>
        ) : (
          <div className="recommendations-grid">
            {candidateLocations.map((location) => {
              const currentPercent = location.capacity_units
                ? (Number(location.quantity_on_hand || 0) / Number(location.capacity_units)) * 100
                : 0;
              const afterPercent = Math.min(location.percentAfterReceive, 100);
              const color = afterPercent >= 90 ? '#F44336' : afterPercent >= 70 ? '#FFC107' : '#4CAF50';

              return (
                <div key={location.location_id} className="shelf-recommendation">
                  <div className="shelf-info">
                    <h3>{location.location_code} — {location.location_name}</h3>
                    <div className="shelf-meta">
                      <span>{location.warehouse_name}</span>
                      <span>{location.location_type}</span>
                    </div>
                    <div className="shelf-meta">
                      <span>{formatNumber(location.availableCapacity)} free</span>
                      <span>{formatNumber(location.capacity_units)} capacity</span>
                    </div>
                    <div className="ai-recommendation-details">
                      <p className="ai-reason">
                        Rule: enough open capacity, active status, and target utilization near 75% after receive.
                      </p>
                      <p>Current: {currentPercent.toFixed(1)}% full · After receive: {afterPercent.toFixed(1)}% full</p>
                    </div>
                    <div className="capacity-visualization">
                      <div className="capacity-bar">
                        <div className="fill-level" style={{ width: `${afterPercent}%`, backgroundColor: color }} />
                      </div>
                      <span className="capacity-percentage">Projected after receipt</span>
                    </div>
                  </div>
                  <button
                    className="store-button"
                    onClick={() => handleReceiveStock(location)}
                    disabled={submittingLocationId !== null}
                  >
                    {submittingLocationId === location.location_id ? 'Receiving...' : 'Receive here'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ShipmentReceiver;
