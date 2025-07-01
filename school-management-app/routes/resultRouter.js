const express = require('express');
const router = express.Router();
const { createResult, getResultsByExam, getStudentResults, getResultsByClassAndAcademicYear } = require('../controllers/result/resultController');
const authMiddleware = require('../middleware/authMiddleware');
const { isTeacher, externalRoleMiddleware } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Teacher-only routes
router.post('/create', [isTeacher, externalRoleMiddleware(['teacher'])], createResult); // Create a result (Teacher with subject/class access)
router.get('/exam/:examId', [isTeacher, externalRoleMiddleware(['teacher'])], getResultsByExam); // Get results for an exam (Teacher with class access)
router.get('/student/:studentId', [isTeacher, externalRoleMiddleware(['teacher'])], getStudentResults); // Get results for a student (Teacher with class access)
router.get('/class/:classId', [isTeacher, externalRoleMiddleware(['teacher'])], getResultsByClassAndAcademicYear); // Get results for a class and academic year (Teacher with class access)

module.exports = router;