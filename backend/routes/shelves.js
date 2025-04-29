const express = require('express');
const Shelf = require('../models/Shelf');
const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// GET all shelves
router.get('/', asyncHandler(async (req, res) => {
  const shelves = await Shelf.find().sort({ name: 1 }).lean();
  
  const formattedShelves = shelves.map(shelf => ({
    _id: shelf._id,
    name: shelf.name,
    category: shelf.category || 'General',
    capacity: shelf.capacity,
    current: shelf.current,
    items: shelf.items,
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
      category: shelf.category || 'General'
    }
  });
}));

// Add item to shelf 
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

// Example items for now
router.post('/seed', asyncHandler(async (req, res) => {
  const sampleShelves = [
    { 
      name: 'A1-Electronics', 
      category: 'Electronics',
      capacity: 10, 
      current: 2, 
      items: ['Laptop', 'Monitor'] 
    },
    { 
      name: 'A2-Electronics', 
      category: 'Electronics',
      capacity: 10, 
      current: 4, 
      items: ['Keyboard', 'Mouse', 'Headphones', 'iPhone'] 
    },
    { 
      name: 'B1-Clothing', 
      category: 'Clothing',
      capacity: 10, 
      current: 9, 
      items: ['T-shirt', 'Jeans', 'Jacket', 'Socks', 'Mittens', 'Scarf', 'Pants', 'Dress', 'Suit'] 
    },
    { 
      name: 'B2-Clothing', 
      category: 'Clothing',
      capacity: 10, 
      current: 0, 
      items: [] 
    },
    { 
      name: 'C1-Food', 
      category: 'Food',
      capacity: 10, 
      current: 6, 
      items: ['Canned Soup', 'Pasta', 'Ham', 'Pizza', 'Burger', 'Salad'] 
    },
    { 
      name: 'C2-Tools', 
      category: 'Tools',
      capacity: 10, 
      current: 10, 
      items: ['Hammer', 'Screwdriver', 'Wrench', 'Pliers', 'Scissors', 'Brush', 'Grabber', 'Gloves', 'Racket', 'Paint Bucket'] 
    },
    { 
      name: 'D1-Furniture', 
      category: 'Furniture',
      capacity: 10, 
      current: 3, 
      items: ['Chair', 'Table', 'Table Cover'] 
    },
    { 
      name: 'D2-Miscellaneous', 
      category: 'Miscellaneous',
      capacity: 10, 
      current: 7, 
      items: ['Box', 'Container', 'Misc1', 'Misc2', 'Misc3', 'Misc4', 'Misc5'] 
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