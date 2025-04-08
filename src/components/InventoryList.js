import React from 'react';
import InventoryItem from './InventoryItem';

function InventoryList({ inventory, deleteItem }) {
  if (inventory.length === 0) {
    return <div>No items in inventory.</div>;
  }

  return (
    <div>
      {inventory.map(item => (
        <InventoryItem key={item._id} item={item} deleteItem={deleteItem} />
      ))}
    </div>
  );
}

export default InventoryList;