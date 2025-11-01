const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: String,
  adminEmail: String,
  adminPhone: String,
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' }, // From shared DB
  status: { type: String, enum: ['active', 'trial', 'expired'], default: 'trial' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SuperSchool', schoolSchema); // Separate for audits