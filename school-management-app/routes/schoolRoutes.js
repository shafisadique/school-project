const express = require('express');
const router = express.Router();
const { addSchool, getSchoolById, updateSchool, setAcademicYear, getSchoolByUser, uploadSchoolLogo, getSchools, updateSchoolStatus } = require('../controllers/school/schoolController');
const { isAdmin } = require('../middleware/roleMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// Protected routes (require authentication)
router.use(authMiddleware);

// Super Admin only routes
router.post('/', isAdmin, addSchool); // Add a new school
router.get('/all', isAdmin, getSchools); // Get all schools (admin only)
router.get('/:id', authMiddleware, getSchoolById); // Get school by ID
router.put('/update/:id', authMiddleware, updateSchool); // Update school by ID
router.post('/academic-year', authMiddleware, setAcademicYear); // Set academic year
router.get('/user/:userId', authMiddleware, getSchoolByUser); // Fetch school by user ID
router.post('/:id/logo', [authMiddleware, upload.single('logo')], uploadSchoolLogo); // Upload school logo
router.put('/status/:id', isAdmin, updateSchoolStatus);
// New route: Soft delete or update school status (admin only)
router.put('/status/:id', isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (status === undefined) {
      return res.status(400).json({ message: 'Status is required' });
    }
    const updatedSchool = await School.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!updatedSchool) {
      return res.status(404).json({ message: 'School not found' });
    }
    res.status(200).json({ message: 'School status updated successfully', school: updatedSchool });
  } catch (err) {
    res.status(500).json({ message: 'Error updating school status', error: err.message });
  }
});

module.exports = router;