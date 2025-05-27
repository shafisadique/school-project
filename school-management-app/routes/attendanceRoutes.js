const express = require('express');
const router = express.Router();
const { markAttendance, getAttendanceHistory } = require('../controllers/attendance/attendanceControllers');
const { isTeacher } = require('../middleware/roleMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const studentController = require('../controllers/student/studentController'); // Fixed variable namerouter.use(authMiddleware);

// Teacher-only routes
router.post('/mark', authMiddleware, markAttendance);
router.get('/history/:classId', isTeacher, getAttendanceHistory);
router.get('/students/:classId', studentController.getStudentsByClass);
module.exports = router;