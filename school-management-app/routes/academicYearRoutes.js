const express = require('express');
const router = express.Router();
const academicYearController = require('../controllers/academicYear/academicYearController');
const  authMiddleware  = require('../middleware/authMiddleware');



router.use(authMiddleware);

// 📌 Create a new academic year
router.post('/create', academicYearController.createAcademicYear);

router.post('/set', academicYearController.setAcademicYear);


// 📌 Get all academic years for a school
router.get('/:schoolId', academicYearController.getAcademicYearsBySchool);

// 📌 Update the active academic year
router.put('/update', academicYearController.updateAcademicYear);

// 📌 Get the current active academicyear
router.get('/active/:schoolId', academicYearController.getActiveAcademicYear);

router.post('/activate/:schoolId', academicYearController.activateAcademicYear);

// 📌 Get a student's academic year history
router.get('/student/:studentId', academicYearController.getStudentAcademicYears);



module.exports = router;
