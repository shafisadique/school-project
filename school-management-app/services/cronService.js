const cron = require('node-cron');
const Notification = require('../models/Notification');
const Student = require('../models/student'); // Assume Student model
const User = require('../models/user');
const notificationService = require('./notificationService');

cron.schedule('0 0 * * 5', async () => { // Every Friday at midnight
  try {
    const students = await Student.find().populate('parentId');
    for (const student of students) {
      const report = generateProgressReport(student); // Custom function to compute grades/comments
      const notification = new Notification({
        schoolId: student.schoolId,
        type: 'progress-report',
        title: `Weekly Progress Report for ${student.name}`,
        message: `Dear Parent, here is the weekly progress for ${student.name}: ${report.summary}`,
        recipientId: student.parentId._id,
        studentId: student._id,
        data: { reportSummary: report.summary }
      });
      await notification.save();
      await notificationService.deliver(notification);
    }
    logger.info('Weekly progress reports sent');
  } catch (err) {
    logger.error('Cron error:', err);
  }
});

// Placeholder for report generation (customize based on your data)
function generateProgressReport(student) {
  return { summary: `Grades: A, Comments: Good progress in ${student.name}'s studies.` };
}