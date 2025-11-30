const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  body: { type: String, required: true, maxlength: 1000 },
  roles: [{ 
    type: String, 
    enum: ['admin', 'teacher', 'parent', 'student'], 
    required: true 
  }], // Target roles
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true, 
    index: true 
  }, // Tenant isolation
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  isActive: { type: Boolean, default: true },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] // Optional: Track reads
}, { timestamps: true });

announcementSchema.index({ schoolId: 1, isActive: 1 });
announcementSchema.index({ schoolId: 1, roles: 1, isActive: 1 });
announcementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);