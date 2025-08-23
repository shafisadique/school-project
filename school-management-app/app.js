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

dotenv.config();
console.log('Loaded env variables:', process.env); // Debug log
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

console.log('R2 Config:', {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID?.slice(0, 4) + '...',
  secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY?.slice(0, 4) + '...',
  bucketName: process.env.R2_BUCKET_NAME,
});
// Multer setup for file uploads
const storage = multer.memoryStorage(); // Store file in memory for R2 upload
const upload = multer({ storage: storage });


const uploadsDir = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

require('./utils/attendanceCron');
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

app.use('/uploads', express.static(path.join(__dirname, 'Uploads'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.set('Content-Type', 'image/' + path.split('.').pop());
    }
  }
}));

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

  // New Proxy Route for Images
app.get('/api/proxy-image/*', async (req, res) => {
  try {
    const key = req.params[0]; // This captures everything after /api/proxy-image/, e.g., 'students/1755955052920-student.png'
    const params = { Bucket: process.env.R2_BUCKET_NAME, Key: key };
    const command = new GetObjectCommand(params);
    const response = await s3Client.send(command);
    res.setHeader('Content-Type', response.ContentType);
    res.setHeader('Content-Length', response.ContentLength);
    res.setHeader('Last-Modified', response.LastModified.toUTCString());
    res.setHeader('ETag', response.ETag);
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4300'); // Allow your frontend

    response.Body.pipe(res);
  } catch (error) {
    console.error('Proxy error:', error);
    if (error.name === 'NoSuchKey' || error.message === 'NoSuchKey') {
      const defaultImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=='; // 1x1 transparent pixel
      res.status(404).set('Content-Type', 'image/png').send(Buffer.from(defaultImage.split(',')[1], 'base64'));
    } else {
      res.status(500).json({ message: 'Failed to proxy image', error: error.message });
    }
  }
});

app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }

    console.log('Received file:', req.file);

    const fileBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const params = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: `students/${fileName}`, // Use 'students/' prefix
      Body: fileBuffer,
      ContentType: req.file.mimetype,
    };

    console.log('Upload params:', params);

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    const imageUrl = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/students/${fileName}`;
    res.status(200).json({ message: 'Image uploaded successfully', url: imageUrl });
  } catch (error) {
    console.error('Upload error:', error.message, error.stack);
    if (error.name === 'AccessDenied' || error.name === 'InvalidAccessKeyId') {
      console.error('Check R2 credentials in .env file');
    } else if (error.name === 'NoSuchBucket') {
      console.error('Bucket does not exist:', process.env.R2_BUCKET_NAME);
    }
    res.status(500).json({ message: 'Failed to upload image', error: error.message });
  }
});

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

// Add upload endpoint with enhanced debugging
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }

    console.log('Received file:', req.file); // Debug: Log file details

    const fileBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`; // Sanitize file name
    const params = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: fileBuffer,
      ContentType: req.file.mimetype,
    };

    console.log('Upload params:', params); // Debug: Log upload parameters

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    const imageUrl = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${fileName}`;
    res.status(200).json({ message: 'Image uploaded successfully', url: imageUrl });
  } catch (error) {
    console.error('Upload error:', error.message, error.stack); // Enhanced error logging
    if (error.name === 'AccessDenied' || error.name === 'InvalidAccessKeyId') {
      console.error('Check R2 credentials in .env file');
    } else if (error.name === 'NoSuchBucket') {
      console.error('Bucket does not exist:', process.env.R2_BUCKET_NAME);
    }
    res.status(500).json({ message: 'Failed to upload image', error: error.message });
  }
});

app.use('/api/auth', authRoutes);
// app.use('/api/schools', authMiddleware, schoolRoutes);
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
app.use('/api/results', resultRoutes);
app.use('/api/routes', transporatationRoute);
app.use('/api/admin', studentDashboard);
app.use('/api/assignments', authMiddleware, assignmentRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));