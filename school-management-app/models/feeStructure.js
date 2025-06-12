const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  className: { type: String, required: true },
  frequency: { type: String, enum: ['Monthly', 'Quarterly', 'Yearly'], default: 'Monthly', required: true },
  baseFee: { type: Number, required: true, min: 0 },
  feeBreakdown: {
    tuitionFee: { type: Number, required: true, min: 0 },
    examFee: { type: Number, default: 0, min: 0 },
    labFee: { type: Number, default: 0, min: 0 },
    transportFee: { type: Number, default: 0, min: 0 },
    hostelFee: { type: Number, default: 0, min: 0 },
    miscFee: { type: Number, default: 0, min: 0 }
  },
  lateFeeRules: {
    dailyRate: { type: Number, default: 0, min: 0 }, // Late fee per day after due date
    maxLateFee: { type: Number, default: 0, min: 0 } // Maximum late fee cap
  },
  discounts: [{
    name: { type: String, required: true }, // e.g., "Sibling Discount"
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: ['Fixed', 'Percentage'], default: 'Fixed' }
  }]
}, { timestamps: true });

feeStructureSchema.index({ schoolId: 1, academicYear: 1, className: 1 }, { unique: true });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);