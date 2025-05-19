const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true 
  },
  address: { // Keep as object structure
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  activeAcademicYear: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicYear',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});
// ✅ Index for Faster School Lookup
schoolSchema.index({ createdBy: 1,strictPopulate: false  });

module.exports = mongoose.model('School', schoolSchema);
