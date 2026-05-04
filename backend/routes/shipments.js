const express = require('express');
const router = express.Router();
const Shelf = require('../models/Shelf');
const Shipment = require('../models/Shipment');
const { validate, validateObjectId } = require('../middleware/validate');

// Record an export shipment
router.post('/export', validate({
  shelfId: { required: true, type: 'string', nonEmpty: true, message: 'Shelf ID is required' },
  items: { required: true, type: 'array', nonEmpty: true, message: 'Items array is required and must not be empty' },
  destination: { required: true, type: 'string', nonEmpty: true, message: 'Destination is required' }
}), validateObjectId('shelfId'), async (req, res) => {
  try {
    const { shelfId, items, destination } = req.body;

    // Find the shelf
    const shelf = await Shelf.findById(shelfId);
    if (!shelf) {
      return res.status(404).json({ message: 'Shelf not found' });
    }

    // Verify the shelf has enough occurrences of each requested item.
    // This preserves duplicate item names by exporting only the selected count.
    const shelfItemCounts = shelf.items.reduce((counts, item) => {
      counts[item] = (counts[item] || 0) + 1;
      return counts;
    }, {});
    const requestedItemCounts = items.reduce((counts, item) => {
      counts[item] = (counts[item] || 0) + 1;
      return counts;
    }, {});
    const invalidItems = Object.entries(requestedItemCounts)
      .filter(([item, count]) => (shelfItemCounts[item] || 0) < count)
      .map(([item]) => item);

    if (invalidItems.length > 0) {
      return res.status(400).json({
        message: `Items not found in shelf: ${invalidItems.join(', ')}`
      });
    }

    // Remove only the requested number of occurrences from the shelf.
    const remainingRemovalCounts = { ...requestedItemCounts };
    shelf.items = shelf.items.filter(item => {
      if (remainingRemovalCounts[item] > 0) {
        remainingRemovalCounts[item] -= 1;
        return false;
      }
      return true;
    });
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
