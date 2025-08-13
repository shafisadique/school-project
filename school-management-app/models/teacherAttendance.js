// models/teacherAttendance.js
const mongoose = require('mongoose');

const teacherAttendanceSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
    index: true
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
    academicYearId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicYear',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'On Leave', 'Holiday'],
    required: true
  },
  leaveType: {
    type: String,
    enum: ['Casual', 'Sick', 'Unpaid', null],
    default: null
  },
  remarks: {
    type: String,
    maxlength: 500
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

// Ensure unique attendance record per teacher per day
teacherAttendanceSchema.index({ teacherId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('TeacherAttendance', teacherAttendanceSchema);