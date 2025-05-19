const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/time-table/timetableController');
const { isAdmin, isTeacher } = require('../middleware/roleMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Routes
router.post('/create', isAdmin, timetableController.createTimetable); // Create timetable entry (Admin only)
router.get('/school/:schoolId', isAdmin, timetableController.getTimetableBySchool); // Get school timetable (Admin only)
router.get('/teacher/:teacherId', isTeacher, timetableController.getScheduleByTeacher); // Get teacher schedule (Teacher only)
router.delete('/:timetableId', isAdmin, timetableController.deleteTimetableEntry); // Delete timetable entry (Admin only)

module.exports = router;