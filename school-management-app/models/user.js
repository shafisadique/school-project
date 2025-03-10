const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['superadmin', 'admin', 'teacher', 'student', 'parent'], 
    required: true 
  },
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School'
  }
});

// ✅ Index for Faster Admin Lookup
userSchema.index({ schoolId: 1 });

module.exports = mongoose.model('User', userSchema);
