// routes/exam.js
const express = require('express');
const router = express.Router();
const { createExam, getExamHistory, getExamSummary, getExamsBySchool, getExamsByTeacher, updateExam, getExamById, getExamsForResultEntry } = require('../controllers/exam/examController');
const authMiddleware = require('../middleware/authMiddleware');
const { isAdmin, isTeacher, externalRoleMiddleware } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Super Admin or Admin-only routes
router.post('/create', [isAdmin], createExam);
router.get('/school/:schoolId', [isAdmin], getExamsBySchool);
router.get('/summary', [isAdmin], getExamSummary);
router.put('/:examId', [isAdmin], updateExam);

// Teacher-only routes
router.get('/teacher', [isTeacher], getExamsByTeacher); // For listing in ResultListComponent
router.get('/teacher/exams', [isTeacher], getExamsForResultEntry); // For result entry
router.get('/history/:classId', [isTeacher, externalRoleMiddleware(['teacher'])], getExamHistory);
router.get('/teacher/:examId', [isTeacher], getExamById); // Ensure this doesn’t conflict
router.get('/:examId', [isAdmin], getExamById);

module.exports = router;