const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeInvoice', required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  paymentMethod: { type: String, required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  receiptNumber: { type: String, unique: true, required: true },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } // This is the missing field
});

module.exports = mongoose.model('Receipt', receiptSchema);