const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sections: [{ type: String }],
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attendanceTeacher: { // Primary teacher for marking attendance
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    default: null,
  },
  substituteAttendanceTeachers: [{ // Substitute teachers for marking attendance
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
  }],
  nextClass: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);