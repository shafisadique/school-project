// routes/adminDashboardRoutes.js
const express = require('express');
const router = express.Router();
const { isAdmin, roleMiddleware } = require('../../middleware/roleMiddleware');
const authMiddleware = require('../../middleware/authMiddleware');
const { getStudentAttendance, getStudentDashboardData } = require('../../controllers/dashboard/studentDashboardController');
const { getTeacherDashboard, getAllTeacherDashboard } = require('../../controllers/dashboard/teacherDashboardController');
const { getFeeDashboard, getAllFeeDashboard } = require('../../controllers/dashboard/feeDashboardController');
router.use(authMiddleware)

// routes/admin-dashboard/dashboard.routes.js
router.get('/stats',isAdmin,authMiddleware, async (req, res) => {
  try {
    const [studentResponse, teacherResponse, feeResponse] = await Promise.all([
      getStudentDashboardData(req.user),
      getAllTeacherDashboard(req.user),
      getAllFeeDashboard(req.user)
    ]);

    const dashboardStats = {
      totalActiveStudents: studentResponse.totalActiveStudents || 0,
      totalActiveTeachers: teacherResponse.totalActiveTeachers || 0,
      overallDue: feeResponse.overallDue || 0,
      overallPaid: feeResponse.overallPaid || 0
    };

    res.status(200).json(dashboardStats);
  } catch (error) {
    console.error('Error in /stats:', error);
    res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
  }
});

router.get('/student-attendance',roleMiddleware('admin', 'teacher'), getStudentAttendance);
router.get('/teacher-dashboard',[isAdmin], getTeacherDashboard);
router.get('/fee-dashboard',[isAdmin], getFeeDashboard);

module.exports = router;