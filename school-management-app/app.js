const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3'); // Add GetObjectCommand
const logger = require('./config/logger');
const APIError = require('./utils/apiError');

dotenv.config();

const app = express();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => logger.info('Connected to MongoDB'))
  .catch(err => logger.error('MongoDB connection error:', err));

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
const storage = multer.memoryStorage(); // Store file in memory for R2 upload
const upload = multer({ storage: storage });


const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
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


app.options('/api/proxy-image/:key(*)', (req, res) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

app.get('/api/proxy-image/:key(*)', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key || '').replace(/^\/+/, '');
    if (!key) return res.status(400).json({ message: 'Missing key' });

    const data = await s3Client.send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key
    }));

    res.setHeader('Content-Type', data.ContentType || 'image/jpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');  // <-- ADD THIS LINE
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    data.Body.pipe(res);
  } catch (err) {
    logger.error('Proxy-image error:', err.message);
    res.status(404).json({ message: 'Image not found' });
  }
});


require('./utils/attendanceCron');

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
const adminDashboard = require('./routes/admin-dashboard/dashboard.routes');
const { isAdmin } = require('./middleware/roleMiddleware');
const assignmentRoutes = require('./routes/assignmentRoutes');
const reportsRouters = require('./routes/reportsRoutes');
const parentRoutes = require('./routes/parentRoutes');

// Add upload endpoint with enhanced debugging
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }

    const fileBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const key = `students/${fileName}`; // Store with students/ prefix

    const params = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key, // Use the key with prefix
      Body: fileBuffer,
      ContentType: req.file.mimetype,
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Return only the key, not full URL
    res.status(200).json({ 
      message: 'Image uploaded successfully', 
      key: key // Store this in your database
    });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ message: 'Failed to upload image', error: error.message });
  }
});


app.use('/api/auth', authRoutes);
app.use('/api/schools', authMiddleware, schoolRoutes);
app.use('/api/students', authMiddleware, (req, res, next) => {
  upload.single('profileImage')(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}, studentRoutes);

app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/students', authMiddleware, studentRoutes);
app.use('/api/fees', authMiddleware, isAdmin, feeRoutes);
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
app.use('/api/results', authMiddleware,resultRoutes);
app.use('/api/routes',authMiddleware, transporatationRoute);
app.use('/api/admin', authMiddleware,adminDashboard);
app.use('/api/assignments', authMiddleware, assignmentRoutes); 
app.use('/api/reports',reportsRouters );
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/dashboard',require('./routes/teacher-dashboard/teacher-dashboardRoutes'))
// app.use('/api/parent', parentRoutes);

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    status: err.statusCode,
    name: err.name
  });

  // 1. APIError → return 400/401/etc with exact message
  if (err instanceof APIError) {
    return res.status(err.statusCode).json({
      message: err.message
    });
  }

  // 2. Mongoose Validation
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors)
      .map(e => e.message)
      .join('; ');
    return res.status(400).json({ message: messages });
  }

  // 3. JSON Parse
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return res.status(400).json({ message: 'Invalid data format' });
  }

  // 4. Multer error
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  }

  // 5. Default 500
  res.status(500).json({ message: 'Something went wrong' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);
});