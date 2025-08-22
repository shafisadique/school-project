const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  planType: { type: String, enum: ['basic_monthly', 'basic_halfyearly', 'basic_yearly', 'premium_monthly', 'premium_halfyearly', 'premium_yearly', 'trial'], required: true },
  status: { type: String, enum: ['active', 'expired', 'canceled', 'pending'], default: 'active' },
  expiresAt: { type: Date, required: true },
  paymentMethod: { type: String, enum: ['razorpay', 'bank_transfer', 'phonepe'], default: null },
  paymentProof: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  durationDays: { type: Number, required: true }, // Days for the plan
  originalAmount: { type: Number, required: true }, // Original price in INR
  discountAmount: { type: Number, default: 0 }, // Discount in INR
  finalAmount: { type: Number, required: true } // Price after discount
});

subscriptionSchema.virtual('daysToExpire').get(function() {
  const now = new Date();
  const diff = this.expiresAt - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

subscriptionSchema.index({ schoolId: 1, status: 1 });
subscriptionSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);