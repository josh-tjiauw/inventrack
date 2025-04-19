import React from 'react';

const InventoryItem = ({ item }) => {
  return (
    <div className="item-card">
      <h3>{item.name}</h3>
      <p>Weight: {item.weight} kg</p>
      <p>Quantity: {item.quantity}</p>
      <p>Location: {item.storageLocation}</p>
      <button>View Details</button>
    </div>
  );
};

export default InventoryItem;