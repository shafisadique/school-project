// routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const { markAttendance, getAttendanceHistory } = require('../controllers/attendance/attendanceControllers');
const { isTeacher } = require('../middleware/roleMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const studentController = require('../controllers/student/studentController');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Teacher-only routes
router.post('/mark', isTeacher, markAttendance);
router.get('/history/:classId', isTeacher, getAttendanceHistory);
router.get('/students/:classId', isTeacher, studentController.getStudentsByClass);

module.exports = router;