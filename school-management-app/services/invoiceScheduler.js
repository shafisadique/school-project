// const cron = require('node-cron');
// const moment = require('moment');
// const mongoose = require('mongoose');
// const AcademicYear = require('../models/academicyear');
// const { generateMonthlyInvoices } = require('./invoiceGenerator');

// const scheduleMonthlyInvoices = async () => {
//   const now = new Date();
//   const currentMonth = now.getMonth() + 1; // 1-12
//   const currentYear = now.getFullYear();

//   try {
//     // Get all active academic years
//     const academicYears = await AcademicYear.find({
//       startDate: { $lte: now },
//       endDate: { $gte: now }
//     });

//     for (const academicYear of academicYears) {
//       // Get all classes with fee structures
//       const feeStructures = await mongoose.model('FeeStructure')
//         .find({ academicYearId: academicYear._id })
//         .distinct('classId');

//       for (const classId of feeStructures) {
//         try {
//           await generateMonthlyInvoices(
//             academicYear.schoolId,
//             classId,
//             currentMonth,
//             currentYear,
//             academicYear._id
//           );
//           console.log(`Generated invoices for class ${classId} in ${currentMonth}/${currentYear}`);
//         } catch (error) {
//           console.error(`Error generating invoices for class ${classId}:`, error);
//         }
//       }
//     }
//   } catch (error) {
//     console.error('Invoice scheduling error:', error);
//   }
// };

// // Schedule to run on the 1st of every month at 2 AM
// cron.schedule('0 2 1 * *', scheduleMonthlyInvoices);

// module.exports = { scheduleMonthlyInvoices };





const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

dotenv.config();

const app = express();

// R2 Configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

require('./utils/attendanceCron');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: 'Too many requests from this IP, please try again later.'
});

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:4300'];

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

app.set('trust proxy', 1);
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

app.use('/api/auth', authLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'Uploads'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.set('Content-Type', 'image/' + path.split('.').pop());
    }
  }
}));

// FIXED: Remove deprecated options from mongoose.connect
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Proxy Route for Images
app.get('/api/proxy-image/*', async (req, res) => {
  try {
    const key = req.params[0];
    const params = { Bucket: process.env.R2_BUCKET_NAME, Key: key };
    const command = new GetObjectCommand(params);
    const response = await s3Client.send(command);
    res.setHeader('Content-Type', response.ContentType);
    res.setHeader('Content-Length', response.ContentLength);
    res.setHeader('Last-Modified', response.LastModified.toUTCString());
    res.setHeader('ETag', response.ETag);
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);

    response.Body.pipe(res);
  } catch (error) {
    console.error('Proxy error:', error);
    if (error.name === 'NoSuchKey' || error.message === 'NoSuchKey') {
      const defaultImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==';
      res.status(404).set('Content-Type', 'image/png').send(Buffer.from(defaultImage.split(',')[1], 'base64'));
    } else {
      res.status(500).json({ message: 'Failed to proxy image', error: error.message });
    }
  }
});

// Import routes
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
const authMiddleware = require('./middleware/authMiddleware');
const studentDashboard = require('./routes/admin-dashboard/dashboard.routes');
const { isAdmin } = require('./middleware/roleMiddleware');
const assignmentRoutes = require('./routes/assignmentRoutes');

// Upload endpoint
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }
    const fileBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const params = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: `students/${fileName}`,
      Body: fileBuffer,
      ContentType: req.file.mimetype,
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    const imageUrl = `/api/proxy-image/students/${fileName}`;
    res.status(200).json({ message: 'Image uploaded successfully', url: imageUrl });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Failed to upload image', error: error.message });
  }
});

// Use routes - FIXED: Removed duplicate /api/students route
app.use('/api/auth', authRoutes);
app.use('/api/schools', authMiddleware, schoolRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/students', authMiddleware, studentRoutes);
app.use('/api/fees', authMiddleware, feeRoutes);
app.use('/api/class-subject-management', authMiddleware, classAndSubjectRoutes);
app.use('/api/holidays', authMiddleware, holidayRoutes);
app.use('/api/timetable', authMiddleware, timetableRoutes);
app.use('/api/academicyear', authMiddleware, academicYearRoute);
app.use('/api/teachers', authMiddleware, teacherRoutes);
app.use('/api/attendance', authMiddleware, StudentAttendanceRoutes);
app.use('/api/teacher-absences', authMiddleware, teacherAbsenceRoutes);
app.use('/api/teacher-attendance', authMiddleware, teacherAttendanceRoutes);
app.use('/api/exams', authMiddleware, exam);
app.use('/api/subscriptions', authMiddleware, subscriptionRoutes);
app.use('/api/results', authMiddleware, resultRoutes);
app.use('/api/routes', authMiddleware, transporatationRoute);
app.use('/api/admin', authMiddleware, studentDashboard);
app.use('/api/assignments', authMiddleware, assignmentRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));