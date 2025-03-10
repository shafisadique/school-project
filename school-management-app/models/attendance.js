const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link to student
  date: { type: Date, required: true },
  status: { type: String, enum: ['present', 'absent'], required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true } // Link attendance to a school
});

module.exports = mongoose.model('Attendance', attendanceSchema);