// routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();

const {
  markAttendance,
  getAttendanceHistory,
  editAttendance,
  getStudentMonthlyAttendance,
  getStudentAttendanceReport   // ← ADD THIS
} = require('../controllers/attendance/attendanceControllers');

const { isTeacher, isStudent, isParentOrStudent } = require('../middleware/roleMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth to ALL routes
router.use(authMiddleware);

// ── TEACHER ROUTES ───────────────────────────────
router.post('/mark', isTeacher, markAttendance);
router.get('/history/:classId', isTeacher, getAttendanceHistory);
router.put('/edit/:attendanceId', isTeacher, editAttendance);
router.get('/students/:classId', isTeacher, require('../controllers/student/studentController').getStudentsByClass);

// ── STUDENT & PARENT ROUTES ───────────────────────
// Student can view own monthly attendance
router.get('/:studentId/monthly', authMiddleware, isStudent, getStudentMonthlyAttendance);

// Student can view full report (weekly/monthly)
router.get('/student-report', authMiddleware, isStudent, getStudentAttendanceReport);

module.exports = router;