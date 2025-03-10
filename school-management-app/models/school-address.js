const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true
  },
  schoolId: {
    type: Number,
    unique: true,
    default: () => Math.floor(100000 + Math.random() * 900000)
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

module.exports = mongoose.model('School', schoolSchema);