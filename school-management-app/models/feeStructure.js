const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true }, // 🔥 Fee is linked to a school
  session: { type: String, required: true }, // E.g., "2024-2025"
  className: { type: String, required: true }, // E.g., "7th"
  baseFee: { type: Number, required: true }, // Base fee for the class
  examMonths: [String],
  feeBreakdown: {
    tuitionFee: { type: Number, required: true },
    examFee: { type: Number, required: true },
    labFee: { type: Number, default: 0 },
    transportFee: { type: Number, default: 0 }, // Optional
    hostelFee: { type: Number, default: 0 }, // Optional
    miscFee: { type: Number, default: 0 } // Optional
  }
}, { timestamps: true });

feeStructureSchema.index({ schoolId: 1, session: 1, className: 1 }, { unique: true });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
