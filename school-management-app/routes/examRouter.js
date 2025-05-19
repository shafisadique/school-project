// routes/examRoutes.js
const express = require('express');
const router = express.Router();
const { createExam, getExamHistory, getExamSummary } = require('../controllers/exam/examController');
const authMiddleware = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Admin-only routes
router.post('/create', isAdmin, createExam); // Create an exam
router.get('/history/:classId', isAdmin, getExamHistory); // Get exam history for a class
router.get('/summary', isAdmin, getExamSummary); // Get exam summary (aggregation)

module.exports = router;