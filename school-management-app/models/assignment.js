const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedFiles: [{ type: String }], // Paths to uploaded files
  submittedText: { type: String },
  grade: { type: Number, min: 0, max: 100, default: null },
  comments: { type: String, default: null },
  submittedAt: { type: Date, default: Date.now }
});

const assignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  dueDate: { type: Date, required: true },
  attachments: [{ type: String }], // Paths to uploaded files
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Students
  submissions: [submissionSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Assignment', assignmentSchema);