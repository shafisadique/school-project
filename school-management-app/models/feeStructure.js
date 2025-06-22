  const mongoose = require('mongoose');

  const feeStructureSchema = new mongoose.Schema({
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
      index: true
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
    fees: [{
      name: {
        type: String,
        required: true,
        trim: true // e.g., "tuitionFee", "transportFee", "hostelFee"
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      type: {
        type: String,
        enum: ['Base', 'Optional'],
        required: true
      },
      preferenceKey: {
        type: String,
        trim: true // e.g., "usesTransport", "usesHostel", null for Base fees
      },
      frequency: {
        type: String,
        enum: ['Monthly', 'Quarterly', 'Yearly', 'Specific Months'],
        required: true
      }
    }],
    lateFeeRules: {
      dailyRate: {
        type: Number,
        default: 0,
        min: 0
      },
      maxLateFee: {
        type: Number,
        default: 0,
        min: 0
      }
    },
    discounts: [{
      name: {
        type: String,
        required: true,
        trim: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      type: {
        type: String,
        enum: ['Percentage', 'Fixed'],
        required: true
      }
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: Boolean,
      default: true
    }
  }, {
    timestamps: true
  });

  feeStructureSchema.index({ classId: 1, schoolId: 1, academicYearId: 1 }, { unique: true });

  module.exports = mongoose.model('FeeStructure', feeStructureSchema);