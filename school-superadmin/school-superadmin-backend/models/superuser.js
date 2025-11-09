const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const superUserSchema = new mongoose.Schema({
  name: { type: String, default: 'Super Admin' },
  username: { type: String, unique: true, default: 'superadmin' },  // Auto-indexes via unique: true
  email: { type: String, required: true, unique: true },  // Auto-indexes via unique: true
  password: { type: String, required: true },
  role: { type: String, default: 'superadmin' }
}, { timestamps: true });

superUserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

superUserSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

// No explicit indexes needed for email/username—unique: true handles it
// Add others if needed later, e.g., superUserSchema.index({ role: 1 });

module.exports = mongoose.model('SuperUser', superUserSchema);