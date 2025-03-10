const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacher/teacherController');
const authMiddleware = require('../middleware/authMiddleware'); 
const multer = require('multer');
const { upload } = teacherController; 


// ✅ Multer Storage for File Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');  // Save images to `uploads` folder
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});


// ✅ Add Teacher (Admin Only)
router.post('/add',
  authMiddleware,
  teacherController.upload.single('profileImage'),
  (req, res, next) => {
    // Handle Multer errors
    if (req.fileValidationError) {
      return res.status(400).json({ 
        message: 'File upload failed',
        error: req.fileValidationError 
      });
    }
    if (req.file?.size > 2 * 1024 * 1024) {
      return res.status(400).json({
        message: 'File upload failed',
        error: 'File size exceeds 2MB limit'
      });
    }
    next();
  },
  teacherController.addTeacher
);

// ✅ Get All Teachers for a School (Admin Only)
router.get('/list', authMiddleware, teacherController.getTeachersBySchool);

// ✅ Get Teacher by ID
router.get('/:teacherId', authMiddleware, teacherController.getTeacherById);

// ✅ Upload Teacher Profile Image
router.post('/upload/:teacherId', authMiddleware, upload.single('profileImage'), teacherController.uploadTeacherPhoto);


module.exports = router;
