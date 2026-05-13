import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './Home';
import About from './About';
import Dashboard from './Dashboard';
import WarehouseMap from './WarehouseMap';
import InventoryExplorer from './InventoryExplorer';
import SkuCatalog from './SkuCatalog';
import ShipmentBoard from './ShipmentBoard';
import MovementHistory from './MovementHistory';
import SystemStatus from './SystemStatus';
import ShipmentReceiver from './ShipmentReceiver';
import ExportShipment from './ExportShipment';
import MoveStock from './MoveStock';
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
            <Route path="/warehouses" element={<WarehouseMap />} />
            <Route path="/inventory" element={<InventoryExplorer />} />
            <Route path="/skus" element={<SkuCatalog />} />
            <Route path="/shipments" element={<ShipmentBoard />} />
            <Route path="/movements" element={<MovementHistory />} />
            <Route path="/status" element={<SystemStatus />} />
            <Route path="/receive" element={<ShipmentReceiver />} />
            <Route path="/export" element={<ExportShipment />} /> {/* New route */}
            <Route path="/move" element={<MoveStock />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
