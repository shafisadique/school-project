const express = require('express');
const router = express.Router();
const teacherAbsenceController = require('../controllers/teacher/teacherAbsentController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/add',authMiddleware, teacherAbsenceController.addAbsence);
router.get('/list/:schoolId',authMiddleware, teacherAbsenceController.getAbsences);
router.put('/update/:id', authMiddleware,teacherAbsenceController.updateAbsence);
router.delete('/delete/:id', authMiddleware,teacherAbsenceController.deleteAbsence);
router.get('/pending', authMiddleware, teacherAbsenceController.getPendingAbsences);
module.exports = router;