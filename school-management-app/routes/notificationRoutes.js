// routes/notifications.js — CLEAN & PROFESSIONAL (2025 Standard)

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const authMiddleware = require('../middleware/authMiddleware');
const APIError = require('../utils/apiError');

// Models
const Student = require('../models/student');
const User = require('../models/user');
const ProgressReport = require('../models/progressReport');
const Notification = require('../models/notifiation'); // ← Fixed typo!

/* ==================================================================
   1. TEACHER: Submit Weekly Progress Reports
   ================================================================== */
router.post('/submit-progress-report', authMiddleware, async (req, res) => {
  try {
    const { studentProgress } = req.body;
    if (!Array.isArray(studentProgress) || studentProgress.length === 0) {
      throw new APIError('studentProgress array is required', 400);
    }

    const teacherId = req.user._id;
    const schoolId = req.user.schoolId;

    // Verify sender is a teacher
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      throw new APIError('Only teachers can submit progress reports', 403);
    }

    const reportsToSave = [];
    const notificationsToSave = [];

    for (const item of studentProgress) {
      const { studentId, grades, comments } = item;

      if (!mongoose.Types.ObjectId.isValid(studentId)) continue;

      const student = await Student.findOne({
        _id: studentId,
        schoolId
      }).select('name admissionNo parents');

      if (!student) continue; // Skip invalid student

      // Save Progress Report
      reportsToSave.push({
        schoolId,
        studentId,
        createdBy: teacherId,
        grades,
        comments
      });

      // Find parents of this student
      const parents = await User.find({
        role: 'parent',
        schoolId,
        'additionalInfo.parentOfStudentId': studentId
      }).select('_id name');

      // Create notification for each parent
      parents.forEach(parent => {
        notificationsToSave.push({
          schoolId,
          senderId: teacherId,
          recipientId: parent._id,
          studentId,
          type: 'progress-report',
          title: `Progress Report: ${student.name}`,
          message: `New progress report submitted for ${student.name} (Adm: ${student.admissionNo})`,
          data: { studentName: student.name },
          status: 'pending'
        });
      });
    }

    if (reportsToSave.length === 0) {
      throw new APIError('No valid students found', 400);
    }

    // Save reports
    const savedReports = await ProgressReport.insertMany(reportsToSave);

    // Attach report ID to notifications
    notificationsToSave.forEach(notif => {
      const report = savedReports.find(r => r.studentId.toString() === notif.studentId.toString());
      if (report) notif.data.reportId = report._id;
    });

    // Save notifications (fire and forget if fails — reports are priority)
    if (notificationsToSave.length > 0) {
      await Notification.insertMany(notificationsToSave).catch(err => {
        console.error('Failed to save some notifications:', err);
      });
    }

    res.json({
      message: 'Progress reports submitted successfully',
      savedCount: savedReports.length
    });

  } catch (err) {
    console.error('Submit progress report error:', err);
    res.status(err.statusCode || 500).json({
      error: err.message || 'Server error'
    });
  }
});

/* ==================================================================
   2. PARENT: Get My Child's Progress Reports
   ================================================================== */
router.get('/parent-progress-reports', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user._id;
    const parent = await User.findById(parentId);
    if (!parent || parent.role !== 'parent') {
      throw new APIError('Unauthorized', 403);
    }

    const studentId = parent.additionalInfo?.parentOfStudentId;
    if (!studentId) return res.json([]);

    const reports = await ProgressReport.find({
      studentId,
      schoolId: req.user.schoolId
    })
      .populate('studentId', 'name admissionNo')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

/* ==================================================================
   3. PARENT: Get My Notifications (Bell Icon)
   ================================================================== */
router.get('/parent', authMiddleware, async (req, res) => {
  try {
    const parentId = req.user._id;
    const parent = await User.findById(parentId);
    if (!parent || parent.role !== 'parent') {
      throw new APIError('Unauthorized', 403);
    }

    const studentId = parent.additionalInfo?.parentOfStudentId;
    if (!studentId) return res.json({ notifications: [] });

    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {
      recipientId: parentId,
      studentId,
      schoolId: req.user.schoolId
    };

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('senderId', 'name')
        .populate('studentId', 'name admissionNo'),
      Notification.countDocuments(filter)
    ]);

    res.json({
      notifications,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

/* ==================================================================
   4. UNIVERSAL BELL NOTIFICATIONS – WORKS FOR TEACHER, PARENT, ADMIN
   ================================================================== */

// routes/notifications.js → REPLACE /me route with THIS
// router.get('/me', authMiddleware, async (req, res) => {
//   try {
//     console.log(req.user)
//     const userId = req.user.id; // This is already ObjectId from authMiddleware
//     const role = req.user.role;
//     const schoolId = req.user.schoolId;

//     // IMPORTANT: Convert to ObjectId only if needed (usually not — your auth already gives ObjectId)
//     const objectId = mongoose.Types.ObjectId.isValid(userId) 
//       ? new mongoose.Types.ObjectId(userId) 
//       : userId;

//     const notifications = await Notification.find({
//       schoolId,
//       $or: [
//         { recipientId: objectId },                    // ← Works for your current DB
//         { recipientId: userId },                      // ← Backup (if string)
//         { targetUserIds: objectId },
//         { targetUserIds: userId },
//         { targetRoles: role },
//         { targetRoles: { $in: [role] } }
//       ]
//     })
//       .select('title message type status createdAt senderId studentId data')
//       .populate('senderId', 'name')
//       .populate('studentId', 'name admissionNo')
//       .sort({ createdAt: -1 })
//       .limit(50)
//       .lean();

//     const unreadCount = notifications.filter(n => 
//       n.status === 'pending' || n.status === 'sent'
//     ).length;

//     res.json({
//       notifications,
//       unreadCount
//     });

//   } catch (err) {
//     console.error('Bell notification error:', err);
//     res.status(500).json({ error: 'Failed' });
//   }
// });

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const schoolId = req.user.schoolId;

    // Convert to ObjectId if needed
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;

    const notifications = await Notification.find({
      schoolId,
      $or: [
        { recipientId: userObjectId },                    // Direct message
        { recipientId: userId },
        { targetRoles: role },                            // ← THIS WAS MISSING
        { targetRoles: { $in: [role] } },                 // ← THIS WAS MISSING
        { targetUserIds: userObjectId },
        { targetUserIds: userId },
        { senderId: userObjectId }                        // Admin sees own announcements
      ]
    })
      .select('title message type status createdAt senderId')
      .populate('senderId', 'name')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = notifications.filter(n => 
      n.status === 'pending' || n.status === 'sent'
    ).length;

    res.json({
      notifications,
      unreadCount
    });

  } catch (err) {
    console.error('Bell API error:', err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

// MARK AS READ
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const result = await Notification.updateOne(
      { _id: req.params.id, recipientId: req.user.id },
      { status: 'read', readAt: new Date() }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: 'Not found or unauthorized' });
    }

    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

/* ==================================================================
   5. Mark Notification as Read
   ================================================================== */
router.patch('/:notificationId/read', authMiddleware, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientId: userId },
      { status: 'read', readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      throw new APIError('Notification not found or unauthorized', 404);
    }

    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;