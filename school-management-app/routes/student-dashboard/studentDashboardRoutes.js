
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const { isStudent } = require('../../middleware/roleMiddleware');
const { getStudentDashboard } = require('../../controllers/dashboard/studentDashboardController');

// Only logged-in student can access
router.use(authMiddleware);
 
router.get('/dashboard',isStudent, getStudentDashboard);

module.exports = router;