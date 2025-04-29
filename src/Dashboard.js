import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';

const Dashboard = () => {
  const [shelves, setShelves] = useState([]);
  const [selectedShelf, setSelectedShelf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(false);
  const [lowStockShelves, setLowStockShelves] = useState([]);
  const [showAlert, setShowAlert] = useState(false);

  // API configuration
  const api = axios.create({
    baseURL: process.env.NODE_ENV === 'development' 
      ? 'http://localhost:5000/api' 
      : '/api',
    timeout: 10000
  });

  // Fetch shelves from backend
  useEffect(() => {
    const fetchShelves = async () => {
      try {
        setLoading(true);
        const response = await api.get('/shelves');
        setShelves(response.data);
        setError(null);
        
        // Check for low stock shelves
        const lowStock = response.data.filter(shelf => {
          const percentage = (shelf.current / shelf.capacity) * 100;
          return percentage < 20 && percentage > 0; // Below 20% but not empty
        });
        
        setLowStockShelves(lowStock);
        if (lowStock.length > 0) {
          setShowAlert(true);
        }
      } catch (err) {
        console.error('API Error:', err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchShelves();
  }, [reload]);

  // Seed initial data
  const seedDatabase = async () => {
    try {
      await api.post('/shelves/seed');
      setReload(prev => !prev); // Trigger re-fetch
    } catch (err) {
      setError('Failed to seed database: ' + err.message);
    }
  };

  // Calculate shelf status
  const getShelfStatus = (shelf) => {
    const percentage = Math.round((shelf.current / shelf.capacity) * 100);
    
    let status, color;
    if (percentage === 0) {
      status = 'Empty';
      color = '#4CAF50'; // Green
    } else if (percentage >= 90) {
      status = 'Full';
      color = '#F44336'; // Red
    } else if (percentage < 20) {
      status = 'Low Stock';
      color = '#FF5722'; // Orange for low stock
    } else {
      status = `${percentage}% Full`;
      color = '#FFC107'; // Yellow
    }

    return { percentage, status, color };
  };

  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading inventory data...</p>
    </div>
  );

  if (error) return (
    <div className="error-container">
      <h2>Error Loading Data</h2>
      <p>{error}</p>
      <button onClick={() => setReload(prev => !prev)} className="retry-button">
        Retry
      </button>
    </div>
  );

  return (
    <div className="dashboard-container">
      {/* Low Stock Alert Banner */}
      {showAlert && lowStockShelves.length > 0 && (
        <div className="alert-banner">
          <div className="alert-content">
            <span className="alert-icon">⚠️</span>
            <span>
              Low stock alert: {lowStockShelves.length} shelf{lowStockShelves.length !== 1 ? 's' : ''} below 20% capacity
            </span>
            <button 
              className="alert-close"
              onClick={() => setShowAlert(false)}
              aria-label="Close alert"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      <header className="dashboard-header">
        <h1>Inventory Dashboard</h1>
        <div className="header-actions">
          <button onClick={seedDatabase} className="primary-button">
            Initialize Sample Data
          </button>
          <button onClick={() => setReload(prev => !prev)} className="secondary-button">
            Refresh Data
          </button>
        </div>
      </header>

      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>Total Shelves</h3>
          <p>{shelves.length}</p>
        </div>
        <div className="summary-card">
          <h3>Total Capacity</h3>
          <p>{shelves.reduce((sum, shelf) => sum + shelf.capacity, 0)} units</p>
        </div>
        <div className="summary-card">
          <h3>Space Used</h3>
          <p>
            {shelves.reduce((sum, shelf) => sum + shelf.current, 0)} / 
            {shelves.reduce((sum, shelf) => sum + shelf.capacity, 0)} units
          </p>
        </div>
      </div>

      <div className="storage-visualization">
        <h2>Storage Overview</h2>
        <div className="shelves-grid">
          {shelves.map(shelf => {
            const { percentage, status, color } = getShelfStatus(shelf);
            
            return (
              <div 
                key={shelf._id} 
                className={`shelf-card ${percentage < 20 && percentage > 0 ? 'low-stock' : ''}`}
                onClick={() => setSelectedShelf(shelf)}
              >
                <div className="shelf-header">
                  <h3>{shelf.name}</h3>
                  <span className="shelf-status" style={{ color }}>
                    {status}
                  </span>
                </div>
                <div className="capacity-bar">
                  <div 
                    className="fill-level" 
                    style={{ width: `${percentage}%`, backgroundColor: color }}
                  />
                </div>
                <div className="shelf-meta">
                  <span>{shelf.current}/{shelf.capacity} units</span>
                  <span>{shelf.items.length} items</span>
                </div>
                {percentage < 20 && percentage > 0 && (
                  <div className="low-stock-badge">Low Stock</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Shelf Detail Modal */}
      {selectedShelf && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-content">
              <div className="modal-header">
                <h2>{selectedShelf.name}</h2>
                <button 
                  className="modal-close"
                  onClick={() => setSelectedShelf(null)}
                  aria-label="Close modal"
                >
                  &times;
                </button>
              </div>
              
              <div className="modal-body">
                <div className="shelf-stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Status:</span>
                    <span className="stat-value" style={{ color: getShelfStatus(selectedShelf).color }}>
                      {getShelfStatus(selectedShelf).status}
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Capacity:</span>
                    <span className="stat-value">{selectedShelf.current}/{selectedShelf.capacity} units</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Category:</span>
                    <span className="stat-value">{selectedShelf.category || 'General'}</span>
                  </div>
                </div>
                
                <div className="capacity-visualization">
                  <div className="capacity-bar">
                    <div 
                      className="fill-level" 
                      style={{ 
                        width: `${getShelfStatus(selectedShelf).percentage}%`,
                        backgroundColor: getShelfStatus(selectedShelf).color
                      }}
                    />
                  </div>
                  <span className="capacity-percentage">
                    {getShelfStatus(selectedShelf).percentage}% full
                  </span>
                </div>
                
                <div className="shelf-items-section">
                  <h3>Items ({selectedShelf.items.length})</h3>
                  {selectedShelf.items.length > 0 ? (
                    <ul className="items-list">
                      {selectedShelf.items.map((item, index) => (
                        <li key={index} className="item">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="no-items">No items in this shelf</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;