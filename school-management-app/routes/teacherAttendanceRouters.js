// routes/teacherAttendance.js
const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/teacher/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/mark', authMiddleware, attendanceController.markAttendance);
router.get('/teacher/:teacherId', authMiddleware, attendanceController.getAttendanceByTeacher);
router.get('/daily', authMiddleware, attendanceController.getDailyAttendance);

module.exports = router;