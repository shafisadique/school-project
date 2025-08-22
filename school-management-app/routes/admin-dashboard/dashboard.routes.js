// routes/adminDashboardRoutes.js
const express = require('express');
const router = express.Router();
const { isAdmin, roleMiddleware } = require('../../middleware/roleMiddleware');
const authMiddleware = require('../../middleware/authMiddleware');
const { getStudentAttendance } = require('../../controllers/dashboard/studentDashboardController');
const { getTeacherDashboard } = require('../../controllers/dashboard/teacherDashboardController');
const { getFeeDashboard } = require('../../controllers/dashboard/feeDashboardController');
router.use(authMiddleware)
router.get('/student-attendance',roleMiddleware('admin', 'teacher'), getStudentAttendance);
router.get('/teacher-dashboard',[isAdmin], getTeacherDashboard);
router.get('/fee-dashboard',[isAdmin], getFeeDashboard);

module.exports = router;