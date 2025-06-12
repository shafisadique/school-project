// routes/resultRoutes.js
const express = require('express');
const router = express.Router();
const { createResult, getResultsByExam, getStudentResults, getResultsByClassAndAcademicYear } = require('../controllers/result/resultController');
const authMiddleware = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Admin-only routes
router.post('/create', isAdmin, createResult); // Create a result
router.get('/exam/:examId', isAdmin, getResultsByExam); // Get results for an exam
router.get('/student/:studentId', isAdmin, getStudentResults); // Get results for a student
// router.post('/promote', isAdmin, promoteStudents); // Promote students
router.get('/exam/class/:classId', isAdmin, getResultsByClassAndAcademicYear); // Get results for a class and academic year

module.exports = router;