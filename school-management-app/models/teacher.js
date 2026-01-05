const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link to User model
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  phone: { type: String, required: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // One teacher per user
  },
  designation: { type: String, required: true },
  subjects: [{ type: String, required: true }],

  // New optional but useful fields
  qualification: { type: String },
  joiningDate: { type: Date },
  dateOfBirth: { type: Date },
  address: { type: String },
  bloodGroup: { type: String },
  emergencyContactName: { type: String },
  emergencyContactPhone: { type: String },

  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true
  },

  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  academicYearId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicYear',
    required: true
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  leaveBalance: { type: Number, default: 12 }, // Can be overridden from frontend
  profileImage: { type: String }, // R2 key
  status: { type: Boolean, default: true },
}, { timestamps: true });

// Compound index for performance and uniqueness per school/year
teacherSchema.index({ schoolId: 1, academicYearId: 1 });
teacherSchema.index({ userId: 1 }, { unique: true });
teacherSchema.index({ schoolId: 1, 'subjects': 1 });

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