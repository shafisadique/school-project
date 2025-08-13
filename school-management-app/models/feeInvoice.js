const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  feeStructureId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeStructure', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  className: { type: String, required: true }, 
  academicYear: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true }, // Added ref: 'AcademicYear'
  month: { type: String, required: true },
  dueDate: { type: Date, required: true },
  baseAmount: { type: Number, required: true },
  previousDue: { type: Number, default: 0 },
  lateFee: { type: Number, default: 0 },
  currentCharges: { type: Number, default: 0 },
  invoiceDetails: [
    {
      name: { type: String, required: true },
      amount: { type: Number, required: true }
    }
  ],
  totalAmount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  remainingDue: { type: Number, required: true },
  discountsApplied: [{name: String,
    amount: Number,
    type: String}],
  status: {
    type: String,
    enum: ['Pending', 'Partial', 'Paid', 'Overdue'],
    default: 'Pending'
  },
  paymentSchedule: { type: String, default: 'Monthly' },
  customPaymentDetails: { type: String },
  paymentHistory: [
    {
      amount: { type: Number, required: true },
      paymentMethod: { type: String, required: true },
      date: { type: Date, required: true },
      transactionId: { type: String },
      chequeNumber: { type: String },
      processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

invoiceSchema.index({ schoolId: 1, studentId: 1, month: 1 }, { unique: true });
module.exports = mongoose.model('FeeInvoice', invoiceSchema);