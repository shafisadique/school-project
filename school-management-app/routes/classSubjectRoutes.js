const express = require('express');
const router = express.Router();
const {
  createClass,
  getClassesBySchool,
  createSubject,
  getSubjectsBySchool,
  assignSubjectToClass,
  getTeachersBySchoolId,
} = require('../controllers/classSubjectManagement/classSubjectController');

const authMiddleware = require('../middleware/authMiddleware');

// ✅ Protected Routes (Require Authentication)
router.use(authMiddleware);

// 🏫 **Class Management**
router.post('/classes', createClass);
router.get('/classes/:schoolId', getClassesBySchool);

// 📚 **Subject Management**
router.post('/subjects', createSubject);
router.get('/subjects/:schoolId', getSubjectsBySchool);

// 🔗 **Assign Subject to Class**
router.put('/assign-subject', assignSubjectToClass);
router.get('/teachers/by-school/:schoolId', getTeachersBySchoolId);


module.exports = router;
