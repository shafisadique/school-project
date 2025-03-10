const express = require('express');
const router = express.Router();
const { markAttendance, getAttendance } = require('../controllers/attendance/attendanceControllers');
const { isTeacher } = require('../middleware/roleMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Teacher-only routes
router.post('/', isTeacher, markAttendance);
router.get('/:studentId', getAttendance); // Could add isTeacher/isStudent middleware

module.exports = router;