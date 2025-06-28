// models/index.js
const mongoose = require('mongoose');

// Load all model files
require('./feeStructure'); // This will register the FeeStructure model
require('./feeInvoice');
require('./student');
require('./academicyear');
// Add other models as needed

module.exports = mongoose;