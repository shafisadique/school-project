const { TeacherDashboard } = require("../../controllers/dashboard/teacherDashboardController");
const express = require('express');
const authMiddleware = require("../../middleware/authMiddleware");
const router = express.Router();

router.get('/teacher-dashboard',authMiddleware, TeacherDashboard);
module.exports = router;