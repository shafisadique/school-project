const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true, 
    index: true 
  },
  name: { 
    type: String, 
    required: true, 
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  pickupPoints: { 
    type: [String], 
    required: true,
    validate: {
      validator: (v) => v.length > 0 && v.every(point => point.trim().length > 0),
      message: 'At least one non-empty pickup point is required'
    }
  },
  distance: { 
    type: Number, 
    required: true,
    min: 0
  },
  feeAmount: {
    type: Number,
    required: true,
    min: 0
  },
  frequency: {
    type: String,
    enum: ['Monthly', 'Quarterly', 'Yearly'],
    required: true,
    default: 'Monthly'
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  status: { 
    type: Boolean, 
    default: true 
  }
}, {
  timestamps: true
});

routeSchema.index({ schoolId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Route', routeSchema);