const mongoose = require('mongoose');
const moment = require('moment-timezone');
const FeeStructure = require('../models/feeStructure');
const Student = require('../models/student');
const Invoice = require('../models/feeInvoice');
const AcademicYear = require('../models/academicyear');
const { sendSMS } = require('../controllers/SMS/notificationService');


const generateInvoices = async (schoolId, classId, className, month, academicYearId, customSchedules = [], isExamMonth = false, studentId = null, miscalculationStudents = []) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!schoolId || !classId || !month || !academicYearId) {
      throw new Error('Missing required fields');
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = monthNames.indexOf(month);
    if (monthIndex === -1) throw new Error('Invalid month name');

    // THIS IS THE KEY LINE — November = 11
    const currentMonthNumber = monthIndex + 1;  // January = 1, November = 11, December = 12

    const today = moment.tz('Asia/Kolkata');
    let invoiceYear = today.year();

    // Simple year correction
    if (monthIndex < today.month() - 6) invoiceYear += 1;
    if (monthIndex > today.month() + 6) invoiceYear -= 1;

    const formattedMonth = `${invoiceYear}-${String(currentMonthNumber).padStart(2, '0')}`;
    const dueDate = moment.tz(`${invoiceYear}-${String(currentMonthNumber).padStart(2, '0')}-10`, 'Asia/Kolkata').toDate();

    const academicYear = await AcademicYear.findById(academicYearId).session(session);
    if (!academicYear) throw new Error('Academic year not found');

    const feeStructure = await FeeStructure.findOne({ schoolId, classId, academicYearId }).session(session);
    if (!feeStructure) throw new Error('Fee structure not found');

    const students = studentId
      ? await Student.find({ _id: studentId, schoolId, classId }).session(session)
      : await Student.find({ schoolId, classId }).session(session);

    if (students.length === 0) throw new Error('No students found');

    const school = await mongoose.model('School').findById(schoolId).select('name smsPackActive').session(session);
    const MISCALCULATION_FEE = 500;
    const invoices = [];

    for (const student of students) {
      // Skip if invoice already exists
      if (await Invoice.findOne({ studentId: student._id, month: formattedMonth, academicYear: academicYearId }).session(session)) {
        continue;
      }

      // Previous due
      let previousDue = 0;
      const prevMonthIdx = monthIndex === 0 ? 11 : monthIndex - 1;
      const prevYear = monthIndex === 0 ? invoiceYear - 1 : invoiceYear;
      const prevMonthStr = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}`;
      const prevInvoice = await Invoice.findOne({ studentId: student._id, month: prevMonthStr }).session(session);
      if (prevInvoice) previousDue = prevInvoice.remainingDue;

      let baseAmount = 0;
      let currentCharges = 0;
      const feeDetails = [];
      const appliedDiscounts = [];

      // MAIN FIX: Loop through all fees with correct frequency logic
      for (const fee of feeStructure.fees) {
        let shouldCharge = false;
        let amount = fee.amount;

        // Skip exam fee if not exam month
        if ((fee.name.toLowerCase().includes('exam') || fee.name.toLowerCase() === 'examfee') && !isExamMonth) {
          continue;
        }

        // Frequency check — THIS IS THE REAL FIX
        if (fee.frequency === 'Monthly') {
          shouldCharge = true;
        } else if (fee.frequency === 'Yearly') {
          shouldCharge = currentMonthNumber === 4; // Change 4 to your yearly month
        } else if (fee.frequency === 'Quarterly') {
          shouldCharge = [1, 4, 7, 10].includes(currentMonthNumber); // Jan, Apr, Jul, Oct
        } else if (fee.frequency === 'Specific Months') {
          shouldCharge = fee.specificMonths.includes(currentMonthNumber); // ← This fixes Development Fee
        }

        if (!shouldCharge) continue;

        // Base fee
        if (fee.type === 'Base') {
          baseAmount += amount;
          feeDetails.push({ name: fee.name, amount, type: 'Base' });
        }

        // Optional fees (transport, hostel, etc.)
        if (fee.type === 'Optional') {
          let optionalOk = false;

          if (fee.name.toLowerCase().includes('transport') && (student.feePreferences?.get('usesTransport') || student.routeId)) {
            optionalOk = true;
            if (student.routeId && fee.routeOptions?.length) {
              const opt = fee.routeOptions.find(r => r.routeId.toString() === student.routeId.toString());
              amount = opt ? opt.amount : amount;
            }
          } else if (fee.name.toLowerCase().includes('hostel') && student.feePreferences?.get('usesHostel')) {
            optionalOk = true;
          } else if (fee.preferenceKey && student.feePreferences?.get(fee.preferenceKey)) {
            optionalOk = true;
          }

          if (optionalOk) {
            currentCharges += amount;
            feeDetails.push({ name: fee.name, amount, type: 'Optional' });
          }
        }
      }

      // Miscalculation fee
      if (miscalculationStudents.includes(student._id.toString())) {
        currentCharges += MISCALCULATION_FEE;
        feeDetails.push({ name: 'Miscalculation Fee', amount: MISCALCULATION_FEE, type: 'Penalty' });
      }

      // Discounts
      let totalDiscount = 0;
      for (const d of feeStructure.discounts) {
        const val = d.type === 'Percentage' ? (currentCharges * d.amount) / 100 : d.amount;
        const applied = Math.min(val, currentCharges);
        totalDiscount += applied;
        appliedDiscounts.push({ name: d.name, amount: applied, type: d.type });
      }
      currentCharges = Math.max(0, currentCharges - totalDiscount);

      const totalAmount = baseAmount + currentCharges + previousDue;

      const invoice = new Invoice({
        schoolId,
        studentId: student._id,
        classId,
        className,
        academicYear: academicYearId,
        feeStructureId: feeStructure._id,
        month: formattedMonth,
        dueDate,
        baseAmount,
        previousDue,
        lateFee: 0,
        currentCharges,
        invoiceDetails: feeDetails,
        discountsApplied: appliedDiscounts,
        totalAmount,
        paidAmount: 0,
        remainingDue: totalAmount,
        status: 'Pending',
        paymentHistory: []
      });

      await invoice.save({ session });
      invoices.push(invoice);

      // SMS (unchanged)
      const phone = student.parents?.fatherPhone || student.parents?.motherPhone;
      if (school?.smsPackActive && phone && /^\d{10}$/.test(phone)) {
        try {
          await sendSMS(`+91${phone}`, {
            studentName: student.name,
            amount: totalAmount,
            dueDate,
            month: monthNames[monthIndex],
            schoolName: school.name
          });
        } catch (e) { console.error('SMS failed', e); }
      }
    }

    await session.commitTransaction();
    return invoices;

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getInvoiceById = async (invoiceId) => {
  try {
    return await Invoice.findById(invoiceId)
      .populate('studentId', 'name admissionNo className')
      .populate('academicYear', 'name')
      .populate('schoolId', 'name address')
      .populate('feeStructureId');
  } catch (error) {
    throw new Error(`Failed to get invoice: ${error.message}`);
  }
};

const updateInvoiceStatus = async (invoiceId, status) => {
  try {
    return await Invoice.findByIdAndUpdate(
      invoiceId,
      { status },
      { new: true }
    );
  } catch (error) {
    throw new Error(`Failed to update invoice status: ${error.message}`);
  }
};


// services/invoiceStatusUpdater.js
exports.updateInvoiceStatuses = async () => {
  const today = new Date();
  const invoices = await FeeInvoice.find({
    dueDate: { $lt: today },
    status: { $in: ['Pending', 'Partial'] }
  }).populate({
    path: 'feeStructureId',
    select: 'lateFeeConfig'
  });

  for (const invoice of invoices) {
    if (invoice.feeStructureId?.lateFeeConfig?.isEnabled) {
      const lateFee = calculateLateFees(invoice, invoice.feeStructureId);
      
      if (lateFee > 0) {
        // Update invoice with late fee
        invoice.lateFee = lateFee;
        invoice.totalAmount += lateFee;
        invoice.remainingDue += lateFee;
        invoice.invoiceDetails.push({
          name: 'Late Fee',
          amount: lateFee
        });
      }
    }

    // Always update status regardless of late fee
    if (invoice.remainingDue > 0) {
      invoice.status = 'Overdue';
      await invoice.save();
    }
  }
};

// const getInvoicesByClassAndMonth = async (req, res) => {
//   try {
//     const { classId, month } = req.params;
//     const { academicYearId } = req.query;
//     const schoolId = req.user.schoolId;

//     if (!classId || !month || !academicYearId || !schoolId) {
//       return res.status(400).json({
//         message: 'classId, month, academicYearId, and schoolId are required'
//       });
//     }

//     // Normalize month to YYYY-MM format
//     let formattedMonth;
//     const monthParts = month.split('-');
//     if (monthParts.length === 2) {
//       formattedMonth = month; // Already YYYY-MM (e.g., 2025-08)
//     } else if (monthParts.length === 3) {
//       formattedMonth = `${monthParts[0]}-${monthParts[1]}`; // Extract YYYY-MM from YYYY-MM-DD (e.g., 2025-08-06)
//     } else {
//       // Handle monthName year format (e.g., "August 2025")
//       const monthNames = ["January", "February", "March", "April", "May", "June", 
//                          "July", "August", "September", "October", "November", "December"];
//       const [monthName, year] = month.split(' ');
//       const monthIndex = monthNames.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
//       if (monthIndex === -1) {
//         return res.status(400).json({ message: 'Invalid month name' });
//       }
//       formattedMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
//     }

//     const invoices = await Invoice.find({
//       schoolId,
//       month: formattedMonth,
//       academicYear: academicYearId
//     })
//     .populate({
//       path: 'studentId',
//       match: { classId: classId },
//       select: 'name admissionNo classId'
//     })
//     .populate('feeStructureId')
//     .sort({ createdAt: -1 });

//     console.log('Raw invoices:', invoices.length);
//     const filteredInvoices = invoices.filter(invoice => invoice.studentId !== null);
//     console.log('Filtered invoices:', filteredInvoices.length);

//     if (filteredInvoices.length === 0) {
//       return res.status(404).json({
//         message: 'No invoices found for the specified class and month',
//         details: {
//           searchedMonth: formattedMonth,
//           classId,
//           academicYearId,
//           schoolId
//         }
//       });
//     }

//     res.status(200).json({
//       message: 'Invoices retrieved successfully',
//       data: filteredInvoices
//     });
//   } catch (error) {
//     console.error('Error fetching invoices:', error);
//     res.status(500).json({
//       message: 'Failed to retrieve invoices',
//       error: error.message
//     });
//   }
// };



const getInvoicesByClassAndMonth = async (req, res) => {
  try {
    const { classId, month, academicYearId } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId || !month || !academicYearId) {
      return res.status(400).json({ message: 'classId, month, academicYearId required' });
    }

    const invoices = await Invoice.find({
      schoolId,
      classId,
      academicYear: academicYearId,
      month
    })
      .populate('studentId', 'name admissionNo')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ data: invoices });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Probably in invoiceController.js or feeController.js
  // const getInvoicesByClassAndMonth = async (req, res) => {
  //   const { classId, month } = req.params;
  //   const { academicYearId } = req.query;
  //   const schoolId = req.user.schoolId;

  //   const invoices = await Invoice.find({
  //     schoolId,
  //     classId,
  //     month,
  //     academicYear: academicYearId   // ← WRONG: string vs ObjectId
  //   })
  //   .populate('studentId', 'name admissionNo')
  //   .sort({ 'studentId.name': 1 });

  //   if (invoices.length === 0) {
  //     return res.status(404).json({
  //       message: 'No invoices found...',
  //       details: { searchedMonth: month, classId, academicYearId, schoolId }
  //     });
  //   }

  //   res.json({ data: invoices });
  // };

module.exports = {
  generateInvoices,
  getInvoiceById,
  updateInvoiceStatus,
  getInvoicesByClassAndMonth
};