const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path'); // ✅ Import path module
const helmet = require('helmet');

dotenv.config();

const app = express();
app.use(helmet());
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
const holidayRoutes =require('./routes/holidaysRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes'); // ✅ Add attendance routes
const teacherAbsenceRoutes = require('./routes/teacherAbsenceRoutes');


// ✅ Middleware
const authMiddleware = require('./middleware/authMiddleware');
const academicYearRoute = require('./routes/academicYearRoutes');

// ✅ API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/schools', authMiddleware, schoolRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/teachers', authMiddleware, teacherRoutes);
app.use('/api/students', authMiddleware, studentRoutes);
app.use('/api/fees', authMiddleware, feeRoutes);
app.use('/api/class-subject-management', authMiddleware,classAndSubjectRoutes );
app.use('/api/holidays', holidayRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/academicyear', academicYearRoute);
app.use('/api/attendance', attendanceRoutes); // ✅ Mount attendance routes
app.use('/api/teacher-absences', teacherAbsenceRoutes);

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(','), // e.g., ['http://localhost:4200']
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
