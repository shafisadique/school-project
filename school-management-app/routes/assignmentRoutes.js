const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignment/assignmentController');
const authMiddleware = require('../middleware/authMiddleware');
const { isStudent } = require('../middleware/roleMiddleware');

// Teacher: Create assignment (with file upload)
router.post('/create', authMiddleware, (req, res, next) => {
  assignmentController.upload.array('attachments', 5)(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return next(err);
    }
    assignmentController.createAssignment(req, res, next);
  });
});

// Teacher: Get own assignments
router.get('/teacher/:teacherId', authMiddleware, assignmentController.getTeacherAssignments);

// Teacher: Assignment details with submissions
router.get('/:id/details', authMiddleware, assignmentController.getAssignmentDetails);

// Teacher: Grade single
router.put('/:assignmentId/grade', authMiddleware, assignmentController.gradeAssignment);

// Teacher: Bulk grade
router.put('/:id/bulk-grade', authMiddleware, assignmentController.bulkGradeAssignment);

// NEW: Student: Get all assignments (list)
router.get('/student', authMiddleware, isStudent, assignmentController.getStudentAssignments);
router.get('/proxy-file/:key', authMiddleware, assignmentController.proxyFile);

// FIXED: Student: Get single assignment details (with :id param)
router.get('/my-assignment/:id', authMiddleware, isStudent, assignmentController.getStudentAssignmentDetails);

// COMMENTED: Student submit (not needed for paper submissions; add later if digital)
router.post('/:id/submit', authMiddleware, isStudent, (req, res, next) => {
  // assignmentController.upload.array('submittedFiles', 5)(req, res, (err) => {
  //   if (err) {
  //     console.error('Multer error on submit:', err);
  //     return next(err);
  //   }
  //   assignmentController.submitAssignment(req, res, next);
  // });
});

module.exports = router;