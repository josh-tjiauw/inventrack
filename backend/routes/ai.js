import express from 'express';
import OpenAI from 'openai';
import Shelf from '../models/Shelf.js';

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

router.post('/recommend-storage', async (req, res) => {
  const { itemCategory, itemDescription } = req.body;

  try {
    // 1. Fetch current shelf data directly from database
    const shelves = await Shelf.find({
      current: { $lt: '$capacity' } // Only shelves with available space
    }).lean();

    // 2. Construct AI prompt with real-time data
    const prompt = `
    INVENTORY STORAGE RECOMMENDATION REQUEST

    ITEM TO STORE:
    - Category: ${itemCategory}
    - Description: ${itemDescription}

    AVAILABLE SHELVES:
    ${shelves.map(s => 
      `- ${s.name} (${s.category}): ${s.current}/${s.capacity} units | Items: ${s.items.join(', ') || 'None'}`
    ).join('\n')}

    Please recommend the top 3 shelves considering:
    1. Category matching (40% weight)
    2. Available capacity (30% weight)
    3. Similar existing items (20% weight)
    4. Future accessibility needs (10% weight)

    Return JSON format:
    {
      recommendations: [{
        shelfId: string,
        reason: string,
        shelfName: string,
        shelfCurrent,
        shelfCapacity,
        confidence: number (0-1)
      }]
    }`;

    // 3. Get AI recommendations
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a warehouse management AI. Provide storage recommendations in the exact specified JSON format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3
    });

    // 4. Validate and enhance recommendations
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    const result = JSON.parse(content);
    
    // Verify recommended shelves exist
    const validRecommendations = await Promise.all(
      result.recommendations.map(async rec => {
        const shelf = await Shelf.findById(rec.shelfId);
        return shelf ? {
          ...rec,
          shelfName: shelf.name,
          current: shelf.current,
          capacity: shelf.capacity
        } : null;
      })
    );

    res.json({
      recommendations: validRecommendations.filter(Boolean)
    });

  } catch (error) {
    console.error('AI Recommendation Error:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body
    });

    res.status(500).json({ 
      error: 'AI recommendation failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;