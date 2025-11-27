const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  date: { type: Date, required: true },
  students: [
    {
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      status: { type: String, enum: ['Present', 'Absent', 'Late'], required: true }
    }
  ]
}, {
  timestamps: true   // This gives createdAt & updatedAt in IST automatically
});


module.exports = mongoose.model('Attendance', attendanceSchema);