const mongoose = require("mongoose");

const timetableSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  day: { type: String, enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  room: { type: String, required: true },
}, {
  timestamps: true   // ADD THIS LINE
});

// ADD THIS LINE — This makes createdAt/updatedAt use IST
require('../utils/istTimestamp')(timetableSchema);

module.exports = mongoose.model("Timetable", timetableSchema);