const express = require('express');
const router = express.Router();
const teacherAbsenceController = require('../controllers/attendance/teacherabsence');
const authMiddleware = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.post('/mark', isAdmin, teacherAbsenceController.markTeacherAbsence);
router.get('/:teacherId', isAdmin, teacherAbsenceController.getTeacherAbsences);

module.exports = router;