// utils/istTimestamp.js
// THIS IS THE MAGIC FILE — ADD IT ONCE, USE EVERYWHERE

const mongoose = require('mongoose');

// Helper: Returns current time in IST (UTC +5:30)
const nowIST = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // +5:30 hours
  return new Date(now.getTime() + istOffset);
};

// Apply Indian Standard Time to any schema
module.exports = function applyIST(schema) {
  // 1. Make createdAt & updatedAt save in IST
  schema.pre('save', function (next) {
    if (this.isNew) {
      this.createdAt = nowIST();
    }
    this.updatedAt = nowIST();
    next();
  });

  // 2. If using { timestamps: true }, force IST
  if (schema.options.timestamps) {
    schema.options.timestamps = {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      currentTime: nowIST
    };
  }

  // 3. Add clean Indian time display (optional but beautiful)
  schema.virtual('createdAtIST').get(function () {
    return this.createdAt?.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  });

  schema.virtual('updatedAtIST').get(function () {
    return this.updatedAt?.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  });

  schema.virtual('dateIST').get(function () {
    const dateField = this.date || this.createdAt;
    return dateField?.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // "2025-11-27"
  });

  // Show virtuals in JSON responses
  schema.set('toJSON', { virtuals: true });
  schema.set('toObject', { virtuals: true });
};