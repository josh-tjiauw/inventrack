const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  weight: { type: Number, required: true },
  quantity: { type: Number, required: true },
  shippingDate: { type: Date, default: Date.now },
  arrivalDate: { type: Date },
  storageLocation: { type: String },
  category: { type: String },
  status: { type: String, enum: ['In Stock', 'Shipped', 'Delivered'], default: 'In Stock' },
});

module.exports = mongoose.model('Item', itemSchema);