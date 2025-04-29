import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <NavLink to="/" className="brand-link">
            Inventrack
          </NavLink>
        </div>
        
        <div className="navbar-links">
          <NavLink 
            to="/" 
            className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
          >
            Home
          </NavLink>
          
          <NavLink 
            to="/about" 
            className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
          >
            About Us
          </NavLink>

          <NavLink 
            to="/dashboard" 
            className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
          >
            Dashboard
          </NavLink>
          
          <NavLink 
            to="/receive" 
            className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
          >
            Receive Shipment
          </NavLink>
        </div>
        
        <div className="navbar-mobile-menu">
          <button className="mobile-menu-button">
            <span className="menu-icon">☰</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;