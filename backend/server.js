require('dotenv').config();
const express = require('./node_modules/express');
const mongoose = require('./node_modules/mongoose');
const cors = require('./node_modules/cors');
const app = express();

import('./routes/ai.js').then((module) => {
  app.use('/api/ai', module.default);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/shelves', require('./routes/shelves'));

// Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected' 
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});