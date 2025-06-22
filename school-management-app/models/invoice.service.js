const mongoose = require('mongoose');
const moment = require('moment');
const FeeStructure = require('../models/feeStructure');
const Student = require('../models/student');
const Invoice = require('../models/feeInvoice');
const AcademicYear = require('../models/academicyear');

const generateInvoices = async (schoolId, classId, className, month, academicYearId, customSchedules = [], isExamMonth = false, studentId = null) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate inputs
    if (!schoolId || !classId || !month || !academicYearId) {
      throw new Error('Missing required fields: schoolId, classId, month, and academicYearId are required.');
    }

    // Convert month name to YYYY-MM format
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = monthNames.indexOf(month);
    if (monthIndex === -1) {
      throw new Error('Invalid month name. Please use full month names like "January", "February", etc.');
    }
    const year = new Date().getFullYear();
    const formattedMonth = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const monthNumber = parseInt(formattedMonth.split('-')[1]);

    // Fetch the academic year
    const academicYear = await AcademicYear.findById(academicYearId).session(session);
    if (!academicYear) {
      throw new Error('Academic year not found.');
    }

    // Fetch the fee structure
    const feeStructure = await FeeStructure.findOne({ schoolId, classId, academicYearId }).session(session);
    if (!feeStructure) {
      throw new Error(`No fee structure found for class ${className} in academic year ${academicYear.name}.`);
    }

    // Fetch students
    let students;
    if (studentId) {
      students = await Student.find({ _id: studentId, schoolId, classId }).session(session);
    } else {
      students = await Student.find({ schoolId, classId }).session(session);
    }
    if (students.length === 0) {
      throw new Error(`No students found in class ${className}.`);
    }

    const invoices = [];
    const currentDate = new Date();
    const dueDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 10); // Due on 10th of next month

    for (const student of students) {
      // Check for existing invoice from the previous month
      const previousMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
      const previousMonth = monthNames[previousMonthIndex];
      const previousFormattedMonth = `${year}-${String(previousMonthIndex + 1).padStart(2, '0')}`;
      const previousInvoice = await Invoice.findOne({
        studentId: student._id,
        month: previousFormattedMonth,
        academicYear: academicYearId,
        schoolId,
      }).session(session);

      let previousDue = 0;
      if (previousInvoice) {
        previousDue = previousInvoice.remainingDue; // Carry forward remaining due
      }

      // Check for existing invoice for the current month
      const existingInvoice = await Invoice.findOne({
        studentId: student._id,
        month: formattedMonth,
        academicYear: academicYearId,
        schoolId,
      }).session(session);
      if (existingInvoice) continue;

      // Initialize fee tracking
      let baseAmount = 0;
      let currentCharges = 0;
      const feeDetails = [];
      const appliedDiscounts = [];

      // Process all fees (assuming monthly)
      for (const fee of feeStructure.fees) {
        if ((fee.name.toLowerCase().includes('exam') || fee.name.toLowerCase() === 'examfee') && !isExamMonth) {
          continue;
        }

        let applies = true;
        if (fee.type === 'Optional' && fee.preferenceKey) {
          applies = student.feePreferences?.get(fee.preferenceKey) === true;
        }

        if (applies) {
          const amount = fee.amount;
          if (fee.type === 'Base') {
            baseAmount += amount;
          } else {
            currentCharges += amount;
          }
          feeDetails.push({
            name: fee.name,
            amount,
            type: fee.type,
            frequency: 'Monthly',
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

      // Create the invoice
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
    }

    await session.commitTransaction();
    return invoices;
  } catch (error) {
    await session.abortTransaction();
    console.error('Invoice generation error:', error);
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

module.exports = {
  generateInvoices,
  getInvoiceById,
  updateInvoiceStatus
};