const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link to student
  subject: { type: String, required: true },
  marks: { type: Number, required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true } // Link exam to a school
});

module.exports = mongoose.model('Exam', examSchema);