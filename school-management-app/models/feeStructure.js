const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  className: { type: String, required: true },
  baseFee: { type: Number, required: true, min: 0 },
  feeBreakdown: {
    tuitionFee: { type: Number, required: true, min: 0 },
    examFee: { type: Number, required: true, min: 0 },
    labFee: { type: Number, default: 0, min: 0 },
    transportFee: { type: Number, default: 0, min: 0 },
    hostelFee: { type: Number, default: 0, min: 0 },
    miscFee: { type: Number, default: 0, min: 0 }
  }
}, { timestamps: true });

feeStructureSchema.index({ schoolId: 1,  className: 1 }, { unique: true });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
