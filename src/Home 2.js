import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Homepage.css';

const Homepage = () => {
  const navigate = useNavigate();

  const techStack = [
    { name: 'React', icon: 'fab fa-react', description: 'Frontend library for building interactive UIs' },
    { name: 'Node.js', icon: 'fab fa-node-js', description: 'JavaScript runtime for backend services' },
    { name: 'Express', icon: 'fas fa-server', description: 'Backend web application framework' },
    { name: 'MongoDB', icon: 'fas fa-database', description: 'NoSQL database for flexible data storage' },
    { name: 'HTML5', icon: 'fab fa-html5', description: 'Markup language for structuring content' },
    { name: 'CSS3', icon: 'fab fa-css3-alt', description: 'Styling language for beautiful interfaces' },
  ];

  return (
    <div className="homepage-container">
      <section className="hero-section">
        <div className="hero-content">
          <h1>Welcome to InvenTrack</h1>
          <p className="hero-subtitle">
            Streamline your business operations with our powerful inventory management system
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
              <h3>Storage Management</h3>
              <p>Efficiently organize supplies using AI to provide more space, and ease of transport</p>
            </div>
            <div className="stat-card">
              <h3>Real-time Monitoring</h3>
              <p>Ability to view detailed statistics about your supplies in real-time.</p>
            </div>
            <div className="stat-card">
              <h3>Stockout Alerts</h3>
              <p>Automatically warn users when a supply needs to be reordered.</p>
            </div>
            <div className="stat-card">
              <h3>Reports and analytics</h3>
              <p>Provide warning to managers when a supply needs to be reordered.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="tech-section">
        <h2>Our Technical Stack</h2>
        <p className="tech-intro">
          Built with modern technologies to ensure performance, scalability, and reliability
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