const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  planType: { type: String, enum: ['basic', 'premium', 'trial'], required: true },
  status: { type: String, enum: ['active', 'expired', 'canceled'], default: 'active' },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for fast lookups
subscriptionSchema.index({ schoolId: 1, status: 1 });
subscriptionSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);