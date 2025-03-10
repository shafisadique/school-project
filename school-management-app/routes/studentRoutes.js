const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student/studentController');
const authMiddleware = require('../middleware/authMiddleware'); 
const multer = require('multer');

// ✅ Setup Multer for File Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/students/');  
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// ✅ Add Student (Admin Only)
router.post('/add', 
  authMiddleware, 
  upload.single('profileImage'), // Add this line
  studentController.addStudent
);

// ✅ Get All Students for a School (Admin Only)
router.get('/list', authMiddleware, studentController.getStudentsBySchool);

// ✅ Get Student by ID
router.get('/search',  authMiddleware, studentController.searchStudents);
router.get('/:studentId', authMiddleware, studentController.getStudentById);
// ✅ Upload Student Profile Image
router.post('/upload/:studentId', authMiddleware, upload.single('profileImage'), studentController.uploadStudentPhoto);

module.exports = router;
