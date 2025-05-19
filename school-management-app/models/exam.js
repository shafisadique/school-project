// models/exam.js
const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  examName: { type: String, required: true }, // e.g., "Mid-Term Exam" or "Final Exam"
  startDate: { type: Date, required: true }, // Start date of the exam
  endDate: { type: Date, required: true }, // End date of the exam
  subjects: [
    {
      subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
      maxMarks: { type: Number, required: true }, // e.g., 100
      date: { type: Date } // Optional: Specific date for this subject, if different from exam startDate/endDate
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

// Indexes for faster queries
examSchema.index({ schoolId: 1, academicYearId: 1 });
examSchema.index({ classId: 1, examName: 1, academicYearId: 1 }, { unique: true }); // Ensure unique exam names per class and academic year
examSchema.index({ startDate: 1, endDate: 1 }); // Index for date range queries

module.exports = mongoose.model('Exam', examSchema);