const mongoose = require('mongoose');

const classSubjectAssignmentSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  academicYearId: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { timestamps: true });

// Enforce per-school uniqueness to prevent duplicates
classSubjectAssignmentSchema.index({ schoolId: 1, classId: 1, subjectId: 1, academicYearId: 1 }, { unique: true });

module.exports = mongoose.model('ClassSubjectAssignment', classSubjectAssignmentSchema);