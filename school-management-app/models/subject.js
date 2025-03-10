const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Subject Name (e.g., Math, Science)
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }], // Assigned Classes
  teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Assigned Teachers
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true }, // School Reference
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Admin/User who created this
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);
