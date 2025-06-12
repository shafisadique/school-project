const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const InvoiceSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    feeStructureId: {
      type: Schema.Types.ObjectId,
      ref: 'FeeStructure',
      required: true,
    },
    schoolId: {
      type: String,
      required: true,
    },
    academicYear: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
    },
    month: {
      type: String, // Format: "YYYY-MM"
      required: true,
    },
    baseAmount: {
      type: Number,
      required: true,
    },
    previousDue: {
      type: Number,
      default: 0,
    },
    lateFee: {
      type: Number,
      default: 0,
    },
    currentCharges: {
      type: Number,
      required: true,
    },
    invoiceDetails: {
      tuitionFee: { type: Number, required: true },
      examFee: { type: Number, default: 0 },
      transportFee: { type: Number, default: 0 },
      hostelFee: { type: Number, default: 0 },
      miscFee: { type: Number, default: 0 },
      labFee: { type: Number, default: 0 },
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    remainingDue: {
      type: Number,
      required: true,
    },
    discountsApplied: [
      {
        name: { type: String, required: true },
        amount: { type: Number, required: true },
      },
    ],
    status: {
      type: String,
      enum: ['Pending', 'Partial', 'Paid', 'Overdue'],
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    paymentSchedule: {
      type: String,
      enum: ['Monthly', 'BiMonthly', 'Quarterly', 'Yearly', 'Custom'],
      default: 'Quarterly',
    },
    customPaymentDetails: {
      type: String,
      required: false,
    },
    paymentHistory: [
      {
        date: { type: Date, required: true },
        amount: { type: Number, required: true },
        method: { type: String, required: true },
        processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', InvoiceSchema);