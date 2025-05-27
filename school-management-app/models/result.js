// models/result.js
const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  academicYearId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicYear',
    required: true
  },
  subjects: [
    {
      subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
      },
      marksObtained: {
        type: Number,
        required: true,
        min: 0
      },
      maxMarks: {
        type: Number,
        required: true,
        min: 0
      }
    }
  ],
  totalMarksObtained: {
    type: Number,
    required: true,
    min: 0
  },
  totalMaxMarks: {
    type: Number,
    required: true,
    min: 0
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  grade: {
    type: String,
    required: true // E.g., "A", "B", "C", etc.
  },
  status: {
    type: String,
    enum: ['Pass', 'Fail', 'On Hold'],
    default: 'On Hold'
  }
}, {
  timestamps: true
});

resultSchema.index({ studentId: 1, examId: 1, academicYearId: 1 }, { unique: true });

module.exports = mongoose.model('Result', resultSchema);