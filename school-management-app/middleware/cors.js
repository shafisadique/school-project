const cors = require('cors');

const corsOptions = {
  origin: process.env.FRONTEND_URL || '*', // Allow requests from the frontend
  methods: 'GET,POST,PUT,DELETE',
  allowedHeaders: 'Content-Type,Authorization',
};

module.exports = cors(corsOptions);