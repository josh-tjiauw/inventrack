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
        console.log('Fetched shelves:', response.data); // Debugging line
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
        shelves: shelves.filter(s => s.current < s.capacity)
      });
      const enhancedRecs = response.data.recommendations
        .map(rec => ({
          ...shelves.find(s => s._id === rec.shelfId),
          aiReason: rec.reason,
          confidence: rec.confidence
        }))
        .filter(rec => rec); 

      setRecommendations(enhancedRecs);
    } catch (err) {
      console.error('AI recommendation error:', err);
      setError('AI service unavailable. Using fallback recommendations.');
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
      .slice(0, 3);

    setRecommendations(suitableShelves);
  };

  // Store item in selected shelf
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
    //console.log('Calculating fill percentage:', { current, capacity }); // Debugging line
    return Math.round((current / capacity) * 100);
  };
  const getSpaceLeft = (current, capacity) => {
    //console.log('Calculating space left:', { current, capacity }); // Debugging line
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

      {/* Error Message Display */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Recommendation Display - Placed here in the component */}
      {recommendations.length > 0 && (
        <div className="recommendations-section">
          <h2>Recommended Storage Locations</h2>
          <p className="recommendation-subtitle">
            Based on item type and available capacity
          </p>
          
          <div className="recommendations-grid">
            {recommendations.map(shelf => {
              console.log("shelf",shelf)
              const percentage = getFillPercentage(shelves[0].current, shelves[0].capacity);
              const spaceLeft = getSpaceLeft(shelves.current, shelves.capacity);
              console.log('Shelf data:', shelf); // Debugging line
              return (
                <div key={shelves._id} className="shelf-recommendation">
                  <div className="shelf-info">
                    <h3>{shelves.name}</h3>
                    <div className="shelf-meta">
                      <span>Category: {shelf.category}</span>
                      <span>Space left: {spaceLeft} units</span>
                    </div>
                    
                    {/* AI Recommendation Details */}
                    {shelf.aiReason && (
                      <div className="ai-recommendation-details">
                        <p className="ai-reason">"{shelf.aiReason}"</p>
                        <div className="confidence-meter">
                          <div 
                            className="confidence-fill" 
                            style={{ width: `${(shelf.confidence || 0.8) * 100}%` }}
                          />
                          <span className="confidence-value">
                            {(shelf.confidence * 100)?.toFixed(0) || '80'}% confidence
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Capacity Visualization */}
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
                    onClick={() => storeItem(shelf._id)}
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
      
      {/* Success Message */}
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
