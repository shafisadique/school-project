const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Class Name (e.g., Grade 10)
  sections: [{ type: String }], // Sections (e.g., A, B, C)
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }], // Subjects assigned to class
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true }, // School Reference
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Admin/User who created this
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);
