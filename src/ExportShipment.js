import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ExportShipment.css';

const ExportShipment = () => {
  const [shelves, setShelves] = useState([]);
  const [selectedShelf, setSelectedShelf] = useState('');
  const [items, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Fetch shelves from backend
  useEffect(() => {
    const fetchShelves = async () => {
      try {
        const response = await axios.get('/api/shelves');
        setShelves(response.data);
      } catch (err) {
        setError('Failed to load shelf data');
      }
    };
    fetchShelves();
  }, []);

  // Fetch items when shelf is selected
  useEffect(() => {
    if (selectedShelf) {
      const shelf = shelves.find(s => s._id === selectedShelf);
      setItems(shelf?.items || []);
    }
  }, [selectedShelf, shelves]);

  const handleItemSelect = (item) => {
    setSelectedItems(prev => 
      prev.includes(item) 
        ? prev.filter(i => i !== item)
        : [...prev, item]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedShelf || selectedItems.length === 0 || !destination) {
      setError('Please fill all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await axios.post('/api/shipments/export', {
        shelfId: selectedShelf,
        items: selectedItems,
        destination
      });

      // Update local state to reflect removed items
      const updatedShelves = shelves.map(shelf => {
        if (shelf._id === selectedShelf) {
          return {
            ...shelf,
            items: shelf.items.filter(item => !selectedItems.includes(item)),
            current: shelf.current - selectedItems.length
          };
        }
        return shelf;
      });

      setShelves(updatedShelves);
      setSuccess(true);
      setSelectedItems([]);
      setDestination('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process shipment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="export-shipment-container">
      <h1>Export Shipment</h1>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Select Shelf:</label>
          <select
            value={selectedShelf}
            onChange={(e) => setSelectedShelf(e.target.value)}
            disabled={loading}
            required
          >
            <option value="">-- Select a shelf --</option>
            {shelves.map(shelf => (
              <option key={shelf._id} value={shelf._id}>
                {shelf.name} ({shelf.current}/{shelf.capacity})
              </option>
            ))}
          </select>
        </div>

        {selectedShelf && (
          <div className="form-group">
            <label>Select Items to Export:</label>
            <div className="items-selection-container">
              {items.length > 0 ? (
                <div className="items-grid">
                  {items.map(item => (
                    <div key={item} className="item-row">
                      <div className="item-checkbox-container">
                        <input
                          type="checkbox"
                          id={`item-${item}`}
                          checked={selectedItems.includes(item)}
                          onChange={() => handleItemSelect(item)}
                          className="item-checkbox"
                        />
                        <div className="checkbox-divider"></div>
                      </div>
                      <label htmlFor={`item-${item}`} className="item-label">
                        {item}
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-items-message">No items available in this shelf</p>
              )}
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Destination:</label>
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Where are these items going?"
            disabled={loading}
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && (
          <div className="success-message">
            Shipment recorded successfully!
          </div>
        )}

        <button type="submit" disabled={loading} className="submit-button">
          {loading ? 'Processing...' : 'Record Shipment'}
        </button>
      </form>
    </div>
  );
};

export default ExportShipment;