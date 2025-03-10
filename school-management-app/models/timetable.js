const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true }, // Link to class
  subject: { type: String, required: true },
  day: { type: String, required: true }, // e.g., "Monday", "Tuesday"
  time: { type: String, required: true }, // e.g., "10:00 AM - 11:00 AM"
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true } // Link timetable to a school
});

module.exports = mongoose.model('Timetable', timetableSchema);