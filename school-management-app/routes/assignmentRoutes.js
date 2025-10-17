const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignment/assignmentController');
const authMiddleware = require('../middleware/authMiddleware');

// Wrap Multer to handle errors and call controller
router.post('/create', authMiddleware, (req, res, next) => {
  assignmentController.upload.array('attachments', 5)(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err); // Log for debugging
      return next(err); // Pass to global error handler
    }
    // No error: Proceed to controller
    assignmentController.createAssignment(req, res, next);
  });
});

router.get('/teacher/:teacherId', authMiddleware, assignmentController.getTeacherAssignments);

// Comment out until implemented
// router.get('/student', authMiddleware, assignmentController.getStudentAssignments);

// Fix /submit similarly
// router.post('/:id/submit', authMiddleware, (req, res, next) => {
//   assignmentController.upload.array('submittedFiles', 5)(req, res, (err) => {
//     if (err) {
//       console.error('Multer error on submit:', err);
//       return next(err);
//     }
//     assignmentController.submitAssignment(req, res, next);
//   });
// });
router.get('/teacher/:teacherId', authMiddleware, assignmentController.getTeacherAssignments);
router.get('/:id/details', authMiddleware, assignmentController.getAssignmentDetails);
router.put('/:assignmentId/grade', authMiddleware, assignmentController.gradeAssignment);
router.put('/:id/bulk-grade', authMiddleware, assignmentController.bulkGradeAssignment);
router.post('/:id/submit', authMiddleware, (req, res, next) => {
  assignmentController.upload.array('submittedFiles', 5)(req, res, (err) => {
    if (err) {
      console.error('Multer error on submit:', err);
      return next(err);
    }
    assignmentController.submitAssignment(req, res, next);
  });
});

module.exports = router;