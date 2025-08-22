// models/teacherAbsence.js
const mongoose = require('mongoose');

const teacherAbsenceSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher ID is required'],
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: [true, 'School ID is required'],
    },
    date: {
      type: Date,
      required: [true, 'Absence date is required'],
    },
    reason: {
      type: String,
      required: [true, 'Reason for absence is required'],
      trim: true,
    },
    substituteTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    leaveType: {
      type: String,
      enum: ['Casual', 'Sick', 'Unpaid','Holiday', null],
      default: null,
    },
    isTeacherApplied: { type: Boolean, default: true }, // Ensure this is set
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true,
  }
);

teacherAbsenceSchema.index({ schoolId: 1, teacherId: 1, date: -1 }, { unique: true });

module.exports = mongoose.model('TeacherAbsence', teacherAbsenceSchema);