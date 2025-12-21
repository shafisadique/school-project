// superadmin-backend/app.js  ← ONLY THIS FILE

const express = require('express');
// const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const helmet = require('helmet');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = express();
app.use(express.json({ limit: '10mb' }));

// THIS IS THE FIX – ADD BOTH DOMAINS
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:4200',
      'https://edglobe.vercel.app',                    // ← YOUR SUPERADMIN FRONTEND
      'https://edglobe-from-novuspark-app.vercel.app'  // ← YOUR SCHOOL APP (if needed)
    ];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Master-Key', 'X-Device-Fp'],
  exposedHeaders: ['Content-Length'],
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', ...allowedOrigins],
      scriptSrc: ["'self'", 'https://*.razorpay.com'],
      connectSrc: ["'self'", ...allowedOrigins, 'wss:', 'ws:'],
    }
  }
}));

// DB
// mongoose.connect(process.env.MONGODB_URI)
//   .then(() => console.log('MongoDB connected'))
//   .catch(err => console.error('DB error:', err));

// Connect to MySQL on startup
async function connectDB() {
  try {
    await prisma.$connect();
    console.log('MySQL connected successfully via Prisma');
  } catch (error) {
    console.error('MySQL connection failed:', error);
    process.exit(1);
  }
}
connectDB();
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/schools', require('./routes/school'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/bank', require('./routes/bank'));
app.use('/api/superadmin', require('./routes/superadminRoutes'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Allowed origins:`, allowedOrigins);
});