// models/result.js
const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }, // For partial results
  subjects: [{
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    marksObtained: { type: Number, required: true, min: 0 },
    maxMarks: { type: Number, required: true },
    percentage: { type: Number },
    passed: { type: Boolean }
  }], // For compiled results
  marksObtained: { type: Number, min: 0 }, // For partial results
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  totalMarksObtained: { type: Number },
  totalMaxMarks: { type: Number },
  percentage: { type: Number },
  grade: { type: String },
  status: { type: String, enum: ['Pass', 'Fail'] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isPublished: { type: Boolean, default: false },   // ← controls portal visibility
  publishedAt: { type: Date },
});

module.exports = mongoose.model('Result', resultSchema);