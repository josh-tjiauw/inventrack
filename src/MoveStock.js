import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from './api';
import './Dashboard.css';
import './MoveStock.css';

const formatNumber = (value) => Number(value || 0).toLocaleString();

const isSameLocation = (location, lot) => {
  if (location.location_id && lot.location_id) {
    return String(location.location_id) === String(lot.location_id);
  }

  return String(location.location_code) === String(lot.location_code);
};

const MoveStock = () => {
  const [inventory, setInventory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLotId, setSelectedLotId] = useState('');
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('Manual stock move');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState(null);

  const loadMoveData = useCallback(async () => {
    const [inventoryResponse, locationResponse] = await Promise.all([
      api.get('/api/v2/inventory'),
      api.get('/api/v2/storage-locations?status=active')
    ]);

    const movableLots = (inventoryResponse.data.data || [])
      .filter((lot) => Number(lot.quantity_available || 0) > 0);
    const activeLocations = locationResponse.data.data || [];

    setInventory(movableLots);
    setLocations(activeLocations);

    if (movableLots.length > 0 && (!selectedLotId || !movableLots.some((lot) => String(lot.inventory_lot_id) === String(selectedLotId)))) {
      setSelectedLotId(String(movableLots[0].inventory_lot_id));
    }
  }, [selectedLotId]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await loadMoveData();
        setError(null);
      } catch (err) {
        console.error('Move stock data load error:', err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [loadMoveData]);

  const selectedLot = inventory.find((lot) => String(lot.inventory_lot_id) === String(selectedLotId));
  const requestedQuantity = Math.max(1, Number(quantity || 0));
  const candidateDestinations = useMemo(() => {
    if (!selectedLot) return [];
    return locations
      .filter((location) => !isSameLocation(location, selectedLot))
      .map((location) => {
        const availableCapacity = Number(location.capacity_units || 0) - Number(location.quantity_on_hand || 0);
        return { ...location, availableCapacity };
      })
      .filter((location) => location.availableCapacity >= requestedQuantity)
      .sort((a, b) => b.availableCapacity - a.availableCapacity || a.location_code.localeCompare(b.location_code));
  }, [locations, requestedQuantity, selectedLot]);

  useEffect(() => {
    if (candidateDestinations.length > 0 && !candidateDestinations.some((location) => String(location.location_id) === String(destinationLocationId))) {
      setDestinationLocationId(String(candidateDestinations[0].location_id));
    } else if (candidateDestinations.length === 0 && destinationLocationId) {
      setDestinationLocationId('');
    }
  }, [candidateDestinations, destinationLocationId]);

  const selectedDestination = candidateDestinations.find((location) => String(location.location_id) === String(destinationLocationId));
  const hasMovableInventory = inventory.length > 0;
  const hasDestinationCapacity = candidateDestinations.length > 0;
  const moveDisabledReason = !hasMovableInventory
    ? 'No available inventory lots can be moved yet.'
    : !hasDestinationCapacity
      ? `No active destination has ${formatNumber(requestedQuantity)} open unit(s).`
      : '';

  const handleMoveStock = async (event) => {
    event.preventDefault();
    if (!selectedLot || !selectedDestination) return;

    try {
      setSubmitting(true);
      setSuccessMessage('');
      setError(null);

      const response = await api.post('/api/v2/move-stock', {
        inventoryLotId: selectedLot.inventory_lot_id,
        destinationLocationId,
        quantity: Number(quantity),
        notes
      });

      const move = response.data.data;
      setSuccessMessage(`Moved ${formatNumber(move.movement.quantity)} units of ${move.sku.sku} from ${move.sourceLocation.code} to ${move.destinationLocation.code}.`);
      await loadMoveData();
    } catch (err) {
      console.error('Move stock error:', err);
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading move-stock workflow from PostgreSQL...</p>
    </div>
  );

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">PostgreSQL v2 API</p>
          <h1>Move Stock</h1>
          <p className="dashboard-subtitle">
            Move available inventory from one location to another with capacity checks and movement-history audit rows.
          </p>
        </div>
      </header>

      {error && <div className="error-container"><p>{error}</p></div>}
      {successMessage && <div className="move-stock-message"><span>✓</span>{successMessage}</div>}

      {!hasMovableInventory ? (
        <div className="empty-state-card move-stock-empty-state">
          <h3>No movable stock available</h3>
          <p>Every inventory lot is fully reserved or has zero available units.</p>
          <p>Receive stock, reduce reservations, or choose an available lot before starting a move.</p>
        </div>
      ) : (
        <div className="dashboard-summary">
          <div className="summary-card">
            <h3>Source Available</h3>
            <p>{formatNumber(selectedLot?.quantity_available)}</p>
          </div>
          <div className="summary-card">
            <h3>Move Quantity</h3>
            <p>{formatNumber(requestedQuantity)}</p>
          </div>
          <div className="summary-card">
            <h3>Eligible Destinations</h3>
            <p>{candidateDestinations.length}</p>
          </div>
          <div className="summary-card">
            <h3>Selected Route</h3>
            <p className="summary-card-text">
              {selectedLot && selectedDestination
                ? `${selectedLot.location_code} to ${selectedDestination.location_code}`
                : 'Choose a destination'}
            </p>
          </div>
        </div>
      )}

      <section className="inventory-section">
        <h2>Move Details</h2>
        <form className="filter-bar" onSubmit={handleMoveStock}>
          <label>
            Source Lot
            <select value={selectedLotId} onChange={(event) => setSelectedLotId(event.target.value)}>
              {inventory.map((lot) => (
                <option key={lot.inventory_lot_id} value={lot.inventory_lot_id}>
                  {lot.sku} · {lot.lot_number || `Lot ${lot.inventory_lot_id}`} · {lot.location_code} · {formatNumber(lot.quantity_available)} available
                </option>
              ))}
            </select>
          </label>

          <label>
            Quantity
            <input
              type="number"
              min="1"
              max={selectedLot ? Number(selectedLot.quantity_available || 1) : 1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>

          <label>
            Destination Location
            <select value={destinationLocationId} onChange={(event) => setDestinationLocationId(event.target.value)}>
              {candidateDestinations.length === 0 && (
                <option value="">No destination with enough capacity</option>
              )}
              {candidateDestinations.map((location) => (
                <option key={location.location_id} value={location.location_id}>
                  {location.location_code} · {location.warehouse_name} · {formatNumber(location.availableCapacity)} open
                </option>
              ))}
            </select>
          </label>

          <label>
            Notes
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Reason or reference"
            />
          </label>

          <button className="move-stock-button" type="submit" disabled={!selectedLot || !selectedDestination || submitting}>
            {submitting ? 'Moving...' : 'Move Stock'}
          </button>
        </form>
        {moveDisabledReason && (
          <p className="move-stock-help">{moveDisabledReason}</p>
        )}
      </section>

      {selectedLot && (
        <section className="inventory-section">
          <h2>Selected Source Lot</h2>
          <div className="inventory-table-wrapper">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Lot</th>
                  <th>Warehouse</th>
                  <th>Source Location</th>
                  <th>On Hand</th>
                  <th>Reserved</th>
                  <th>Available</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{selectedLot.sku}</td>
                  <td>{selectedLot.lot_number || '—'}</td>
                  <td>{selectedLot.warehouse_name}</td>
                  <td>{selectedLot.location_code}</td>
                  <td>{formatNumber(selectedLot.quantity_on_hand)}</td>
                  <td>{formatNumber(selectedLot.quantity_reserved)}</td>
                  <td>{formatNumber(selectedLot.quantity_available)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedLot && !hasDestinationCapacity && (
        <section className="inventory-section">
          <div className="empty-state-card move-stock-empty-state">
            <h3>No destination can fit this move</h3>
            <p>
              Lower the quantity below {formatNumber(requestedQuantity)} units or free capacity in another active location.
            </p>
            <p>The source location is excluded so stock is only moved to a different bin.</p>
          </div>
        </section>
      )}
    </div>
  );
};

export default MoveStock;
