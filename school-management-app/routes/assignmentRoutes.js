const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignment/assignmentController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/add', authMiddleware, assignmentController.upload.array('attachments', 5), assignmentController.createAssignment);
router.get('/teacher', authMiddleware, assignmentController.getTeacherAssignments);
router.get('/student', authMiddleware, assignmentController.getStudentAssignments);
router.post('/:id/submit', authMiddleware, assignmentController.upload.array('submittedFiles', 5), assignmentController.submitAssignment);
router.put('/:id/grade', authMiddleware, assignmentController.gradeAssignment);

module.exports = router;