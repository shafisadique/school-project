const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacher/teacherController');
const authMiddleware = require('../middleware/authMiddleware'); 
const { upload } = teacherController; 

router.post('/add', authMiddleware, teacherController.upload.single('profileImage'), teacherController.addTeacher);
router.get('/list', authMiddleware, teacherController.getTeachersBySchool);
router.get('/:schoolId', authMiddleware, teacherController.getTeacher);
router.post('/upload/:teacherId', authMiddleware, upload.single('profileImage'), teacherController.uploadTeacherPhoto);
router.put('/:id', authMiddleware, teacherController.upload.single('profileImage'), teacherController.updateTeacher);

module.exports = router;
