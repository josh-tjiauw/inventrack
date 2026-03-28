# InvenTrack API Documentation

Base URL: `http://localhost:5000/api`

---

## Health Check

**GET** `/api/health`

Check if the server and database are running.

```bash
curl http://localhost:5000/api/health
```

**Response (200):**
```json
{
  "status": "OK",
  "database": "Connected"
}
```

---

## Shelves

### List All Shelves

**GET** `/api/shelves`

Returns all shelves sorted by name.

```bash
curl http://localhost:5000/api/shelves
```

**Response (200):**
```json
[
  {
    "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
    "name": "A1-Electronics",
    "category": "Electronics",
    "capacity": 10,
    "current": 2,
    "items": ["Laptop", "Monitor"]
  }
]
```

---

### Get Single Shelf

**GET** `/api/shelves/:id`

Returns details for a specific shelf.

```bash
curl http://localhost:5000/api/shelves/65a1b2c3d4e5f6a7b8c9d0e1
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
    "name": "A1-Electronics",
    "category": "Electronics",
    "capacity": 10,
    "current": 2,
    "items": ["Laptop", "Monitor"]
  }
}
```

**Error (404):**
```json
{
  "success": false,
  "message": "Shelf not found"
}
```

---

### Add Item to Shelf

**PUT** `/api/shelves/:id/add-item`

Add an item to a specific shelf.

```bash
curl -X PUT http://localhost:5000/api/shelves/65a1b2c3d4e5f6a7b8c9d0e1/add-item \
  -H "Content-Type: application/json" \
  -d '{"item": "Tablet"}'
```

**Request Body:**
```json
{
  "item": "Tablet"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "65a1b2c3d4e5f6a7b8c9d0e1",
    "name": "A1-Electronics",
    "category": "Electronics",
    "capacity": 10,
    "current": 3,
    "items": ["Laptop", "Monitor", "Tablet"]
  },
  "message": "Item added successfully"
}
```

**Error (400) — Missing item:**
```json
{
  "success": false,
  "message": "Item description is required"
}
```

**Error (400) — Shelf full:**
```json
{
  "success": false,
  "message": "Shelf is at full capacity"
}
```

---

### Seed Database

**POST** `/api/shelves/seed`

Resets the database with sample shelf data. Useful for development and testing.

```bash
curl -X POST http://localhost:5000/api/shelves/seed
```

**Response (201):**
```json
{
  "success": true,
  "count": 8,
  "message": "Database seeded successfully with categorized shelves"
}
```

---

## Shipments

### Export Shipment

**POST** `/api/shipments/export`

Record an export shipment. Removes specified items from a shelf and logs the shipment.

```bash
curl -X POST http://localhost:5000/api/shipments/export \
  -H "Content-Type: application/json" \
  -d '{
    "shelfId": "65a1b2c3d4e5f6a7b8c9d0e1",
    "items": ["Laptop"],
    "destination": "Customer Order #1234"
  }'
```

**Request Body:**
```json
{
  "shelfId": "65a1b2c3d4e5f6a7b8c9d0e1",
  "items": ["Laptop"],
  "destination": "Customer Order #1234"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Shipment recorded successfully",
  "data": {
    "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "type": "export",
    "shelf": "65a1b2c3d4e5f6a7b8c9d0e1",
    "items": ["Laptop"],
    "destination": "Customer Order #1234",
    "date": "2026-03-26T18:00:00.000Z"
  }
}
```

**Error (400) — Missing fields:**
```json
{
  "message": "Missing required fields"
}
```

**Error (400) — Items not on shelf:**
```json
{
  "message": "Items not found in shelf: InvalidItem"
}
```

**Error (404) — Shelf not found:**
```json
{
  "message": "Shelf not found"
}
```

---

## AI Recommendations

### Get Storage Recommendation

**POST** `/api/ai/recommend-storage`

Uses OpenAI to suggest optimal storage locations for an item based on current shelf contents and categories.

```bash
curl -X POST http://localhost:5000/api/ai/recommend-storage \
  -H "Content-Type: application/json" \
  -d '{"item": "Wireless Mouse", "category": "Electronics"}'
```

**Request Body:**
```json
{
  "item": "Wireless Mouse",
  "category": "Electronics"
}
```

**Response (200):**
```json
{
  "success": true,
  "recommendations": [
    {
      "shelf": "A1-Electronics",
      "confidence": 0.95,
      "reason": "Category match with available capacity"
    },
    {
      "shelf": "A2-Electronics",
      "confidence": 0.85,
      "reason": "Same category, contains similar items"
    }
  ]
}
```

> **Note:** Requires a valid `OPENAI_API_KEY` in environment variables.

---

## Error Responses

All endpoints may return the following error formats:

**500 — Server Error:**
```json
{
  "success": false,
  "message": "Internal server error description"
}
```

**400 — Bad Request:**
```json
{
  "success": false,
  "message": "Description of what's wrong with the request"
}
```

**404 — Not Found:**
```json
{
  "success": false,
  "message": "Resource not found"
}
```
