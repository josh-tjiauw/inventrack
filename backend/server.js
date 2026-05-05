require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const shipmentRoutes = require('./routes/shipments');
const v2Routes = require('./routes/v2');
const cors = require('cors');

// Validate required environment variables when running the legacy MongoDB-backed app.
// The PostgreSQL v2 routes use DATABASE_URL / POSTGRES_URL and can be tested without MongoDB.
const isTest = process.env.NODE_ENV === 'test';
const hasMongo = Boolean(process.env.MONGODB_URI);
const hasPostgres = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);

if (!isTest && !hasMongo && !hasPostgres) {
  console.error('Missing database configuration: set MONGODB_URI for legacy routes or DATABASE_URL for PostgreSQL v2 routes.');
  console.error('Please check your backend environment variables.');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set. AI features will not work.');
}

const app = express();

import('./routes/ai.js').then((module) => {
  app.use('/api/ai', module.default);
}).catch((err) => {
  console.error('Failed to load AI routes:', err.message);
});

// Middleware
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());
app.use('/api/shelves', require('./routes/shelves'));
app.use('/api/shipments', shipmentRoutes);
app.use('/api/v2', v2Routes);

// Legacy MongoDB connection. The PostgreSQL v2 API uses backend/db/postgres.js.
const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI is not set. Legacy MongoDB routes will be unavailable.');
    return;
  }

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

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack || err.message);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start Server
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
}

module.exports = { app, connectDB };
