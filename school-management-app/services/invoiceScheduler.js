const cron = require('node-cron');
const moment = require('moment');
const mongoose = require('mongoose');
const AcademicYear = require('../models/academicyear');
const { generateMonthlyInvoices } = require('./invoiceGenerator');

const scheduleMonthlyInvoices = async () => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  try {
    // Get all active academic years
    const academicYears = await AcademicYear.find({
      startDate: { $lte: now },
      endDate: { $gte: now }
    });

    for (const academicYear of academicYears) {
      // Get all classes with fee structures
      const feeStructures = await mongoose.model('FeeStructure')
        .find({ academicYearId: academicYear._id })
        .distinct('classId');

      for (const classId of feeStructures) {
        try {
          await generateMonthlyInvoices(
            academicYear.schoolId,
            classId,
            currentMonth,
            currentYear,
            academicYear._id
          );
          console.log(`Generated invoices for class ${classId} in ${currentMonth}/${currentYear}`);
        } catch (error) {
          console.error(`Error generating invoices for class ${classId}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Invoice scheduling error:', error);
  }
};

// Schedule to run on the 1st of every month at 2 AM
cron.schedule('0 2 1 * *', scheduleMonthlyInvoices);

module.exports = { scheduleMonthlyInvoices };