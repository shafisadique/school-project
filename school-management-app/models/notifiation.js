const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link to recipient (user)
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true }, // Link notification to a school
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);