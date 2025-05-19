const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  admissionNo: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true,
    index: true
  },
  name: { 
    type: String, 
    required: true, 
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  section: { 
    type: [String], 
    required: true,
    validate: {
      validator: (v) => v.length > 0,
      message: "At least one section is required"
    }
  },
  email: { 
    type: String,
    trim: true,
    default: ''
  },
  phone: { 
    type: String, 
    required: true, 
    trim: true,
    validate: {
      validator: (v) => /^\d{10}$/.test(v),
      message: "Phone number must be 10 digits"
    }
  },
  address: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 200
  },
  classId: { // Changed from className to classId
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class', 
    required: true,
    index: true
  },
  gender: { 
    type: String, 
    enum: ['Male', 'Female', 'Other'], 
    required: true 
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
  rollNo: { 
    type: String, 
    trim: true,
    default: ''
  },
  profileImage: { 
    type: String, 
    default: '',
    validate: {
      validator: (v) => !v || /\.(png|jpe?g)$/i.test(v),
      message: "Only PNG/JPEG images allowed"
    }
  },
  usesTransport: { type: Boolean, default: false },
  usesHostel: { type: Boolean, default: false },
  otherFees: [{ 
    name: { type: String, trim: true, required: true },
    amount: { type: Number, min: 0, required: true }
  }],
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
studentSchema.index({ schoolId: 1, phone: 1 }, { 
  unique: true,
  name: 'unique_phone_per_school',
  partialFilterExpression: { phone: { $exists: true } }
});

studentSchema.index({ schoolId: 1, admissionNo: 1 }, { 
  unique: true,
  name: 'unique_admission_per_school'
});

studentSchema.index({ schoolId: 1, classId: 1, section: 1, rollNo: 1 }, { // Updated index to use classId
  unique: true,
  name: 'unique_rollNo_per_class_section',
  partialFilterExpression: { rollNo: { $exists: true, $ne: '' } }
});

// Virtuals
studentSchema.virtual('school', {
  ref: 'School',
  localField: 'schoolId',
  foreignField: '_id',
  justOne: true
});

studentSchema.virtual('academicYear', {
  ref: 'AcademicYear',
  localField: 'academicYearId',
  foreignField: '_id',
  justOne: true
});

studentSchema.virtual('class', {
  ref: 'Class',
  localField: 'classId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('Student', studentSchema);