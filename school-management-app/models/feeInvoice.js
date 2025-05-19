// models/FeeInvoice.js
const mongoose = require('mongoose');

const feeInvoiceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  month: { type: String, required: true },
  baseAmount: { type: Number, required: true, min: 0 },
  previousDue: { type: Number, default: 0, min: 0 },
  currentCharges: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['Pending', 'Partially Paid', 'Paid'], default: 'Pending' },
  paymentHistory: [{
    date: Date,
    amount: Number,
    method: String,
    receivedBy: mongoose.Schema.Types.ObjectId
  }],
  invoiceDetails: {
    tuitionFee: { type: Number, min: 0 },
    examFee: { type: Number, min: 0 },
    transportFee: { type: Number, min: 0 },
    hostelFee: { type: Number, min: 0 },
    miscFee: { type: Number, min: 0 },
    labFee: { type: Number, min: 0 }
  },
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true }
}, {
  timestamps: true,
  indexes: [{ fields: { studentId: 1, month: 1 }, unique: true }]
});

module.exports = mongoose.model('FeeInvoice', feeInvoiceSchema);