// models/notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // For direct message to one user
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // For sending to all users of a role (e.g. all teachers)
  targetRoles: [{ 
    type: String, 
    enum: ['admin', 'teacher', 'parent', 'student'] 
  }],

  // For sending to specific multiple users
  targetUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },

  type: {
    type: String,
    enum: ['welcome', 'progress-report', 'absence', 'fee-alert', 'assignment', 'announcement', 'general'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }, // dueDate, attachment, etc.
  status: { type: String, enum: ['pending', 'sent', 'read', 'delivered'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  readAt: { type: Date }
});

module.exports = mongoose.model('Notification', notificationSchema);