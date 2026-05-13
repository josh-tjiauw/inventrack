import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Homepage.css';

const Homepage = () => {
  const navigate = useNavigate();

  const techStack = [
    { name: 'React', icon: 'fab fa-react', description: 'Responsive portfolio frontend with route-based workflows for dashboard, shipments, receiving, exporting, movement history, and system status.' },
    { name: 'Node.js + Express', icon: 'fab fa-node-js', description: 'REST API powering PostgreSQL v2 endpoints, request IDs, demo RBAC, tenant guardrails, and transaction-safe inventory operations.' },
    { name: 'PostgreSQL', icon: 'fas fa-database', description: 'Relational source of truth with warehouses, locations, SKUs, inventory lots, shipment lines, stock movements, audit logs, and reporting views.' },
    { name: 'Neon', icon: 'fas fa-cloud', description: 'Hosted PostgreSQL database for the live demo, seeded with realistic inventory, shipment, and movement data.' },
    { name: 'Render', icon: 'fas fa-server', description: 'Hosted backend API connected to Neon and serving live /api/v2 health, read-model, and write workflow endpoints.' },
    { name: 'Vercel', icon: 'fas fa-rocket', description: 'Hosted React frontend for the portfolio demo, connected to the Render API.' },
    { name: 'GitHub Actions', icon: 'fab fa-github', description: 'CI pipeline that builds the frontend and validates PostgreSQL migrations/tests against a disposable database.' },
    { name: 'Playwright', icon: 'fas fa-check-circle', description: 'End-to-end workflow coverage for create shipment, receive/export against shipment lines, and movement-history verification.' },
  ];

  return (
    <div className="homepage-container">
      <section className="hero-section">
        <div className="hero-content">
          <h1>Welcome to InvenTrack</h1>
          <p className="hero-subtitle">
            A PostgreSQL-backed inventory platform built to demonstrate enterprise data modeling, transaction-safe stock workflows, and live deployment discipline.
          </p>
          <div className="hero-buttons">
            <button 
              className="primary-button"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </button>
            <button 
              className="secondary-button"
              onClick={() => navigate('/about')}
            >
              Learn More
            </button>
          </div>
        </div>
        <div className="hero-image">
          <img 
            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80" 
            alt="Inventory Management Dashboard" 
          />
        </div>
      </section>

      {/* Goal Section */}
      <section className="goal-section">
        <h2>Our Goal</h2>
        <div className="goal-content">
          <div className="goal-stats">
            <div className="stat-card">
              <h3>Enterprise Inventory Model</h3>
              <p>Track companies, users, warehouses, storage locations, SKUs, inventory lots, shipments, and shipment lines with relational PostgreSQL constraints.</p>
            </div>
            <div className="stat-card">
              <h3>Transaction-Safe Stock Workflows</h3>
              <p>Receive, export, move, reserve, and release stock through backend transactions that prevent invalid quantities and write movement history.</p>
            </div>
            <div className="stat-card">
              <h3>Operational Visibility</h3>
              <p>Use live dashboards, warehouse capacity views, SKU catalogs, inventory explorers, movement history, low-stock signals, and storage recommendations.</p>
            </div>
            <div className="stat-card">
              <h3>Portfolio-Ready Deployment</h3>
              <p>Run the React frontend on Vercel, the Express API on Render, PostgreSQL on Neon, and CI checks through GitHub Actions.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="tech-section">
        <h2>Our Technical Stack</h2>
        <p className="tech-intro">
          Built with the same tools used in the live deployed portfolio version: React, Express, PostgreSQL, Neon, Render, Vercel, CI, and browser workflow tests.
        </p>
        <div className="tech-grid">
          {techStack.map((tech, index) => (
            <div key={index} className="tech-card">
              <div className="tech-icon">
                <i className={`${tech.icon} fa-3x`}></i>
              </div>
              <h3>{tech.name}</h3>
              <p>{tech.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <h2>Ready to Transform Your Inventory Management?</h2>
        <button 
          className="primary-button"
          onClick={() => navigate('/dashboard')}
        >
          Get Started Now
        </button>
      </section>
    </div>
  );
};

export default Homepage;