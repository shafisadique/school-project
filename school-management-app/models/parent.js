const mongoose = require('mongoose');

const parentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link to user
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link to child (student)
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true } // Link parent to a school
});

module.exports = mongoose.model('Parent', parentSchema);