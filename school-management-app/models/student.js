const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  admissionNo: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },  // ✅ Unique email but allows multiple `null` values
  phone: { type: String, required: true },
  // password: { type: String },
  address: { type: String, required: true }, // ✅ Added Address Field

  className: { type: String, required: true },
  // rollNumber: { type: String, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  profileImage: { type: String, default: '' },
  usesTransport: { type: Boolean, default: false },
  usesHostel: { type: Boolean, default: false },
  otherFees: [{
    name: String,
    amount: Number
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  currentSession: { 
    type: String, 
    required: true,
    enum: ['2023-2024', '2024-2025', '2025-2026'] // Example sessions
  },
  
});

// ✅ Create a Unique Index to Prevent Duplicate Students per School
studentSchema.index({ schoolId: 1,rollNumber: 1, admissionNo: 1 }, { unique: true });

module.exports = mongoose.model('Student', studentSchema);
