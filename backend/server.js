const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = 3001;

app.use(express.json());

const uri = "mongodb+srv://tjiauwj675:b2w9q9VJBEte6YLQ@cluster0.tgl5cve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const itemSchema = new mongoose.Schema({
  name: String,
  quantity: Number,
  price: Number
});

const Item = mongoose.model('Item', itemSchema);

app.get('/api/inventory', async (req, res) => {
  const items = await Item.find();
  res.json(items);
});

app.post('/api/inventory', async (req, res) => {
  const newItem = new Item(req.body);
  await newItem.save();
  res.status(201).json(newItem);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});