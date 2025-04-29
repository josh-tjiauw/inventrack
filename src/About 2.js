import React from 'react';
import './About.css';

function About() {
  const teamMembers = [{
    name: 'Josh Tjiauw',
    role: 'Full Stack Developer',
    bio: 'I love cats and dogs.',
    image: 'https://i.pinimg.com/originals/97/8b/cf/978bcf7b89c1ece8034108c16561a042.gif'
  }]
  return (
    <div className="about-us-container">
      <header className="about-header">
        <h1>About Our Inventory Management System</h1>
        <p className="subtitle">Streamlining your business operations since 2025</p>
      </header>

      <section className="mission-section">
        <h2>Our Mission</h2>
        <p>
          We're dedicated to providing businesses with powerful yet simple inventory 
          management solutions. Our system helps you track, manage, and optimize your 
          inventory in real-time, reducing costs and improving efficiency.
        </p>
      </section>

      <section className="features-section">
        <h2>Key Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Real-time Tracking</h3>
            <p>Monitor inventory levels as they change with our live updates.</p>
          </div>
          <div className="feature-card">
            <h3>Smart Analytics</h3>
            <p>Get insights into your inventory trends and patterns.</p>
          </div>
          <div className="feature-card">
            <h3>Stockout Alerts</h3>
            <p>Never worry about stocks being empty with our automatic alert system.</p>
          </div>
          <div className="feature-card">
            <h3>User-friendly</h3>
            <p>Intuitive interface designed for users of all technical levels.</p>
          </div>
        </div>
      </section>

      <section className="team-section">
        <h2>Meet The Team</h2>
        <div className="team-grid">
          {teamMembers.map((member, index) => (
            <div key={index} className="team-card">
              <img src={member.image} alt={member.name} className="team-photo" />
              <h3>{member.name}</h3>
              <p className="role">{member.role}</p>
              <p className="bio">{member.bio}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="contact-section">
        <h2>Contact Us</h2>
        <p>Have questions or need support? We're here to help!</p>
        <div className="contact-info">
          <p>Email: <a href="mailto:tjiauwj675@csu.fullerton.edu">tjiauwj675@csu.fullerton.edu</a></p>
          <p>Phone: (949) 463-8518</p>
          <p>Office Hours: Mon-Fri, 9AM-5PM EST</p>
        </div>
      </section>
    </div>
  );
};

export default About;