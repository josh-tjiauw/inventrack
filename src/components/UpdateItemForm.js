import React, { useState } from 'react';

function UpdateItemForm({ item, updateItem }) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity);
  const [price, setPrice] = useState(item.price);

  const handleSubmit = (e) => {
    e.preventDefault();
    updateItem(item._id, { name, quantity, price });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
      <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
      <button type="submit">Update Item</button>
    </form>
  );
}

export default UpdateItemForm;