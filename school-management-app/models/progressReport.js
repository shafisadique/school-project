const mongoose = require('mongoose');

const progressReportSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Teacher
  grades: { type: String, required: true },
  comments: { type: String, required: true, maxLength: 500 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }, // Optional: Track updates
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: false } // Optional: Link to academic year
}, {
  timestamps: true // Automatically manages createdAt and updatedAt
});

module.exports = mongoose.model('ProgressReport', progressReportSchema);