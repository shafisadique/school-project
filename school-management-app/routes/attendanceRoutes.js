const express = require('express');
const router = express.Router();
const { markAttendance, getAttendanceHistory, getStudentsByClass } = require('../controllers/attendance/attendanceControllers');
const { isTeacher } = require('../middleware/roleMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Teacher-only routes
router.post('/mark', authMiddleware, markAttendance);
router.get('/history/:classId', isTeacher, getAttendanceHistory);
router.get('/students/:classId', isTeacher, getStudentsByClass);
module.exports = router;