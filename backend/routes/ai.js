import express from 'express';
import axios from 'axios';
const router = express.Router();

// Middleware for input validation
const validateRecommendationRequest = (req, res, next) => {
  const { itemCategory, itemDescription } = req.body;
  
  if (!itemCategory || !itemDescription) {
    return res.status(400).json({ 
      error: 'Both itemCategory and itemDescription are required' 
    });
  }
  
  next();
};

router.post('/recommend-storage', async (req, res) => {
  const { itemCategory, itemDescription, shelves } = req.body;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an inventory management AI. Analyze these shelves and recommend the best 3 options for storing:
            Item: ${itemDescription} (Category: ${itemCategory})
            
            Available shelves: ${JSON.stringify(shelves.map(s => ({
              shelfId: s._id,
              name: s.name,
              category: s.category,
              current: s.current,
              capacity: s.capacity,
              items: s.items.slice(0, 3) // Show first 3 items as examples
            })))}
            
            Return JSON with complete shelf recommendations including:
            - shelfId (MUST match provided IDs)
            - shelfName
            - category
            - currentCapacity
            - maxCapacity
            - aiReason (detailed storage reasoning)
            - confidence (0-1)
            
            Example response:
            {
              "recommendations": [
                {
                  "shelfId": "abc123",
                  "shelfName": "Clothing A1",
                  "category": "Clothing",
                  "currentCapacity": 5,
                  "maxCapacity": 10,
                  "aiReason": "Best match with 50% space remaining",
                  "confidence": 0.9
                }
              ]
            }`
          }
        ],
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0].message.content;
    const result = JSON.parse(content);
    
    // Validate response structure
    if (!result.recommendations || !Array.isArray(result.recommendations)) {
      throw new Error('Invalid recommendations format');
    }

    res.json(result);
  } catch (error) {
    console.error('AI API error:', error);
    res.status(500).json({ 
      error: 'Failed to get AI recommendations',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;