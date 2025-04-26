const mongoose = require('mongoose');

const shelfSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Shelf name is required'],
    unique: true,
    trim: true
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: [1, 'Capacity must be at least 1']
  },
  current: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    validate: {
      validator: function(value) {
        return value <= this.capacity;
      },
      message: 'Current quantity cannot exceed capacity'
    }
  },
  items: {
    type: [String],
    default: [],
    validate: {
      validator: function(items) {
        return items.length <= this.capacity;
      },
      message: 'Number of items cannot exceed capacity'
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Shelf', shelfSchema);