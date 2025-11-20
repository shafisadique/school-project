const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacher/teacherController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/add', authMiddleware, teacherController.upload, teacherController.addTeacher);
router.get('/list', authMiddleware, teacherController.getTeachersBySchool);
router.get('/:id', authMiddleware, teacherController.getTeacher);
router.put('/:id/photo', authMiddleware, teacherController.upload, teacherController.uploadTeacherPhoto);
router.put('/:id', authMiddleware, teacherController.upload, teacherController.updateTeacher);
router.delete('/:id', authMiddleware, teacherController.softDeleteTeacher);

module.exports = router;