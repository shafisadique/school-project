const express = require('express');
const router = express.Router();
const {
  createResult, getResultsByExam, getStudentResults,
  getResultsByClassAndAcademicYear, createPartialResult,
  compileResult, getPartialResults,
  getAllResultsForClass
} = require('../controllers/result/resultController');
const authMiddleware = require('../middleware/authMiddleware');
const { isTeacher, externalRoleMiddleware, isAdmin } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Creation Routes
router.post('/create', [isTeacher, externalRoleMiddleware(['teacher'])], createResult); // Create compiled result
router.post('/partial', [isTeacher], createPartialResult); // Create partial result

// Retrieval Routes
router.get('/partial', [isTeacher], getPartialResults); // Get partial results
router.get('/exam/:examId', [isTeacher, externalRoleMiddleware(['teacher'])], getResultsByExam); // Get results by exam
router.get('/student/:studentId', [isTeacher, externalRoleMiddleware(['teacher'])], getStudentResults); // Get student results
router.get('/class/:classId', [authMiddleware, externalRoleMiddleware(['teacher', 'admin', 'superadmin'])], getResultsByClassAndAcademicYear);
router.get('/admin/class/:classId', [isAdmin], getAllResultsForClass);

// Compilation Route
router.post('/compile', [isAdmin], compileResult); // Compile partial results

module.exports = router;