import React from 'react';

function InventoryItem({ item, deleteItem }) {
  return (
    <div>
      <span>{item.name} - {item.quantity} - ${item.price}</span>
      <button onClick={() => deleteItem(item._id)}>Delete</button>
    </div>
  );
}

export default InventoryItem;