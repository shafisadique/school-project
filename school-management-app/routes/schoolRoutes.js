const express = require('express');
const router = express.Router();
const { getSchoolById, updateSchool, setAcademicYear, getSchoolByUser, uploadSchoolLogo, getSchools, updateSchoolStatus, getSchoolByTeacher } = require('../controllers/school/schoolController');
const { isAdmin, isSuperAdmin, isTeacher } = require('../middleware/roleMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// Protected routes (require authentication)
router.use(authMiddleware);

// Super Admin only routes
router.get('/all', isSuperAdmin, getSchools); // Get all schools (admin only)
router.get('/:id',isAdmin, authMiddleware, getSchoolById); // Get school by ID
router.put('/update/:id',isAdmin, authMiddleware, updateSchool); // Update school by ID
router.post('/academic-year',isAdmin, authMiddleware, setAcademicYear); // Set academic year
router.get('/user/:userId',isAdmin, authMiddleware, getSchoolByUser); // Fetch school by user ID
router.post('/:id/logo', [authMiddleware, upload.single('logo')], uploadSchoolLogo); // Upload school logo
router.put('/status/:id', isAdmin, updateSchoolStatus);

router.get('/teacher/:id', [authMiddleware, isTeacher],getSchoolByTeacher);

module.exports = router;