const mongoose = require('mongoose');

const schoolInvoiceSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  paymentId: { type: String, required: true }, // Razorpay order ID
  amount: { type: Number, required: true },
  planType: { type: String, enum: ['basic', 'premium', 'trial'], required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  paymentDetails: {
    method: { type: String, enum: ['Online'], default: 'Online' },
    transactionId: String,
    date: Date
  }
});

// Indexes for efficient querying
schoolInvoiceSchema.index({ schoolId: 1, status: 1 });
schoolInvoiceSchema.index({ paymentId: 1 });

module.exports = mongoose.model('SchoolInvoice', schoolInvoiceSchema);