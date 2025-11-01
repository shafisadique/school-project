const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect DB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('DB error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/schools', require('./routes/school'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/bank', require('./routes/bank'));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Superadmin server on port ${PORT}`));