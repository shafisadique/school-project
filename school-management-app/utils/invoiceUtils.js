const cron = require('node-cron');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const School = require('../models/school');
const Class = require('../models/class'); // Adjust model name if different
const { generateInvoices } = require('../models/invoice.service');
const generateMonthlyInvoices = async () => {
  try {
    const today = moment.tz('Asia/Kolkata'); // August 07, 2025, 02:41 PM IST
    console.log('Starting monthly invoice generation at:', today.format());

    // Fetch all schools
    const schools = await School.find().select('_id activeAcademicYear').populate('activeAcademicYear');
    if (!schools.length) {
      console.log('No schools found.');
      return;
    }

    for (const school of schools) {
      if (!school.activeAcademicYear) {
        console.log(`No active academic year set for school ${school._id}, skipping.`);
        continue;
      }

      const academicYearId = school.activeAcademicYear._id;
      const academicYearName = school.activeAcademicYear.name; // e.g., "2025-2026"
      console.log(`Processing school ${school._id} for active academic year ${academicYearName}`);

      // Determine the next invoice month (as per generateInvoices logic)
      const currentMonth = today.month(); // 7 (August)
      const currentYear = today.year(); // 2025
      const monthNames = moment.months();
      let invoiceMonth = currentMonth;
      let invoiceYear = currentYear;

      // If past the 10th, use the next month (August 07 > 10, so September 2025)
      if (today.date() > 10) {
        invoiceMonth = (currentMonth + 1) % 12;
        if (invoiceMonth === 0) {
          invoiceMonth = 12;
          invoiceYear += 1;
        }
      }
      const monthName = monthNames[invoiceMonth];
      const dueDate = moment.tz(`${invoiceYear}-${String(invoiceMonth + 1).padStart(2, '0')}-10`, 'Asia/Kolkata').toDate(); // September 10, 2025

      console.log(`Generating invoices for month ${monthName} ${invoiceYear}, due date ${dueDate}`);

      // Fetch all classes for the school
      const classes = await Class.find({ schoolId: school._id }).select('_id name');
      for (const classDoc of classes) {
        const classId = classDoc._id;
        const className = classDoc.name;

        // Check if a fee structure exists for this class and academic year
        const feeStructure = await mongoose.model('FeeStructure').findOne({
          schoolId: school._id,
          classId: classId,
          academicYearId: academicYearId,
        });
        if (!feeStructure) {
          console.log(`No fee structure found for ${className} in ${academicYearName}, skipping.`);
          continue;
        }

        console.log(`Generating invoices for school ${school._id}, class ${className}, month ${monthName} ${invoiceYear}`);
        // Call your existing generateInvoices function
        const invoices = await generateInvoices(school._id, classId, className, monthName, academicYearId);
        console.log(`Generated ${invoices.length} invoices for ${className}`);
      }
    }

    console.log('Monthly invoice generation completed.');
  } catch (error) {
    console.error('Error in monthly invoice generation:', error);
  }
};

// Schedule to run on the 1st of every month at 4:00 PM IST
cron.schedule('0 16 1 * *', () => {
  generateMonthlyInvoices();
}, {
  scheduled: true,
  timezone: 'Asia/Kolkata'
});

// Remove the immediate run for production (commented out)
// generateMonthlyInvoices();

module.exports = { generateMonthlyInvoices }; // Export for app.js integration