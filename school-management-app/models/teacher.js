const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link to User model
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  phone: { type: String, required: true },
  designation: { type: String, required: true },
  subjects: [{ type: String, required: true }],
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
  profileImage: { type: String },  // For storing teacher profile photo
  academicYearId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'AcademicYear', 
    required: true,
    index: true
  },
  status: { type: Boolean, default: true }, // Active by default
}, { timestamps: true });

// Index for faster queries
teacherSchema.index({ schoolId: 1 });
teacherSchema.index({ email: 1 }, { unique: true });

teacherSchema.virtual('school', {
  ref: 'School',
  localField: 'schoolId',
  foreignField: '_id',
  justOne: true
});

teacherSchema.virtual('academicYear', {
  ref: 'AcademicYear',
  localField: 'academicYearId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('Teacher', teacherSchema);