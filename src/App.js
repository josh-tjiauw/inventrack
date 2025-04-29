import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './Home';
import About from './About';
import Dashboard from './Dashboard';
import ShipmentReceiver from './ShipmentReceiver';
import ExportShipment from './ExportShipment';
import Navbar from './Navbar';
import './styles.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/receive" element={<ShipmentReceiver />} />
            <Route path="/export" element={<ExportShipment />} /> {/* New route */}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;