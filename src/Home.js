import React from 'react';
import './styles.css';

function Home() {
  return (
    <div className="home">
      <div className="hero">
        <h1>Welcome to Inventrack</h1>
        <p>Efficiently manage your inventory with our cutting-edge solutions.</p>
      </div>
      <div className="content">
        <h2>What We Offer</h2>
        <p>Our system provides real-time tracking, automated reporting, and seamless integration with your existing tools.</p>
        <p>Join us to streamline your inventory processes and boost your business efficiency.</p>
      </div>
    </div>
  );
}

export default Home;