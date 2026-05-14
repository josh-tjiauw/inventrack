import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

const warehouseLinks = [
  { to: '/inventory', label: 'Inventory' },
  { to: '/skus', label: 'SKU Catalog' },
  { to: '/shipments', label: 'Shipments' },
  { to: '/movements', label: 'Movements' },
  { to: '/status', label: 'Status' },
  { to: '/receive', label: 'Receive Shipment' },
  { to: '/export', label: 'Export Shipment' },
  { to: '/move', label: 'Move Stock' },
];

const navLinkClass = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');
const dropdownLinkClass = ({ isActive }) => (isActive ? 'dropdown-link active' : 'dropdown-link');

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand-block">
          <NavLink to="/" className="brand-link">
            Inventrack
          </NavLink>
          <NavLink to="/" className={navLinkClass}>
            Home
          </NavLink>
        </div>

        <div className="navbar-links">
          <NavLink to="/dashboard" className={navLinkClass}>
            Dashboard
          </NavLink>

          <div className="nav-dropdown">
            <NavLink to="/warehouses" className={navLinkClass}>
              <span>Warehouse</span>
              <span className="dropdown-arrow" aria-hidden="true">▾</span>
            </NavLink>

            <div className="dropdown-menu" aria-label="Warehouse navigation">
              {warehouseLinks.map((link) => (
                <NavLink key={link.to} to={link.to} className={dropdownLinkClass}>
                  {link.label}
                </NavLink>
              ))}
            </div>
          </div>

          <NavLink to="/about" className={navLinkClass}>
            About Us
          </NavLink>
        </div>

        <div className="navbar-mobile-menu">
          <button className="mobile-menu-button" aria-label="Open navigation menu">
            <span className="menu-icon">☰</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
