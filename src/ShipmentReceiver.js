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
        shelves: shelves.filter(s => s.current < s.capacity) // Only send shelves with space
      });
  
      // Enhanced response processing
      const enhancedRecs = response.data.recommendations.map(rec => {
        const matchingShelf = shelves.find(s => s._id === rec.shelfId);
        if (!matchingShelf) return null;
        
        return normalizeRecommendation(matchingShelf, rec);
      }).filter(Boolean); // Remove any null values
  
      setRecommendations(enhancedRecs);
    } catch (err) {
      console.error('AI recommendation error:', err);
      setError('AI service unavailable. Using fallback recommendations.');
      getFallbackRecommendations();
    } finally {
      setLoading(false);
    }
  };
  
  const normalizeRecommendation = (shelf, recommendation = {}) => ({
    ...shelf,
    ...recommendation,
    shelfId: recommendation.shelfId || shelf._id,
    shelfName: recommendation.shelfName || shelf.name,
    category: recommendation.category || shelf.category || 'General',
    currentCapacity: recommendation.currentCapacity ?? shelf.current,
    maxCapacity: recommendation.maxCapacity ?? shelf.capacity,
    aiReason: recommendation.aiReason || recommendation.reason || 'Recommended based on available space',
    confidence: recommendation.confidence ?? 0.8
  });

  const getFallbackRecommendations = () => {
    const suitableShelves = shelves
      .filter(shelf => {
        const isCategoryMatch = shelf.category === selectedCategory;
        const hasSpace = shelf.current < shelf.capacity;
        return isCategoryMatch && hasSpace;
      })
      .sort((a, b) => (b.capacity - b.current) - (a.capacity - a.current))
      .slice(0, 3)
      .map(shelf => normalizeRecommendation(shelf, {
        aiReason: 'Fallback recommendation based on matching category and available space',
        confidence: 0.6
      }));

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

      {/* Recommendation Display */}
      {recommendations.length > 0 && (
  <div className="recommendations-section">
    <h2>Recommended Storage Locations</h2>
    <div className="recommendations-grid">
      {recommendations.map((rec) => {
        const currentCapacity = rec.currentCapacity ?? rec.current ?? 0;
        const maxCapacity = rec.maxCapacity ?? rec.capacity ?? 1;
        const percentage = Math.round((currentCapacity / maxCapacity) * 100);
        const spaceLeft = maxCapacity - currentCapacity;
        const shelfId = rec.shelfId || rec._id;
        const shelfName = rec.shelfName || rec.name;

        return (
          <div key={shelfId} className="shelf-recommendation">
            <div className="shelf-info">
              <h3>{shelfName}</h3>
              <div className="shelf-meta">
                <span>Category: {rec.category}</span>
                <span>Space left: {spaceLeft} units</span>
                <span>Current: {currentCapacity}/{maxCapacity}</span>
              </div>
              
              <div className="ai-recommendation-details">
                <p className="ai-reason">"{rec.aiReason}"</p>
                <div className="confidence-meter">
                  <div 
                    className="confidence-fill" 
                    style={{ width: `${(rec.confidence || 0.8) * 100}%` }}
                  />
                  <span className="confidence-value">
                    {Math.round((rec.confidence || 0.8) * 100)}% confidence
                  </span>
                </div>
              </div>
              
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
              onClick={() => storeItem(shelfId)}
              className="store-button"
              disabled={loading}
            >
              Store Here
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
