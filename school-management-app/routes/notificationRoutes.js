// routes/notifications.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const mongoose = require('mongoose');
const Student = require('../models/student');
const User = require('../models/user');
const ProgressReport = require('../models/progressReport');
const Notification = require('../models/notifiation'); // Correct import
const APIError = require('../utils/apiError');
const progressReport = require('../models/progressReport');

// Submit Progress Report (Teacher)
router.post('/submit-progress-report', authMiddleware, async (req, res) => {
  try {
    const { studentProgress } = req.body;
    if (!studentProgress || !Array.isArray(studentProgress) || studentProgress.length === 0) {
      throw new APIError('Student progress data is required', 400);
    }

    const senderId = req.user._id || req.user.id;
    if (!senderId || !mongoose.Types.ObjectId.isValid(senderId)) {
      throw new APIError('Sender ID is required and must be valid', 400);
    }

    const sender = await User.findById(senderId);
    if (!sender || sender.role !== 'teacher') {
      throw new APIError('Only teachers can submit progress reports', 403);
    }

    const progressReports = [];
    const notifications = [];
    for (const item of studentProgress) {
      const { studentId, grades, comments } = item;
      if (!studentId || !mongoose.Types.ObjectId.isValid(studentId) || !grades || !comments) {
        console.log(`Skipping invalid entry: studentId=${studentId}, grades=${JSON.stringify(grades)}, comments=${comments}`);
        continue;
      }

      const studentObjectId = new mongoose.Types.ObjectId(studentId);
      const student = await Student.findById(studentObjectId).select('name schoolId admissionNo');
      if (!student) {
        console.log(`Student not found: studentId=${studentId}`);
        continue;
      }
      if (student.schoolId.toString() !== req.user.schoolId.toString()) {
        console.log(`Student not in teacher's school: studentId=${studentId}, student.schoolId=${student.schoolId}, teacher.schoolId=${req.user.schoolId}`);
        continue;
      }

      const report = {
        schoolId: req.user.schoolId,
        studentId: studentObjectId,
        createdBy: senderId,
        grades,
        comments
      };
      progressReports.push(report);

      const parents = await User.find({
        role: 'parent',
        schoolId: req.user.schoolId,
        'additionalInfo.parentOfStudentId': studentObjectId
      }).select('_id name');
      console.log(`Found ${parents.length} parents for studentId=${studentId}:`, parents.map(p => p._id.toString()));

      if (parents.length === 0) {
        console.log(`No parents found for studentId=${studentId}, skipping notification`);
      } else {
        parents.forEach(parent => {
          const notification = {
            schoolId: req.user.schoolId,
            studentId: studentObjectId,
            senderId,
            recipientId: parent._id,
            type: 'progress-report',
            title: `New Progress Report for ${student.name}`,
            message: `A new weekly progress report has been submitted for ${student.name} (Admission No: ${student.admissionNo}).`,
            data: { studentName: student.name, reportId: null },
            status: 'pending',
            createdAt: new Date() // Ensure createdAt is set
          };
          notifications.push(notification);
          console.log(`Queued notification for recipientId=${parent._id}, studentId=${studentId}`);
        });
      }
    }

    if (progressReports.length === 0) {
      throw new APIError('No valid student progress data provided', 400);
    }

    const savedReports = await ProgressReport.insertMany(progressReports, { ordered: false });
    console.log(`Saved ${savedReports.length} progress reports:`, savedReports.map(r => ({ id: r._id.toString(), studentId: r.studentId.toString() })));

    // Assign reportIds to notifications
    notifications.forEach(notification => {
      const report = savedReports.find(r => r.studentId.toString() === notification.studentId.toString());
      if (report) {
        notification.data.reportId = report._id;
      } else {
        console.log(`No matching report found for notification studentId=${notification.studentId}`);
      }
    });

    if (notifications.length > 0) {
      try {
        const savedNotifications = await Notification.insertMany(notifications, { ordered: false });
        console.log(`Successfully saved ${savedNotifications.length} notifications:`, savedNotifications.map(n => ({
          id: n._id.toString(),
          recipientId: n.recipientId.toString(),
          studentId: n.studentId.toString()
        })));
      } catch (err) {
        console.error('Error saving notifications:', err.message);
        // Log but continue, as progress reports are the priority
      }
    } else {
      console.log('No notifications to save');
    }

    res.json({ message: 'Progress reports saved successfully', reportIds: savedReports.map(r => r._id) });
  } catch (err) {
    console.error('Error submitting progress report:', err.message);
    res.status(err.statusCode || 500).json({ error: 'Failed to save progress reports', details: err.message });
  }
});

// Get Progress Reports for Parent
router.get('/parent-progress-reports', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user._id || req.user.id;
    if (!parentId || !mongoose.Types.ObjectId.isValid(parentId)) {
      throw new APIError('Valid parent ID is required', 400);
    }

    const parent = await User.findById(parentId);
    if (!parent || parent.role !== 'parent') {
      throw new APIError('Only parents can access this endpoint', 403);
    }

    const studentId = parent.additionalInfo?.parentOfStudentId;
    console.log(`Fetching progress reports for parentId=${parentId}, studentId=${studentId}`);
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      console.log(`No linked student for parentId=${parentId}`);
      return res.status(200).json([]);
    }

    const reports = await ProgressReport.find({
      studentId,
      schoolId: req.user.schoolId
    })
      .populate('studentId', 'name admissionNo')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    console.log(`Found ${reports.length} progress reports for studentId=${studentId}`);

    res.json(reports);
  } catch (err) {
    console.error('Error fetching parent progress reports:', err.message);
    res.status(err.statusCode || 500).json({ error: 'Failed to fetch progress reports', details: err.message });
  }
});

// Get Notifications for Parent
router.get('/parent', authMiddleware, async (req, res) => {
  try {
    console.log('req.user:', req.user);
    const parentId = req.user._id || req.user.id;
    if (!parentId || !mongoose.Types.ObjectId.isValid(parentId)) {
      throw new APIError('Valid parent ID is required', 400);
    }

    const parent = await User.findById(parentId);
    if (!parent || parent.role !== 'parent') {
      throw new APIError('Only parents can access this endpoint', 403);
    }

    const studentId = parent.additionalInfo?.parentOfStudentId;
    console.log(`ParentId=${parentId}, StudentId=${studentId}`);
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      console.log(`No linked student for parentId=${parentId}`);
      return res.status(200).json({ notifications: [], total: 0, page: 1, pages: 0 });
    }

    const { page = 1, limit = 10, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {
      recipientId: parentId,
      studentId,
      schoolId: req.user.schoolId
    };
    if (type) filter.type = type;
    console.log('Notification filter:', filter);

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('studentId', 'name admissionNo')
      .populate('senderId', 'name');
    console.log(`Found ${notifications.length} notifications`);

    const total = await Notification.countDocuments(filter);

    res.json({
      notifications,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('Error fetching parent notifications:', err.message);
    res.status(err.statusCode || 500).json({ error: 'Failed to fetch notifications', details: err.message });
  }
});

// Mark Notification as Read
router.patch('/:notificationId/read', authMiddleware, async (req, res) => {
  try {
    const { notificationId } = req.params;
    if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
      throw new APIError('Valid notification ID is required', 400);
    }

    const parentId = req.user._id || req.user.id;
    if (!parentId || !mongoose.Types.ObjectId.isValid(parentId)) {
      throw new APIError('Valid parent ID is required', 400);
    }

    const parent = await User.findById(parentId);
    if (!parent || parent.role !== 'parent') {
      throw new APIError('Only parents can mark notifications as read', 403);
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      recipientId: parentId,
      schoolId: req.user.schoolId
    });

    if (!notification) {
      throw new APIError('Notification not found or not authorized', 404);
    }

    notification.status = 'delivered';
    await notification.save();

    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Error marking notification as read:', err.message);
    res.status(err.statusCode || 500).json({ error: 'Failed to mark notification as read', details: err.message });
  }
});

module.exports = router;