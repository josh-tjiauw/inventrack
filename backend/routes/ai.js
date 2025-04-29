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

router.post('/recommend-storage', validateRecommendationRequest, async (req, res) => {
  const { itemCategory, itemDescription } = req.body;
  const model = process.env.AI_MODEL || "gpt-4-turbo";

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages: [
          {
            role: "system",
            content: `You are an intelligent inventory management system. 
            Recommend the best storage shelf based on item type and available capacity.`
          },
          {
            role: "user",
            content: `Item Category: ${itemCategory}
            Item Description: ${itemDescription}
            
            Recommend the top 3 shelves considering:
            1. Category match
            2. Available capacity
            3. Similar items already stored
            
            Return JSON format: {
              recommendations: [{
                shelfId: string,
                shelfName: string,
                reason: string,
                confidence: number (0-1)
              }]
            }`
          }
        ],
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // Added timeout
      }
    );

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response structure from AI service');
    }

    const content = response.data.choices[0].message.content;
    let recommendations;
    
    try {
      recommendations = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('AI returned invalid JSON format');
    }

    if (!recommendations.recommendations) {
      throw new Error('AI response missing recommendations');
    }

    res.json(recommendations);
  } catch (error) {
    console.error('AI API error:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });

    const statusCode = error.response?.status || 500;
    const errorMessage = statusCode === 429 
      ? 'AI service is currently overloaded. Please try again later.'
      : 'Failed to get AI recommendations';

    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;