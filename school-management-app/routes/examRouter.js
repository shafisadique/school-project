// routes/exam.js
const express = require('express');
const router = express.Router();
const { 
  createExam, 
  updateExam, 
  getExamById,
  getExamsByTeacher, 
  getExamsForResultEntry,
  getExamHistory,
  getExamsBySchool,
  getExamSummary 
} = require('../controllers/exam/examController');

const authMiddleware = require('../middleware/authMiddleware');
const { isAdmin, isTeacher } = require('../middleware/roleMiddleware');
const checkFeatureAccess = require('../middleware/checkFeatureAccess');

router.use(authMiddleware);

// Apply feature check ONLY where exam creation/modification happens
const requireExamFeature = checkFeatureAccess('exam');

// Super Admin or Admin-only routes + Premium required
router.post('/create', [isAdmin, requireExamFeature], createExam);
router.put('/:examId', [isAdmin, requireExamFeature], updateExam);

// These are safe (read-only or teacher access) → no need to block completely
// But you can optionally restrict creation-only actions
router.get('/school/:schoolId', [isAdmin], getExamsBySchool); // Can allow viewing
router.get('/summary', [isAdmin], getExamSummary);

router.get('/teacher', [isTeacher], getExamsByTeacher);
router.get('/teacher/exams', [isTeacher], getExamsForResultEntry);
router.get('/history/:classId', [isTeacher], getExamHistory);
router.get('/:examId', getExamById); // Allow both admin & teacher with ID

module.exports = router;