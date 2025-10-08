const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notiffication/notificationController'); // Fixed typo
const Notification = require('../models/notifiation'); // Added import
const notificationService = require('../services/notificationService');

router.post('/', authMiddleware, notificationController.sendNotification);
router.get('/:recipientId?', authMiddleware, notificationController.getNotifications);
router.put('/:id/read', authMiddleware, notificationController.markAsRead);
router.post('/submit-progress-report', authMiddleware, async (req, res) => {
  try {
    const { studentId, message, data, parentId } = req.body;
    const teacherId = req.user._id; // Assuming auth middleware sets req.user

    const notification = new Notification({
      schoolId: req.user.schoolId, // Assuming teacher has schoolId
      studentId,
      senderId: teacherId,
      type: 'progress-report',
      title: 'Weekly Progress Report',
      message,
      recipientId: parentId,
      data
    });

    await notificationService.deliver(notification);
    res.json({ message: 'Progress report sent', notificationId: notification._id });
  } catch (err) {
    console.error('Error submitting progress report:', err.message);
    res.status(500).json({ error: 'Failed to send progress report', details: err.message });
  }
});

module.exports = router;