// // models/submission.js
// const mongoose = require('mongoose');

// const submissionSchema = new mongoose.Schema({
//   assignmentId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Assignment',
//     required: true
//   },
//   studentId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Student',
//     required: true
//   },
//   grade: {
//     type: Number,
//     min: 0,
//     max: 100,
//     default: null
//   },
//   comments: {
//     type: String,
//     default: ''
//   },
//   submittedAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// module.exports = mongoose.model('Submission', submissionSchema);