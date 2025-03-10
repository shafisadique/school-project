const express = require('express');
const router = express.Router();
const { addSchool, getSchoolById,updateSchool,setAcademicYear,getSchoolByUser,uploadSchoolLogo } = require('../controllers/school/schoolController');
const { isAdmin } = require('../middleware/roleMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// Protected routes (require authentication)
router.use(authMiddleware);

// Super Admin only routes
router.post('/', isAdmin, addSchool);
router.get('/:id',authMiddleware,getSchoolById);
router.put('/update/:id', updateSchool);
router.post('/academic-year', setAcademicYear);
router.get('/user/:userId', getSchoolByUser); // ✅ Fetch school by user ID
router.post('/:id/logo', upload.single('logo'), uploadSchoolLogo);
module.exports = router;