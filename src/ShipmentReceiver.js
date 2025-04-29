import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ShipmentReceiver.css';

const ShipmentReceiver = () => {
  const [categories] = useState([
    'Electronics', 
    'Clothing', 
    'Food', 
    'Furniture',
    'Tools',
    'Miscellaneous'
  ]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [shelves, setShelves] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchShelves = async () => {
      try {
        const response = await axios.get('/api/shelves', {
          timeout: 5000
        });
        setShelves(response.data);
      } catch (err) {
        setError('Failed to load shelf data. Please refresh or check backend connection.');
      }
    };
    
    fetchShelves();
  }, []);

  const getAIRecommendations = async () => {
    if (!selectedCategory || !itemDescription) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/ai/recommend-storage', {
        itemCategory: selectedCategory,
        itemDescription: itemDescription,
        shelves: shelves // Include shelves in the request
      }, {
        timeout: 10000
      });
  
      if (!response.data?.recommendations) {
        throw new Error('Invalid response format from AI service');
      }
  
      setRecommendations(response.data.recommendations);
      
    } catch (err) {
      console.error('AI Recommendation Error:', err);
      
      const errorMessage = err.response?.status === 429
        ? 'AI service overloaded. Please try again later.'
        : 'AI service unavailable. Using fallback recommendations.';
      
      setError(errorMessage);
      getFallbackRecommendations();
    } finally {
      setLoading(false);
    }
  };

  const getFallbackRecommendations = () => {
    const suitableShelves = shelves
      .filter(shelf => {
        const isCategoryMatch = shelf.category === selectedCategory;
        const hasSpace = shelf.current < shelf.capacity;
        return isCategoryMatch && hasSpace;
      })
      .sort((a, b) => (b.capacity - b.current) - (a.capacity - a.current))
      .slice(0, 3)
      .map(shelf => ({
        shelfId: shelf._id,
        shelfName: shelf.name,
        reason: `Fallback recommendation based on category match and available space`,
        confidence: 0.8,
        ...shelf // Include all shelf properties
      }));

    setRecommendations(suitableShelves);
  };

  const storeItem = async (shelfId) => {
    try {
      await axios.put(`/api/shelves/${shelfId}/add-item`, {
        item: itemDescription
      });
      setShelves(prev => prev.map(shelf => 
        shelf._id === shelfId 
          ? { ...shelf, current: shelf.current + 1, items: [...shelf.items, itemDescription] }
          : shelf
      ));
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        resetForm();
      }, 2000);
    } catch (err) {
      console.error('Error storing item:', err);
      setError('Failed to store item.');
    }
  };

  const resetForm = () => {
    setSelectedCategory('');
    setItemDescription('');
    setRecommendations([]);
  };

  const getFillPercentage = (current, capacity) => {
    return capacity ? Math.round((current / capacity) * 100) : 0;
  };

  const getSpaceLeft = (current, capacity) => {
    return capacity - current;
  };

  return (
    <div className="shipment-receiver">
      <h1>Receive New Shipment</h1>
      
      <div className="input-section">
        <div className="form-group">
          <label>Item Category:</label>
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            disabled={loading}
          >
            <option value="">Select a category</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>Item Description:</label>
          <input
            type="text"
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            placeholder="e.g., '4K Monitor', 'Cotton T-shirts'"
            disabled={loading}
          />
        </div>
        
        <button 
          onClick={getAIRecommendations}
          disabled={!selectedCategory || !itemDescription || loading}
          className="ai-recommend-button"
        >
          {loading ? (
            <>
              <span className="spinner"></span> Analyzing with AI...
            </>
          ) : (
            'Get Storage Recommendations'
          )}
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

{recommendations.length > 0 && (
  <div className="recommendations-section">
    <h2>Recommended Storage Locations</h2>
    <p className="recommendation-subtitle">
      Based on item type and available capacity
    </p>
    
    <div className="recommendations-grid">
      {recommendations.map((rec) => {
        // Find the matching shelf in our shelves data
        const shelf = shelves.find(s => s._id === rec.shelfId) || rec;
        
        // Calculate values with proper fallbacks
        const current = shelf.current || 0;
        const capacity = shelf.capacity || 1; // Prevent division by zero
        const spaceLeft = capacity - current;
        const percentage = Math.round((current / capacity) * 100);

        return (
          <div key={rec.shelfId || shelf._id} className="shelf-recommendation">
            <div className="shelf-info">
              <h3>{shelf.name || rec.shelfName}</h3>
              <div className="shelf-meta">
                <span>Category: {shelf.category || 'General'}</span>
                <span>Space left: {spaceLeft} units</span>
              </div>
              
              {rec.reason && (
                <div className="ai-recommendation-details">
                  <p className="ai-reason">"{rec.reason}"</p>
                  <div className="confidence-meter">
                    <div 
                      className="confidence-fill" 
                      style={{ width: `${(rec.confidence || 0.8) * 100}%` }}
                    />
                    <span className="confidence-value">
                      {((rec.confidence || 0.8) * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                </div>
              )}
              
              <div className="capacity-visualization">
                <div className="capacity-bar">
                  <div 
                    className="fill-level" 
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: percentage >= 90 ? '#F44336' : 
                                     percentage >= 70 ? '#FFC107' : '#4CAF50'
                    }}
                  />
                </div>
                <span className="capacity-percentage">{percentage}% full</span>
              </div>
            </div>
            
            <button 
              onClick={() => storeItem(rec.shelfId || shelf._id)}
              className="store-button"
              disabled={loading}
            >
              Store Here!
            </button>
          </div>
        );
      })}
    </div>
  </div>
)}
      
      {success && (
        <div className="success-message">
          <span className="success-icon">✓</span>
          Item stored successfully!
        </div>
      )}
    </div>
  );
};

export default ShipmentReceiver;