const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path'); // ✅ Import path module

dotenv.config();

const app = express();

// ✅ Middlewares
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// ✅ Static File Serving (Fix the error)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ✅ Routes Import
const authRoutes = require('./routes/authRoutes');
const schoolRoutes = require('./routes/schoolRoutes');
const userRoutes = require('./routes/userRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');
const feeRoutes = require('./routes/feeRoutes');
const classAndSubjectRoutes = require('./routes/classSubjectRoutes');
const holidayRoutes =require('./routes/holidaysRoutes')
// ✅ Middleware
const authMiddleware = require('./middleware/authMiddleware');

// ✅ API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/schools', authMiddleware, schoolRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/teachers', authMiddleware, teacherRoutes);
app.use('/api/students', authMiddleware, studentRoutes);
app.use('/api/fees', authMiddleware, feeRoutes);
app.use('/api/class-subject-management', authMiddleware,classAndSubjectRoutes );
app.use('/api/holidays', holidayRoutes);


// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
