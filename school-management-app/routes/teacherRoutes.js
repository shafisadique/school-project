const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacher/teacherController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/add', authMiddleware, teacherController.upload.single('profileImage'), teacherController.addTeacher);
router.get('/list', authMiddleware, teacherController.getTeachersBySchool);
router.get('/:id', authMiddleware, teacherController.getTeacher);
router.put('/:id/photo', authMiddleware, teacherController.upload.single('profileImage'), teacherController.uploadTeacherPhoto);
router.put('/:id', authMiddleware, teacherController.upload.single('profileImage'), teacherController.updateTeacher);
router.delete('/:id', authMiddleware, teacherController.softDeleteTeacher);

module.exports = router;