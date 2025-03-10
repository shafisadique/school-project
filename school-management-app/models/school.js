const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  schoolId: { type: Number, unique: true },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  logo:{type:String},
  contact:{type:String},
  academicYear: { type: String, default: null }, 
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

// ✅ Index for Faster School Lookup
schoolSchema.index({ createdBy: 1 });

module.exports = mongoose.model('School', schoolSchema);
