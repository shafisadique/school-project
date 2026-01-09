const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('./config/logger');
const APIError = require('./utils/apiError');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();

// ==================== MONGOOSE ====================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => logger.info('Connected to MongoDB'))
  .catch(err => logger.error('MongoDB connection error:', err));

// ==================== R2 & MULTER ====================
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ==================== CORS & SECURITY ====================
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['https://edglobe-from-novuspark-app.vercel.app','http://localhost:4300'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', ...allowedOrigins],
      scriptSrc: ["'self'", 'https://*.razorpay.com'],
      connectSrc: ["'self'", ...allowedOrigins, 'https://api.razorpay.com'],
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

// ==================== RATE LIMIT & BODY ====================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: 'Too many login attempts, try again later.'
});
app.use('/api/auth', authLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== SOCKET.IO + HTTP SERVER ====================
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  path: '/socket.io/',
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e8
});

app.set('io', io);
const activeUsers = new Map();

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on('join', (user) => {
    if (!user?.id || !user?.schoolId) return;
    
    activeUsers.set(socket.id, { 
      userId: user.id, 
      schoolId: user.schoolId, 
      role: user.role 
    });

    socket.join(user.schoolId);
    socket.join(user.id);

    logger.info(`User ${user.id} (${user.role}) joined school ${user.schoolId}`);
  });

  // THIS WAS MISSING — ADD THIS
  socket.on('join-role', (role) => {
    if (role && ['teacher', 'student', 'parent', 'admin'].includes(role)) {
      socket.join(`role_${role}`);
      logger.info(`User joined role room: role_${role}`);
    }
  });

  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    if (user) logger.info(`User ${user.userId} disconnected`);
    activeUsers.delete(socket.id);
  });
});

// ==================== IMAGE PROXY & UPLOAD ====================
app.options('/api/proxy-image/:key(*)', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    data.Body.pipe(res);
  } catch (err) {
    logger.error('Proxy-image error:', err.message);
    res.status(404).json({ message: 'Image not found' });
  }
});

app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

    const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const key = `students/${fileName}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    res.json({ message: 'Uploaded', key });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// ==================== CRON & ROUTES ====================
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

app.use('/api/auth', authRoutes);
app.use('/api/schools', authMiddleware, schoolRoutes);
app.use('/api/students', authMiddleware, upload.single('profileImage'), studentRoutes);
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
app.use('/api/results', authMiddleware, resultRoutes);
app.use('/api/routes', authMiddleware, transporatationRoute);
app.use('/api/admin', authMiddleware, adminDashboard);
app.use('/api/assignments', authMiddleware, assignmentRoutes);
app.use('/api/reports', reportsRouters);
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/dashboard', require('./routes/teacher-dashboard/teacher-dashboardRoutes'));
app.use('/api/student-dashboard', require('./routes/student-dashboard/studentDashboardRoutes'));

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  if (err instanceof APIError) return res.status(err.statusCode).json({ message: err.message });
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message).join('; ');
    return res.status(400).json({ message: messages });
  }
  res.status(500).json({ message: 'Something went wrong' });
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => res.json({ status: 'OK', time: new Date() }));

// ==================== VERCEL EXPORT (MOST IMPORTANT) ====================
// DO NOT use app.listen() or server.listen() → Vercel handles it

// if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
//   module.exports = server;
// } 
// // LOCAL: You need to start the server
// else {
//   const PORT = process.env.PORT || 3000;
//   server.listen(PORT, '0.0.0.0', () => {
//     console.log(`Local server running on http://localhost:${PORT}`);
//     console.log(`Allowed origins:`, allowedOrigins);
//   });
// }

// ==================== AWS EC2 SERVER START ====================
// For AWS EC2 - Always start the server
const PORT = process.env.PORT || 3002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ School Admin Server running on http://localhost:${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV}`);
  console.log(`✅ Allowed origins:`, allowedOrigins);
});

// Export for compatibility
module.exports = server;