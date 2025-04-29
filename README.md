# InvenTrack - Inventory Management System

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Technologies](#technologies)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)

## Overview

InvenTrack is a full-stack inventory management application designed to help businesses track stock levels, manage storage locations, and optimize warehouse operations. The system provides real-time visibility into inventory across multiple storage shelves with AI-powered recommendations for optimal item placement.

## Features

- 📊 Real-time inventory dashboard
- 📦 Shipment receiving system
- 🚚 Export/shipping management
- 🧠 AI-powered storage recommendations
- 📈 Capacity visualization
- 🔔 Low stock alerts
- 📱 Responsive design
- 🔄 Automatic data synchronization

## Technologies

### Frontend
- HTML
- CSS3/Flexbox
- Bootstrap
- React.js
- React Router

### Backend
- Node.js
- Express.js
- Axios
- MongoDB/Mongoose
- OpenAI API (for recommendations)

### Development Tools
- Git
- Postman (API testing)
- Visual Studio Code
- Heroku (Deployment)

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm (v8 or higher)
- MongoDB Atlas account or local MongoDB instance
- OpenAI API key (for AI features)

### Setup Instructions

1. **Clone the repository**
   git clone https://github.com/yourusername/inventrack.git
   cd inventrack

2. **Install frontend dependencies**
    npm install
3. **Set up the Backend**
    cd backend
    npm install
4. **.env File setup**
    Create a .env file in the backend directory with:
    MONGODB_URI=your_mongodb_connection_string
    OPENAI_API_KEY=your_openai_api_key
    PORT=5000

### Usage
To run the application:
1. **Start backend server**
    cd backend
    node server.js

2. **Start frontend server**
    Open a new terminal
    cd /inventrack
    npm start

3. **Browser**
    If it hasn't already directed you, open a browser and input http://localhost:3000

## Key Functionality

### Dashboard
- **Real-time Inventory Overview**: View current stock levels across all shelves
- **Capacity Visualization**: Color-coded bars show fill percentage (green <70%, yellow 70-90%, red >90%)
- **Low Stock Alerts**: Automatic warnings for shelves below 20% capacity
- **Quick Actions**: One-click access to receive/export shipments

![Dashboard View](./screenshots/dashboard.png)

### Receive Shipments
1. **Item Entry**:
   - Select category (Electronics, Clothing, Food, etc.)
   - Enter item description
2. **AI Recommendations**:
   - System suggests top 3 storage locations
   - Shows reasoning and confidence levels
3. **Storage Assignment**:
   - Select shelf and confirm storage
   - Automatic capacity updates

![Receive Shipment](./screenshots/receive.png)

### Export Shipments
1. **Shelf Selection**: Choose source shelf
2. **Item Selection**:
   - Checkbox interface for multiple items
   - Clear visual indicators of selected items
3. **Destination Tracking**:
   - Record where items are being shipped
   - Automatic inventory deduction

![Export Shipment](./screenshots/export.png)

### AI-Powered Features
- **Smart Storage Recommendations**:
  - Considers category matching
  - Analyzes current shelf capacity
  - Learns from existing item groupings
- **Capacity Optimization**:
  - Prevents overfilling shelves
  - Balances inventory distribution

## API Endpoints

| Endpoint | Method | Description | Requires |
|----------|--------|-------------|----------|
| `/api/shelves` | GET | List all shelves | - |
| `/api/shelves/:id` | GET | Get shelf details | Shelf ID |
| `/api/shelves/:id/add-item` | PUT | Add item to shelf | Shelf ID, Item Data |
| `/api/shipments/export` | POST | Record export | Shipment Data |
| `/api/ai/recommend-storage` | POST | Get storage recommendations | Item Data |
