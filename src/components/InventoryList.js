import React, { useState, useEffect } from 'react';
import axios from 'axios';
import InventoryItem from './InventoryItem';

const InventoryList = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:5000/api/items')
      .then(res => setItems(res.data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div>
      <h2>Inventory List</h2>
      {items.map(item => (
        <InventoryItem key={item._id} item={item} />
      ))}
    </div>
  );
};

export default InventoryList;