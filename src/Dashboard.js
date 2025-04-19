import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis } from 'recharts';
import axios from 'axios';

const Dashboard = () => {
  const [stats, setStats] = useState({ totalItems: 0, storageUsage: [] });

  useEffect(() => {
    axios.get('http://localhost:5000/api/stats')
      .then(res => setStats(res.data))
      .catch(err => console.error(err));
  }, []);

  // AI Recommendation Function
  const getShipmentRecommendation = () => {
    // Integrate OpenAI API here (example mock response)
    return "Based on weight distribution, ship items from Warehouse A to Warehouse B.";
  };

  return (
    <div>
      <h2>Inventory Dashboard</h2>
      <PieChart width={400} height={400}>
        <Pie data={stats.storageUsage} dataKey="value" nameKey="name">
          {stats.storageUsage.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28'][index % 3]} />
          ))}
        </Pie>
      </PieChart>
      <div className="ai-recommendation">
        <h3>AI Recommendation</h3>
        <p>{getShipmentRecommendation()}</p>
      </div>
    </div>
  );
};

export default Dashboard;