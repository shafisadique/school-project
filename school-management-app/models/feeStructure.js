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
     routeOptions: [{
      routeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Route',
        required: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      }
    }],
    frequency: {
      type: String,
      enum: ['Monthly', 'Quarterly', 'Yearly', 'Specific Months'],
      required: true
    },
    specificMonths: { type: [Number], default: [] } // For Specific Months frequency
  }],
  lateFeeConfig: {
    isEnabled: { type: Boolean, default: false },
    calculationType: {
      type: String,
      enum: ['daily', 'fixed', 'percentage'],
      default: 'daily'
    },
    dailyRate: { type: Number, default: 0 },
    fixedAmount: { type: Number, default: 0 },
    percentageRate: { type: Number, default: 0 },
    maxLateFee: { type: Number, default: 0 },
    gracePeriodDays: { type: Number, default: 0 }
  },
  discounts: [{
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['Percentage', 'Fixed'], required: true }
  }],
  isDeleted: { type: Boolean, default: false }, // New field
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