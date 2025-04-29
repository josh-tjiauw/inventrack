const express = require('express');
const Shelf = require('../models/Shelf');
const router = express.Router();

// Error handling wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// GET all shelves - formatted for frontend
router.get('/', asyncHandler(async (req, res) => {
  const shelves = await Shelf.find().sort({ name: 1 }).lean();
  
  // Transform data to match frontend expectations
  const formattedShelves = shelves.map(shelf => ({
    _id: shelf._id,
    name: shelf.name,
    category: shelf.category || 'General', // Ensure category exists
    capacity: shelf.capacity,
    current: shelf.current,
    items: shelf.items,
    // Add any additional fields your frontend expects
  }));

  res.json(formattedShelves);
}));

// GET single shelf
router.get('/:id', asyncHandler(async (req, res) => {
  const shelf = await Shelf.findById(req.params.id).lean();
  if (!shelf) {
    return res.status(404).json({ 
      success: false,
      message: 'Shelf not found' 
    });
  }

  res.json({
    success: true,
    data: {
      ...shelf,
      category: shelf.category || 'General' // Ensure category exists
    }
  });
}));

// Add item to shelf - updated to match frontend expectations
router.put('/:id/add-item', asyncHandler(async (req, res) => {
  const { item } = req.body;
  
  if (!item) {
    return res.status(400).json({ 
      success: false,
      message: 'Item description is required' 
    });
  }

  const shelf = await Shelf.findById(req.params.id);
  if (!shelf) {
    return res.status(404).json({ 
      success: false,
      message: 'Shelf not found' 
    });
  }

  if (shelf.current >= shelf.capacity) {
    return res.status(400).json({ 
      success: false,
      message: 'Shelf is at full capacity' 
    });
  }

  shelf.items.push(item);
  shelf.current += 1;
  await shelf.save();

  res.json({
    success: true,
    data: {
      _id: shelf._id,
      name: shelf.name,
      category: shelf.category || 'General',
      capacity: shelf.capacity,
      current: shelf.current,
      items: shelf.items
    },
    message: 'Item added successfully'
  });
}));

// SEED initial data - updated with categories
router.post('/seed', asyncHandler(async (req, res) => {
  const sampleShelves = [
    { 
      name: 'Electronics A1', 
      category: 'Electronics',
      capacity: 100, 
      current: 15, 
      items: ['Laptop', 'Monitor'] 
    },
    { 
      name: 'Electronics A2', 
      category: 'Electronics',
      capacity: 100, 
      current: 45, 
      items: ['Keyboard', 'Mouse', 'Headphones'] 
    },
    { 
      name: 'Clothing B1', 
      category: 'Clothing',
      capacity: 100, 
      current: 90, 
      items: ['T-shirt', 'Jeans', 'Jacket', 'Socks'] 
    },
    { 
      name: 'Clothing B2', 
      category: 'Clothing',
      capacity: 100, 
      current: 0, 
      items: [] 
    },
    { 
      name: 'Food C1', 
      category: 'Food',
      capacity: 100, 
      current: 65, 
      items: ['Canned Goods', 'Pasta'] 
    },
    { 
      name: 'Tools C2', 
      category: 'Tools',
      capacity: 100, 
      current: 100, 
      items: ['Hammer', 'Screwdriver', 'Wrench', 'Pliers'] 
    },
    { 
      name: 'Furniture D1', 
      category: 'Furniture',
      capacity: 100, 
      current: 30, 
      items: ['Chair', 'Table'] 
    },
    { 
      name: 'Miscellaneous D2', 
      category: 'Miscellaneous',
      capacity: 100, 
      current: 75, 
      items: ['Box', 'Container'] 
    }
  ];

  await Shelf.deleteMany({});
  const createdShelves = await Shelf.insertMany(sampleShelves);

  res.status(201).json({
    success: true,
    count: createdShelves.length,
    message: 'Database seeded successfully with categorized shelves'
  });
}));

module.exports = router;