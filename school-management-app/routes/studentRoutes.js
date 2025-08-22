// routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student/studentController');
const authMiddleware = require('../middleware/authMiddleware');

// Existing routes...
router.post('/add',
  authMiddleware,
  studentController.upload.single('profileImage'),
  studentController.createStudent
);

router.post('/bulk-create', authMiddleware, studentController.bulkCreateStudents);
router.get('/list', authMiddleware, studentController.getStudents);
router.get('/:id', authMiddleware, studentController.getStudent);
router.put('/:id', authMiddleware, studentController.updateStudent);
router.put('/:id/photo',
  authMiddleware,
  studentController.upload.single('profileImage'),
  studentController.uploadStudentPhoto
);
router.get('/search/:query', authMiddleware, studentController.searchStudents);
router.post('/assign-roll-numbers', authMiddleware, studentController.assignRollNumbers);
router.post('/assign-roll-numbers-alphabetically', authMiddleware, studentController.assignRollNumbersAlphabetically);
router.get('/get-student-by-class/:classId', authMiddleware, studentController.getStudentsByClass);
router.post('/promote', authMiddleware, studentController.promoteStudents);
router.post('/create-portal',authMiddleware, studentController.createStudentPortal);

// New route for parent validation
router.get('/validate-parent/:studentId', authMiddleware, studentController.validateParent);
module.exports = router;