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
  mobileNo: { // Added mobile number
    type: String,
    required: true,
    match: [/^\+?[1-9]\d{9,14}$/, 'Please enter a valid mobile number (e.g., +919876543210 or 9876543210)']
  },
  email: { // Added email for school communication
    type: String,
    required: true,
    unique: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  smtpConfig: {
    host: { type: String, default: 'shafisadique123@gmail.com' },
    port: { type: Number, default: 465 },
    secure: { type: Boolean, default: true },
    auth: {
      user: { type: String }, // School-specific email
      pass: { type: String }  // App Password or API key
    }
  },
  contactPerson: { // Added contact person details
    name: String,
    designation: String
  },
  website: { // Added website URL (optional)
    type: String,
    match: [/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/, 'Please enter a valid URL']
  },
  activeAcademicYear: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicYear',
    required: true
  },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  radius: { type: Number, default: 100 },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  weeklyHolidayDay: {
    type: String,
    enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    default: 'Sunday' // Default to Sunday if not specified
  },
  smsPackActive: { type: Boolean, default: false },
  status: { // Added status to track active/inactive schools
    type: Boolean,
    default: true
  },
  logo: { // Explicitly define logo field
    type: String,
    default: ''
  }
});

// ✅ Index for Faster School Lookup
schoolSchema.index({ createdBy: 1, strictPopulate: false }); // Index on createdBy for faster queries
// schoolSchema.index({ name: 1 }, { unique: true }); // Ensure unique name enforcement
// schoolSchema.index({ email: 1 }, { unique: true }); // Ensure unique email enforcement
schoolSchema.index({ mobileNo: 1 }, { unique: true }); // Ensure unique mobile number enforcement

module.exports = mongoose.model('School', schoolSchema);