const mongoose = require('mongoose');

const examPaperSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true }, // Reference to Subject
  subjectType: { type: String, enum: ['Written', 'Practical', 'Oral'], required: true }, // e.g., "Written"
  maxMarks: { type: Number, required: true }, // e.g., 100
  minMarks: { type: Number, required: true }, // e.g., 40
  paperCode: { type: String, required: true }, // e.g., "MATH-101"
  paperStartDateTime: { type: Date, required: true }, // e.g., "2025-06-01T09:00:00Z"
  paperEndDateTime: { type: Date, required: true }, // e.g., "2025-06-01T12:00:00Z"
  roomNo: { type: String, required: true }, // e.g., "Room 101"
  gradeCriteria: { type: String, required: true } // e.g., "A: 90-100, B: 80-89"
});

const examSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  examTitle: { type: String, required: true }, // e.g., "Mid-Term Exam 2025"
  examCenter: { type: String, required: true }, // e.g., "Main Campus"
  startDate: { type: Date, required: true }, // Overall start date, e.g., "2025-06-01T00:00:00Z"
  endDate: { type: Date, required: true }, // Overall end date, e.g., "2025-06-05T23:59:59Z"
  examStatus: { type: String, enum: ['Scheduled', 'Ongoing', 'Completed'], default: 'Scheduled' }, // Exam status
  examPapers: [examPaperSchema], // Array of exam papers
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Validation: Ensure paperStartDateTime and paperEndDateTime are within exam startDate and endDate
examSchema.pre('validate', function (next) {
  const exam = this;

  // Validate exam startDate and endDate
  if (exam.startDate > exam.endDate) {
    return next(new Error('Exam start date cannot be after end date'));
  }

  // Validate each exam paper's dates
  for (const paper of exam.examPapers) {
    if (paper.paperStartDateTime > paper.paperEndDateTime) {
      return next(new Error(`Paper ${paper.paperCode}: Start date-time cannot be after end date-time`));
    }
    if (paper.paperStartDateTime < exam.startDate || paper.paperEndDateTime > exam.endDate) {
      return next(new Error(`Paper ${paper.paperCode}: Date-time must be within exam date range`));
    }
  }

  next();
});

// Indexes for faster queries
examSchema.index({ schoolId: 1, academicYearId: 1 });
examSchema.index({ classId: 1, academicYearId: 1 })
examSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('Exam', examSchema);