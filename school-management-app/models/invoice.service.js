const mongoose = require('mongoose');
const moment = require('moment-timezone');
const FeeStructure = require('../models/feeStructure');
const Student = require('../models/student');
const Invoice = require('../models/feeInvoice');
const AcademicYear = require('../models/academicyear');

// const generateInvoices = async (schoolId, classId, className, month, academicYearId, customSchedules = [], isExamMonth = false, studentId = null) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     // Validate inputs
//     if (!schoolId || !classId || !month || !academicYearId) {
//       throw new Error('Missing required fields: schoolId, classId, month, and academicYearId are required.');
//     }

//     // Convert month name to YYYY-MM format
//     const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
//     const monthIndex = monthNames.indexOf(month);
//     if (monthIndex === -1) {
//       throw new Error('Invalid month name. Please use full month names like "January", "February", etc.');
//     }
//     const year = new Date().getFullYear();
//     const formattedMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
//     const monthNumber = parseInt(formattedMonth.split('-')[1]);

//     // Fetch the academic year
//     const academicYear = await AcademicYear.findById(academicYearId).session(session);
//     if (!academicYear) {
//       throw new Error('Academic year not found.');
//     }

//     // Fetch the fee structure
//     const feeStructure = await FeeStructure.findOne({ schoolId, classId, academicYearId }).session(session);
//     if (!feeStructure) {
//       throw new Error(`No fee structure found for class ${className} in academic year ${academicYear.name}.`);
//     }

//     // Fetch students
//     let students;
//     if (studentId) {
//       students = await Student.find({ _id: studentId, schoolId, classId }).session(session);
//     } else {
//       students = await Student.find({ schoolId, classId }).session(session);
//     }
//     if (students.length === 0) {
//       throw new Error(`No students found in class ${className}.`);
//     }

//     const invoices = [];
//     const currentDate = new Date();
//     const dueDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 10); // Due on 10th of next month

//     for (const student of students) {
//       // Check for existing invoice from the previous month
//       const previousMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
//       const previousMonth = monthNames[previousMonthIndex];
//       const previousFormattedMonth = `${year}-${String(previousMonthIndex + 1).padStart(2, '0')}`;
//       const previousInvoice = await Invoice.findOne({
//         studentId: student._id,
//         month: previousFormattedMonth,
//         academicYear: academicYearId,
//         schoolId,
//       }).session(session);

//       let previousDue = 0;
//       if (previousInvoice) {
//         previousDue = previousInvoice.remainingDue; // Carry forward remaining due
//       }

//       // Check for existing invoice for the current month
//       const existingInvoice = await Invoice.findOne({
//         studentId: student._id,
//         month: formattedMonth,
//         academicYear: academicYearId,
//         schoolId,
//       }).session(session);
//       if (existingInvoice) continue;

//       // Initialize fee tracking
//       let baseAmount = 0;
//       let currentCharges = 0;
//       const feeDetails = [];
//       const appliedDiscounts = [];

//       // Process all fees (assuming monthly)
//       for (const fee of feeStructure.fees) {
//         if ((fee.name.toLowerCase().includes('exam') || fee.name.toLowerCase() === 'examfee') && !isExamMonth) {
//           continue;
//         }

//         let applies = true;
//         if (fee.type === 'Optional' && fee.preferenceKey) {
//           applies = student.feePreferences?.get(fee.preferenceKey) === true;
//         }

//         if (applies) {
//           const amount = fee.amount;
//           if (fee.type === 'Base') {
//             baseAmount += amount;
//           } else {
//             currentCharges += amount;
//           }
//           feeDetails.push({
//             name: fee.name,
//             amount,
//             type: fee.type,
//             frequency: 'Monthly',
//             preferenceKey: fee.preferenceKey,
//           });
//         }
//       }

//       // Apply discounts
//       let discountAmount = 0;
//       for (const discount of feeStructure.discounts) {
//         let discountValue = discount.type === 'Percentage' ? (currentCharges * discount.amount) / 100 : discount.amount;
//         discountValue = Math.min(discountValue, currentCharges);
//         discountAmount += discountValue;
//         appliedDiscounts.push({
//           name: discount.name,
//           amount: discountValue,
//           type: discount.type,
//         });
//       }
//       currentCharges -= discountAmount;
//       const totalAmount = baseAmount + currentCharges;

//       // Create the invoice
//       const invoice = new Invoice({
//         schoolId,
//         studentId: student._id,
//         classId,
//         className,
//         academicYear: academicYearId,
//         feeStructureId: feeStructure._id,
//         month: formattedMonth,
//         dueDate,
//         baseAmount,
//         previousDue,
//         lateFee: 0,
//         currentCharges,
//         invoiceDetails: feeDetails,
//         totalAmount,
//         paidAmount: 0,
//         remainingDue: totalAmount + previousDue,
//         discountsApplied: appliedDiscounts,
//         paymentSchedule: 'Monthly',
//         status: 'Pending',
//         paymentHistory: [],
//       });

//       await invoice.save({ session });
//       invoices.push(invoice);
//     }

//     await session.commitTransaction();
//     return invoices;
//   } catch (error) {
//     await session.abortTransaction();
//     console.error('Invoice generation error:', error);
//     throw new Error(`Failed to generate invoices: ${error.message}`);
//   } finally {
//     session.endSession();
//   }
// };



const generateInvoices = async (schoolId, classId, className, month, academicYearId, customSchedules = [], isExamMonth = false, studentId = null) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate inputs
    if (!schoolId || !classId || !month || !academicYearId) {
      throw new Error('Missing required fields: schoolId, classId, month, and academicYearId are required.');
    }

    // Set invoice month and due date (today is 07:57 PM IST, June 27, 2025)
    const today = moment.tz('Asia/Kolkata'); // June 27, 2025, 07:57 PM IST
    const currentMonth = today.month(); // 5 (June)
    const currentYear = today.year(); // 2025
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = monthNames.indexOf(month);
    if (monthIndex === -1) {
      throw new Error('Invalid month name. Use full names like "June".');
    }

    // Set to next month if past the 10th (June 27 > 10, so July 2025)
    let invoiceYear = currentYear;
    let invoiceMonth = monthIndex;
    if (today.date() > 10 && monthIndex === currentMonth) {
      invoiceMonth = (currentMonth + 1) % 12; // 6 (July)
      if (invoiceMonth === 0) {
        invoiceMonth = 12;
        invoiceYear += 1;
      }
    }
    const formattedMonth = `${invoiceYear}-${String(invoiceMonth + 1).padStart(2, '0')}`; // 2025-07
    const dueDate = moment.tz(`${invoiceYear}-${String(invoiceMonth + 1).padStart(2, '0')}-10`, 'Asia/Kolkata').toDate(); // July 10, 2025
    console.log(`Generating for month: ${formattedMonth}, due date: ${dueDate}`);

    // Fetch data
    const academicYear = await AcademicYear.findById(academicYearId).session(session);
    if (!academicYear) throw new Error('Academic year not found.');

    const feeStructure = await FeeStructure.findOne({ schoolId, classId, academicYearId }).session(session);
    if (!feeStructure) throw new Error(`No fee structure for ${className} in ${academicYear.name}.`);

    let students;
    if (studentId) {
      students = await Student.find({ _id: studentId, schoolId, classId }).session(session);
    } else {
      students = await Student.find({ schoolId, classId }).session(session);
    }
    console.log(`Found ${students.length} students:`, students.map(s => s._id));
    if (students.length === 0) throw new Error(`No students in ${className}.`);

    const invoices = [];

    for (const student of students) {
      // Skip if invoice exists
      const existingInvoice = await Invoice.findOne({
        studentId: student._id,
        month: formattedMonth,
        academicYear: academicYearId,
        schoolId,
      }).session(session);
      if (existingInvoice) {
        console.log(`Skipping ${student._id}, invoice exists`);
        continue;
      }

      // Previous due
      const previousMonthIndex = (monthIndex === 0 ? 11 : monthIndex - 1) % 12;
      const previousYear = monthIndex === 0 ? invoiceYear - 1 : invoiceYear;
      const previousFormattedMonth = `${previousYear}-${String(previousMonthIndex + 1).padStart(2, '0')}`;
      const previousInvoice = await Invoice.findOne({
        studentId: student._id,
        month: previousFormattedMonth,
        academicYear: academicYearId,
        schoolId,
      }).session(session);
      const previousDue = previousInvoice ? previousInvoice.remainingDue : 0;

      // Track fees
      let baseAmount = 0;
      let currentCharges = 0;
      const feeDetails = [];
      const appliedDiscounts = [];

      // Process fees
      // Process fees
for (const fee of feeStructure.fees) {
  if (fee.frequency !== 'Monthly' && !customSchedules.includes(fee.name)) continue;
  if ((fee.name.toLowerCase().includes('exam') || fee.name.toLowerCase() === 'examfee') && !isExamMonth) continue;

  let feeAmount = 0;
  let applies = false;

  // Base fees always apply
  if (fee.type === 'Base') {
    feeAmount = fee.amount;
    applies = true;
    console.log(`Base ${fee.name} (${feeAmount}) for ${student._id}`);
  }
  // Optional fees - check preferences
  else if (fee.type === 'Optional') {
    // Check if this is transport fee
    if (fee.name.toLowerCase() === 'transportfee') {
      // Check if student has transport preference or route assigned
      if (student.feePreferences?.get('usesTransport') || student.routeId) {
        applies = true;
        // Find the route option if routeId exists
        if (student.routeId && fee.routeOptions?.length > 0) {
          const routeOption = fee.routeOptions.find(opt => 
            opt.routeId.toString() === student.routeId.toString()
          );
          feeAmount = routeOption ? routeOption.amount : fee.amount;
        } else {
          feeAmount = fee.amount;
        }
        console.log(`Transport fee for ${student._id}: ${feeAmount}`);
      }
    }
    // Check if this is hostel fee
    else if (fee.name.toLowerCase() === 'hostafee' || fee.name.toLowerCase() === 'hostelfee') {
      if (student.feePreferences?.get('usesHostel')) {
        applies = true;
        feeAmount = fee.amount;
        console.log(`Hostel fee for ${student._id}: ${feeAmount}`);
      }
    }
    // Other optional fees
    else if (fee.preferenceKey && student.feePreferences?.get(fee.preferenceKey)) {
      applies = true;
      feeAmount = fee.amount;
      console.log(`Optional fee ${fee.name} for ${student._id}: ${feeAmount}`);
    }
  }

  if (applies) {
    if (fee.type === 'Base') {
      baseAmount += feeAmount;
    } else {
      currentCharges += feeAmount;
    }
    feeDetails.push({
      name: fee.name,
      amount: feeAmount,
      type: fee.type,
      frequency: fee.frequency,
      preferenceKey: fee.preferenceKey,
    });
  }
}

      // Apply discounts
      let discountAmount = 0;
      for (const discount of feeStructure.discounts) {
        let discountValue = discount.type === 'Percentage' ? (currentCharges * discount.amount) / 100 : discount.amount;
        discountValue = Math.min(discountValue, currentCharges);
        discountAmount += discountValue;
        appliedDiscounts.push({
          name: discount.name,
          amount: discountValue,
          type: discount.type,
        });
      }
      currentCharges -= discountAmount;
      const totalAmount = baseAmount + currentCharges;

      // Create invoice
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
        totalAmount,
        paidAmount: 0,
        remainingDue: totalAmount + previousDue,
        discountsApplied: appliedDiscounts,
        paymentSchedule: 'Monthly',
        status: 'Pending',
        paymentHistory: [],
      });

      await invoice.save({ session });
      invoices.push(invoice);
      console.log(`Invoice for ${student._id}: total ${totalAmount}, base ${baseAmount}, charges ${currentCharges}`);
    }

    await session.commitTransaction();
    console.log(`Generated ${invoices.length} invoices for ${className}`);
    return invoices;
  } catch (error) {
    await session.abortTransaction();
    console.error('Error:', error);
    throw new Error(`Failed to generate invoices: ${error.message}`);
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


const getInvoicesByClassAndMonth = async (req, res) => {
  try {
    const { classId, month } = req.params;
    const { academicYearId } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId || !month || !academicYearId || !schoolId) {
      return res.status(400).json({
        message: 'classId, month, academicYearId, and schoolId are required'
      });
    }

    let formattedMonth;
    if (month.includes('-')) {
      formattedMonth = month;
    } else {
      const monthNames = ["January", "February", "March", "April", "May", "June", 
                         "July", "August", "September", "October", "November", "December"];
      const [monthName, year] = month.split(' ');
      const monthIndex = monthNames.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
      if (monthIndex === -1) {
        return res.status(400).json({ message: 'Invalid month name' });
      }
      formattedMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    }

    console.log('Query params:', { schoolId, month: formattedMonth, academicYearId, classId });

    const invoices = await Invoice.find({
      schoolId,
      month: formattedMonth,
      academicYear: academicYearId
    })
    .populate({
      path: 'studentId',
      match: { classId: classId },
      select: 'name admissionNo classId'
    })
    .populate('feeStructureId')
    .sort({ createdAt: -1 });

    console.log('Raw invoices:', invoices.length);
    const filteredInvoices = invoices.filter(invoice => invoice.studentId !== null);
    console.log('Filtered invoices:', filteredInvoices.length);

    if (filteredInvoices.length === 0) {
      return res.status(404).json({
        message: 'No invoices found for the specified class and month',
        details: {
          searchedMonth: formattedMonth,
          classId,
          academicYearId,
          schoolId
        }
      });
    }

    res.status(200).json({
      message: 'Invoices retrieved successfully',
      data: filteredInvoices
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      message: 'Failed to retrieve invoices',
      error: error.message
    });
  }
};

module.exports = {
  generateInvoices,
  getInvoiceById,
  updateInvoiceStatus,
  getInvoicesByClassAndMonth
};