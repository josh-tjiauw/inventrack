const express = require('express');
const Shelf = require('../models/Shelf');
const router = express.Router();

// GET all shelves
router.get('/', async (req, res, next) => {
  try {
    const shelves = await Shelf.find().sort({ name: 1 });
    res.json(shelves);
  } catch (err) {
    next(err);
  }
});

// GET single shelf
router.get('/:id', async (req, res, next) => {
  try {
    const shelf = await Shelf.findById(req.params.id);
    if (!shelf) {
      return res.status(404).json({ message: 'Shelf not found' });
    }
    res.json(shelf);
  } catch (err) {
    next(err);
  }
});

// Add item to shelf
router.put('/:id/add-item', async (req, res) => {
    try {
      const shelf = await Shelf.findById(req.params.id);
      if (!shelf) {
        return res.status(404).json({ message: 'Shelf not found' });
      }
  
      if (shelf.current >= shelf.capacity) {
        return res.status(400).json({ message: 'Shelf is full' });
      }
  
      shelf.items.push(req.body.item);
      shelf.current += 1;
      await shelf.save();
  
      res.json(shelf);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  
// SEED initial data
router.post('/seed', async (req, res, next) => {
  const sampleShelves = [
    { name: 'Shelf A1', capacity: 100, current: 15, items: ['Laptop', 'Monitor'] },
    { name: 'Shelf A2', capacity: 100, current: 45, items: ['Keyboard', 'Mouse', 'Headphones'] },
    { name: 'Shelf B1', capacity: 100, current: 90, items: ['Phone', 'Tablet', 'Charger', 'Case'] },
    { name: 'Shelf B2', capacity: 100, current: 0, items: [] },
    { name: 'Shelf C1', capacity: 100, current: 65, items: ['Printer', 'Ink Cartridge'] },
    { name: 'Shelf C2', capacity: 100, current: 100, items: ['Desktop PC', 'Speakers', 'Webcam', 'Microphone'] },
    { name: 'Shelf D1', capacity: 100, current: 30, items: ['Router', 'Switch'] },
    { name: 'Shelf D2', capacity: 100, current: 75, items: ['Server', 'NAS'] },
    { name: 'Shelf E1', capacity: 100, current: 5, items: ['Cables'] },
    { name: 'Shelf E2', capacity: 100, current: 50, items: ['Dock', 'Adapter'] }
  ];

  try {
    await Shelf.deleteMany({});
    const createdShelves = await Shelf.insertMany(sampleShelves);
    res.status(201).json({
      message: 'Database seeded successfully',
      count: createdShelves.length
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;