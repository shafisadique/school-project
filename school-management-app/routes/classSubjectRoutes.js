const express = require('express');
const router = express.Router();
const {
  createClass,
  getClassesBySchool,
  createSubject,
  getAssignmentsByTeacher,
  getSubjectsBySchool,
  assignSubjectToClass,
  getCombinedAssignments,
  getTeachersBySchoolId,
  updateAttendanceTeachers,
  assignSubjectToClassUpdate,
} = require('../controllers/classSubjectManagement/classSubjectController');

const authMiddleware = require('../middleware/authMiddleware');

// ✅ Protected Routes (Require Authentication)
router.use(authMiddleware);

// 🏫 **Class Management**
router.post('/classes', createClass);
router.get('/classes/:schoolId', getClassesBySchool);

// 📚 **Subject Management**
router.post('/subject', createSubject);
router.get('/subjects/:schoolId', getSubjectsBySchool);
router.put('/assign-subject', assignSubjectToClassUpdate);

// 🔗 **Assign Subject to Class**
router.post('/assign-subject', assignSubjectToClass);
router.get('/assignments/:schoolId', getCombinedAssignments);
router.get('/teachers/by-school/:schoolId', getTeachersBySchoolId);
// router.get('/list', getStudentsByClass);

router.get('/assignments/teacher/:teacherId', getAssignmentsByTeacher);
router.put('/update-attendance-teachers', updateAttendanceTeachers);

module.exports = router;
