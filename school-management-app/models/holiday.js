const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true 
  },
  title: { type: String, required: true },
  date: { type: Date, required: true },
  description: { type: String }
});

// ✅ Index for fast retrieval
holidaySchema.index({ schoolId: 1, date: 1 });

module.exports = mongoose.model('Holiday', holidaySchema);
