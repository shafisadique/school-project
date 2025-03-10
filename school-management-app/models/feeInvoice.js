// models/FeeInvoice.js
const mongoose = require('mongoose');

const feeInvoiceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  month: { type: String, required: true },
  baseAmount: { type: Number, required: true },
  previousDue: { type: Number, default: 0 },
  currentCharges: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  remainingDue: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['Pending', 'Partially Paid', 'Paid'], default: 'Pending' },
  paymentHistory: [{
    date: Date,
    amount: Number,
    method: String,
    receivedBy: mongoose.Schema.Types.ObjectId
  }],
  invoiceDetails: {
    tuitionFee: Number,
    examFee: Number,
    transportFee: Number,
    hostelFee: Number,
    miscFee: Number,
    labFee: Number
  }

}, { 
  timestamps: true,
  indexes: [
    { 
      fields: { 
        studentId: 1, 
        month: 1 
      },
      unique: true // Prevent DB-level duplicates
    }
  ]
});

module.exports = mongoose.model('FeeInvoice', feeInvoiceSchema);