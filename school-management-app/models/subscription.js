const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  planType: { type: String, enum: ['basic', 'premium', 'trial'], required: true },
  status: { type: String, enum: ['active', 'expired', 'canceled'], default: 'active' },
  expiresAt: { type: Date, required: true },
  paymentMethod: { type: String, enum: ['razorpay', 'bank_transfer', 'phonepe'], default: null },
  paymentProof: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

subscriptionSchema.virtual('daysToExpire').get(function() {
  const now = new Date();
  const diff = this.expiresAt - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))); // Days left, floored to 0 if expired
});

// Indexes for fast lookups
subscriptionSchema.index({ schoolId: 1, status: 1 });
subscriptionSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);