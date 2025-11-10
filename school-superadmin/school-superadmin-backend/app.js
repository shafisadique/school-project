const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const helmet = require('helmet');


const app = express();
app.use(express.json());

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:4200','https://school-management-backend-khaki.vercel.app'];

app.use(cors({
  origin: allowedOrigins,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length'],
  optionsSuccessStatus: 200,
  credentials: true
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', ...allowedOrigins],
      scriptSrc: ["'self'", 'https://*.razorpay.com'],
      styleSrc: ["'self'"],
      connectSrc: ["'self'", ...allowedOrigins, 'https://api.razorpay.com']
    }
  }
}));


// Connect DB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('DB error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/schools', require('./routes/school'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/bank', require('./routes/bank'));
app.use('/api/superadmin', require('./routes/superadminRoutes'));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Superadmin server on port ${PORT}`));