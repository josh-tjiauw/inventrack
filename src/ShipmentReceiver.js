import React, { useEffect, useMemo, useState } from 'react';
import api from './api';
import './ShipmentReceiver.css';

const formatNumber = (value) => Number(value || 0).toLocaleString();

const ShipmentReceiver = () => {
  const [skus, setSkus] = useState([]);
  const [locations, setLocations] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedSkuId, setSelectedSkuId] = useState('');
  const [quantity, setQuantity] = useState(25);
  const [supplier, setSupplier] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReceivePlanningData = async () => {
      try {
        setLoading(true);
        const [skuResponse, locationResponse, recommendationResponse] = await Promise.all([
          api.get('/api/v2/skus'),
          api.get('/api/v2/storage-locations?status=active'),
          api.get('/api/v2/storage-recommendations')
        ]);

        setSkus(skuResponse.data.data || []);
        setLocations(locationResponse.data.data || []);
        setRecommendations(recommendationResponse.data.data || []);
        setError(null);
      } catch (err) {
        console.error('Receive planning error:', err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReceivePlanningData();
  }, []);

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
        Plan inbound receiving with live SKU, location capacity, and rule-based recommendation data. Write endpoints are intentionally not called yet.
      </p>

      <div className="input-section">
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
          Planning receipt for {formatNumber(requestedQuantity)} units of {selectedSku.sku}{supplier ? ` from ${supplier}` : ''}.
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
                  <button className="store-button" disabled>
                    Write endpoint pending
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
