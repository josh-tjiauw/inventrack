const express = require('express');
const router = express.Router();
const Shelf = require('../models/Shelf');
const Shipment = require('../models/Shipment');
const { validate } = require('../middleware/validate');

// Record an export shipment
router.post('/export', validate({
  shelfId: { required: true, type: 'string', nonEmpty: true, message: 'Shelf ID is required' },
  items: { required: true, type: 'array', nonEmpty: true, message: 'Items array is required and must not be empty' },
  destination: { required: true, type: 'string', nonEmpty: true, message: 'Destination is required' }
}), async (req, res) => {
  try {
    const { shelfId, items, destination } = req.body;

    // Find the shelf
    const shelf = await Shelf.findById(shelfId);
    if (!shelf) {
      return res.status(404).json({ message: 'Shelf not found' });
    }

    // Verify all items exist in the shelf
    const invalidItems = items.filter(item => !shelf.items.includes(item));
    if (invalidItems.length > 0) {
      return res.status(400).json({ 
        message: `Items not found in shelf: ${invalidItems.join(', ')}`
      });
    }

    // Remove items from shelf
    shelf.items = shelf.items.filter(item => !items.includes(item));
    shelf.current = shelf.items.length;
    await shelf.save();

    // Record the shipment
    const shipment = new Shipment({
      type: 'export',
      shelf: shelfId,
      items,
      destination,
      date: new Date()
    });
    await shipment.save();

    res.json({ 
      success: true,
      message: 'Shipment recorded successfully',
      data: shipment
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
  }
});

module.exports = router;