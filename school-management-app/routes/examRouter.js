const express = require('express');
const router = express.Router();
const { createExam, getExamHistory, getExamSummary, getExamsBySchool, getExamsByTeacher, updateExam, getExamById } = require('../controllers/exam/examController');
const authMiddleware = require('../middleware/authMiddleware');
const { isAdmin, isTeacher, externalRoleMiddleware } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Super Admin or Admin-only routes
router.post('/create', [isAdmin], createExam); // Create an exam (Admin-only)
router.get('/school/:schoolId', [isAdmin], getExamsBySchool); // Get all exams for a school (Admin-only)
router.get('/summary', [isAdmin], getExamSummary); // Get exam summary (Admin-only)
router.put('/:examId', [isAdmin], updateExam); // Update an exam (Admin-only)

// Teacher-only routes
router.get('/teacher', [isTeacher], getExamsByTeacher); // Get exams for the teacher
router.get('/history/:classId', [isTeacher, externalRoleMiddleware(['teacher'])], getExamHistory); // Get exam history for a class
router.get('/teacher/:examId', [isTeacher], getExamById); // Get exam by ID for teacher
router.get('/:examId', [isAdmin], getExamById); // Get exam by ID (Admin-only)

module.exports = router;