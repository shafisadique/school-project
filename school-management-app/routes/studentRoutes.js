// routes/student.routes.js

const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student/studentController');
const authMiddleware = require('../middleware/authMiddleware');
const checkFeatureAccess = require('../middleware/checkFeatureAccess');
const requirePortalAccess = checkFeatureAccess('student_portal');

router.get('/list', authMiddleware, studentController.getStudents);

// === SPECIFIC ROUTES (MUST COME FIRST) ===
router.get('/search/:query', authMiddleware, studentController.searchStudents);
router.get('/get-student-by-class/:classId', authMiddleware, studentController.getStudentsByClass);
router.get('/validate-parent/:studentId', authMiddleware, studentController.validateParent);
router.get('/old-students', authMiddleware, studentController.getOldStudents);

// === PHOTO ROUTE ===
router.put('/:id/photo', authMiddleware, studentController.uploadStudentPhoto);

// === ROLL NUMBER ASSIGNMENT ROUTES ===
router.post('/assign-roll-numbers', authMiddleware, studentController.assignRollNumbers);
router.post('/assign-roll-numbers-alphabetically', authMiddleware, studentController.assignRollNumbersAlphabetically);
router.put('/:id/assign-roll-number', authMiddleware, studentController.assignRollNumberToStudent); // NEW: Manual single student roll number

// === GENERIC ROUTES (LAST) ===
router.get('/:id', authMiddleware, studentController.getStudent);

// === OTHER ROUTES ===
router.post('/add', authMiddleware, studentController.createStudent);
router.post('/bulk-create', authMiddleware, studentController.bulkCreateStudents);
router.put('/:id', authMiddleware, studentController.updateStudent);
router.post('/promote', authMiddleware, studentController.promoteStudents);
router.post('/create-portal', authMiddleware,requirePortalAccess, studentController.createStudentPortal);
router.post('/soft-delete', authMiddleware, studentController.softDeleteStudents);

module.exports = router;