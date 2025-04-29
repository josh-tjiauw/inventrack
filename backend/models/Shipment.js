const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['import', 'export'],
    required: true
  },
  shelf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shelf',
    required: true
  },
  items: {
    type: [String],
    required: true
  },
  destination: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Shipment', shipmentSchema);