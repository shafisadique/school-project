const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
// const cluster = require("cluster");
// const os = require('os');
// const totalCpu  = os.cpus().length
dotenv.config();
const app = express();


const uploadsDir = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

require('./utils/attendanceCron');
// const { generateMonthlyInvoices } = require('./utils/invoiceUtils');
// generateMonthlyInvoices();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40, 
  message: 'Too many requests from this IP, please try again later.'
});

// ✅ Configure CORS (remove duplicate and ensure correct origins)
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:4300'];

app.use(cors({
  origin: allowedOrigins, // e.g., ['http://localhost:4200']
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length'], // Expose headers if needed
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

app.set('trust proxy', 1); // Trust proxy for x-forwarded-proto
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

app.use('/api/auth', authLimiter);

// ✅ Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Static File Serving (Verify the uploads directory exists)
app.use('/uploads', express.static(path.join(__dirname, 'Uploads'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.set('Content-Type', 'image/' + path.split('.').pop());
    }
  }
}));
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
const holidayRoutes = require('./routes/holidaysRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const StudentAttendanceRoutes = require('./routes/attendanceRoutes');
const teacherAbsenceRoutes = require('./routes/teacherAbsenceRoutes');
const exam = require('./routes/examRouter');
const resultRoutes = require('./routes/resultRouter');
const academicYearRoute = require('./routes/academicYearRoutes');
const transporatationRoute = require('./routes/routeRouter');
const teacherAttendanceRoutes = require('./routes/teacherAttendanceRouters');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
// ✅ Middleware
const authMiddleware = require('./middleware/authMiddleware');
const studentDashboard = require('./routes/admin-dashboard/dashboard.routes');
const { isAdmin } = require('./middleware/roleMiddleware');
const assignmentRoutes = require('./routes/assignmentRoutes');

// ✅ API Endpoints
app.use('/api/auth', authRoutes); 
app.use('/api/schools', authMiddleware, schoolRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/students', authMiddleware, studentRoutes);
app.use('/api/fees', authMiddleware,isAdmin, feeRoutes);
app.use('/api/class-subject-management', authMiddleware, classAndSubjectRoutes);
app.use('/api/holidays', authMiddleware,holidayRoutes);
app.use('/api/timetable',authMiddleware, timetableRoutes);
app.use('/api/academicyear',authMiddleware, academicYearRoute);
app.use('/api/teachers', authMiddleware, teacherRoutes);
app.use('/api/attendance',authMiddleware, StudentAttendanceRoutes);
app.use('/api/teacher-absences',authMiddleware, teacherAbsenceRoutes);
app.use('/api/teacher-attendance',authMiddleware,teacherAttendanceRoutes);
app.use('/api/exams',authMiddleware, exam);
app.use('/api/subscriptions', authMiddleware, subscriptionRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/routes',transporatationRoute);
app.use('/api/admin', studentDashboard);
app.use('/api/assignments', authMiddleware, assignmentRoutes);

// After all routes
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});


// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));