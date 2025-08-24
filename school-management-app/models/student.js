const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  admissionNo: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true,
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
    trim: true,
    validate: {
      validator: (v) => /^\d{10}$/.test(v),
      message: "Phone number must be 10 digits"
    }
  },
  dateOfBirth: { 
    type: Date, 
    required: true 
  },
  city: { 
    type: String, 
    trim: true, 
    required: true, 
    maxlength: 100 
  },
  state: { 
    type: String, 
    trim: true, 
    required: true, 
    maxlength: 100 
  },
  country: { 
    type: String, 
    trim: true, 
    required: true, 
    maxlength: 100 
  },
  address: { 
    type: String, 
    required: true, 
    trim: true,
    maxlength: 200
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class', 
    required: true,
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
  },
  academicYearId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'AcademicYear', 
    required: true,
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
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    default: null,
  },
  feePreferences: { 
    type: Map,
    of: Boolean,
    default: {
      usesTransport: false, // Deprecated: Use routeId instead
      usesHostel: false,
      usesLibrary: false,
      needsDress: false,
      usesLab: false,
      needsExamFee: true,
      needsMiscFee: false
    }
  },
  parents: {
    fatherName: { 
      type: String, 
      trim: true, 
      validate: {
        validator: function (v) {
          if (v === undefined || v === null || v === '') return true;
          return v.length >= 2 && v.length <= 100;
        },
        message: "Father's name must be between 2 and 100 characters if provided"
      }
    },
    motherName: { 
      type: String, 
      trim: true, 
      validate: {
        validator: function (v) {
          if (v === undefined || v === null || v === '') return true;
          return v.length >= 2 && v.length <= 100;
        },
        message: "Mother's name must be between 2 and 100 characters if provided"
      }
    },
    fatherPhone: { 
      type: String, 
      trim: true,
      validate: {
        validator: (v) => !v || /^\d{10}$/.test(v),
        message: "Father's phone number must be 10 digits if provided"
      }
    },
    motherPhone: { 
      type: String, 
      trim: true,
      validate: {
        validator: (v) => !v || /^\d{10}$/.test(v),
        message: "Mother's phone number must be 10 digits if provided"
      }
    }
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  status: { 
    type: Boolean, 
    default: true
  },
  isPromotedManually: {
    type: Boolean,
    default: false
  },
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  strictPopulate: false
});

// Add custom validation for parents
studentSchema.pre('validate', function (next) {
  const parents = this.parents || {};
  const fatherNameProvided = parents.fatherName && parents.fatherName.trim() !== '';
  const motherNameProvided = parents.motherName && parents.motherName.trim() !== '';

  if (!fatherNameProvided && !motherNameProvided) {
    this.invalidate('parents', 'At least one parent\'s name (father or mother) must be provided');
  }
  if (fatherNameProvided && (!parents.fatherPhone || parents.fatherPhone.trim() === '')) {
    this.invalidate('fatherPhone', 'Father\'s phone number is required if father\'s name is provided');
  }
  if (motherNameProvided && (!parents.motherPhone || parents.motherPhone.trim() === '')) {
    this.invalidate('motherPhone', 'Mother\'s phone number is required if mother\'s name is provided');
  }

  if (this.routeId && this.feePreferences.get('usesTransport') === false) {
    this.feePreferences.set('usesTransport', true);
  } else if (!this.routeId && this.feePreferences.get('usesTransport') === true) {
    this.feePreferences.set('usesTransport', false);
  }
  next();
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

studentSchema.index({ schoolId: 1, classId: 1, section: 1, rollNo: 1 }, {
  unique: true,
  name: 'unique_rollNo_per_class_section',
  partialFilterExpression: { rollNo: { $exists: true, $ne: '' } }
});
// studentSchema.index({ admissionNo: 1 });
studentSchema.index({ name: 1 });
studentSchema.index({ email: 1 });
studentSchema.index({ classId: 1 });
studentSchema.index({ schoolId: 1 });
studentSchema.index({ academicYearId: 1 });
studentSchema.index({ routeId: 1 });

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