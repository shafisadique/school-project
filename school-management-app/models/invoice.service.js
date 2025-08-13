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
    // Validate inputs
    if (!schoolId || !classId || !month || !academicYearId) {
      throw new Error('Missing required fields: schoolId, classId, month, and academicYearId are required.');
    }

    const today = moment.tz('Asia/Kolkata'); // August 11, 2025
    const currentMonth = today.month(); // 7 (August)
    const currentYear = today.year(); // 2025
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = monthNames.indexOf(month);
    console.log(monthIndex)
    if (monthIndex === -1) {
      throw new Error('Invalid month name. Use full names like "June".');
    }

    // No automatic shifting to next month; generate for the specified month regardless of date
    let invoiceYear = currentYear;
    let invoiceMonth = monthIndex;

    // Adjust year if the specified month is in the past relative to current month (assume previous year) or future (next year)
    // This is a basic heuristic; for more accuracy, use academic year dates
    if (invoiceMonth < currentMonth - 3) { // Arbitrary threshold to detect "next year" intent, but prevent too far future
      invoiceYear += 1;
    } else if (invoiceMonth > currentMonth + 3) { // Detect "previous year"
      invoiceYear -= 1;
    }

    const formattedMonth = `${invoiceYear}-${String(invoiceMonth + 1).padStart(2, '0')}`; // e.g., 2025-08 for August
    const dueDate = moment.tz(`${invoiceYear}-${String(invoiceMonth + 1).padStart(2, '0')}-10`, 'Asia/Kolkata').toDate(); // e.g., August 10, 2025

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
    
    const SchoolSchema = require('../models/school');
    const school = await SchoolSchema.findById(schoolId).select('name smsPackActive').session(session);
    if (!school) throw new Error(`School with ID ${schoolId} not found`);

    // Define miscalculation fee (configurable, default to ₹500)
    const MISCALCULATION_FEE = 500;

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

      // Previous due (adjusted for potential year change)
      let previousMonthIndex = invoiceMonth - 1;
      let previousYear = invoiceYear;
      if (previousMonthIndex < 0) {
        previousMonthIndex = 11;
        previousYear -= 1;
      }
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
      for (const fee of feeStructure.fees) {
        if (fee.frequency !== 'Monthly' && !customSchedules.some(cs => cs.studentId === student._id.toString() && cs.paymentSchedule !== 'Quarterly')) continue;
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
            if (student.feePreferences?.get('usesTransport') || student.routeId) {
              applies = true;
              if (student.routeId && fee.routeOptions?.length > 0) {
                const routeOption = fee.routeOptions.find(opt => opt.routeId.toString() === student.routeId.toString());
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

      // Add miscalculation fee if student is in miscalculationStudents array
      let miscalculationFee = 0;
      if (miscalculationStudents.includes(student._id.toString())) {
        miscalculationFee = MISCALCULATION_FEE;
        currentCharges += miscalculationFee;
        feeDetails.push({
          name: 'Miscalculation Fee',
          amount: miscalculationFee,
          type: 'Penalty',
          frequency: 'OneTime',
        });
        console.log(`Added miscalculation fee (${miscalculationFee}) for ${student._id}`);
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
      console.log(`Invoice for ${student._id}: total ${totalAmount}, base ${baseAmount}, charges ${currentCharges}, miscalculation ${miscalculationFee}`);

      // Send SMS if school has active SMS pack and a parent contact is available
      const parentContact = student.parents.fatherPhone || student.parents.motherPhone;
      if (school.smsPackActive && parentContact && /^\d{10}$/.test(parentContact)) {
        const messageData = {
          studentName: student.name,
          amount: totalAmount,
          dueDate: dueDate,
          month: monthNames[invoiceMonth],
          // paymentLink: `https://yourapp.com/pay/${invoice._id}`, // Replace with your actual payment URL
          schoolName: school.name
        };
        try {
          await sendSMS(`+91${parentContact}`, messageData); // Prepend country code (e.g., +91 for India)
          console.log(`SMS sent to +91${parentContact} for invoice ${invoice._id}`);
        } catch (smsError) {
          console.error(`Failed to send SMS for invoice ${invoice._id}: ${smsError.message}`);
          // Log error but continue processing
        }
      } else if (school.smsPackActive && !parentContact) {
        console.log(`No parent contact available for student ${student._id}`);
      }
    }

    await session.commitTransaction();
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

    // Normalize month to YYYY-MM format
    let formattedMonth;
    const monthParts = month.split('-');
    if (monthParts.length === 2) {
      formattedMonth = month; // Already YYYY-MM (e.g., 2025-08)
    } else if (monthParts.length === 3) {
      formattedMonth = `${monthParts[0]}-${monthParts[1]}`; // Extract YYYY-MM from YYYY-MM-DD (e.g., 2025-08-06)
    } else {
      // Handle monthName year format (e.g., "August 2025")
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