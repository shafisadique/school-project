const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  date: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Holiday', holidaySchema);