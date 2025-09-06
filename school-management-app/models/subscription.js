
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true 
  },
  planType: { 
    type: String, 
    enum: ['trial', 'basic_monthly', 'basic_yearly', 'premium_monthly', 'premium_yearly'], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['active', 'expired', 'canceled', 'pending', 'grace_period'], 
    default: 'active' 
  },
  startsAt: { 
    type: Date, 
    default: Date.now 
  },
  expiresAt: { 
    type: Date, 
    required: true 
  },
  // Grace period after expiration (7 days)
  gracePeriodEnds: { 
    type: Date 
  },

  autoRenew: {
    type: Boolean,
    default: false
  },

  paymentMethod: { 
    type: String, 
    enum: ['razorpay', 'bank_transfer', 'phonepe', 'card', 'upi'], 
    default: null 
  },

  paymentProof: { 
    type: String, 
    default: null 
  },

  transactionId: {
    type: String,
    default: null
  },

  createdAt: { 
    type: Date, 
    default: Date.now 
  },

  updatedAt: { 
    type: Date, 
    default: Date.now 
  },

  durationDays: { 
    type: Number, 
    required: true 
  },

  originalAmount: { 
    type: Number, 
    required: true 
  },
  discountAmount: { 
    type: Number, 
    default: 0 
  },
  finalAmount: { 
    type: Number, 
    required: true 
  },
  // Track usage for fair usage policy
  usageStats: {
    students: { type: Number, default: 0 },
    staff: { type: Number, default: 0 },
    storage: { type: Number, default: 0 } // in MB
  }
});

// Virtual for days remaining
subscriptionSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const diff = this.expiresAt - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// Virtual for isInGracePeriod
subscriptionSchema.virtual('isInGracePeriod').get(function() {
  if (this.status !== 'grace_period') return false;
  const now = new Date();
  return now <= this.gracePeriodEnds;
});

// Method to check if subscription is active (including grace period)
subscriptionSchema.methods.isActive = function() {
  const now = new Date();
  return this.status === 'active' || 
         (this.status === 'grace_period' && now <= this.gracePeriodEnds);
};

subscriptionSchema.index({ schoolId: 1, status: 1 });
subscriptionSchema.index({ expiresAt: 1 });
subscriptionSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);