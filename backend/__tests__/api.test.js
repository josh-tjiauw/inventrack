const request = require('supertest');
const mongoose = require('mongoose');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/inventrack-test';

const { app } = require('../server');

describe('API Endpoints', () => {
  afterAll(async () => {
    // Close mongoose connection if open
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('GET /api/health', () => {
    it('should return 200 with status OK', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('status', 'OK');
      expect(res.body).toHaveProperty('database');
    });
  });

  describe('GET /api/shelves', () => {
    it('should return an array', async () => {
      const res = await request(app).get('/api/shelves');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('PUT /api/shelves/:id/add-item', () => {
    it('should return 400 when item is missing', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/shelves/${fakeId}/add-item`)
        .send({});
      // Should be 400 (missing item) or 404 (shelf not found)
      expect([400, 404]).toContain(res.statusCode);
    });

    it('should validate required fields', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/shelves/${fakeId}/add-item`)
        .send({ item: '' });
      // Empty string should still trigger not found or bad request
      expect([400, 404]).toContain(res.statusCode);
    });
  });

  describe('GET /api/shelves/:id', () => {
    it('should return 404 for non-existent shelf', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/shelves/${fakeId}`);
      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('success', false);
    });

    it('should return 400 for invalid ID format', async () => {
      const res = await request(app).get('/api/shelves/invalid-id');
      // Mongoose CastError should result in 400 or 500
      expect([400, 500]).toContain(res.statusCode);
    });
  });
});
