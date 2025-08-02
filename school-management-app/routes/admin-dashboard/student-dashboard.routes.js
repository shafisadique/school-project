// routes/adminDashboardRoutes.js
const express = require('express');
const router = express.Router();
const { isAdmin } = require('../../middleware/roleMiddleware');
const authMiddleware = require('../../middleware/authMiddleware');
const { getStudentAttendance } = require('../../controllers/dashboard/studentDashboardController');
router.use(authMiddleware)
router.get('/student-attendance', [isAdmin], getStudentAttendance);

module.exports = router;