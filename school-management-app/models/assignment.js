const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
  submittedFiles: [{ type: String }],
  submittedText: { type: String },
  grade: { type: Number, min: 0, max: 100, default: null },
  comments: { type: String, default: null },
  submittedAt: { type: Date, default: Date.now },
  manuallySubmitted: { type: Boolean, default: false }
});

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  dueDate: { type: Date, required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  attachments: [{ type: String }],
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  submissions: [submissionSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'submitted', 'graded'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

assignmentSchema.index({ teacherId: 1, schoolId: 1 });
assignmentSchema.index({ classId: 1, schoolId: 1 });
assignmentSchema.index({ dueDate: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);