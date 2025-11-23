const mongoose = require('mongoose');
const moment = require('moment');
const { calculateLateFees } = require('../utils/lateFeeCalculator');
const FeeStructure = require('../models/feeStructure');
const Student = require('../models/student');
const Invoice = require('../models/feeInvoice');
const AcademicYear = require('../models/academicyear');

const generateMonthlyInvoices = async (schoolId, classId, month, year, academicYearId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate inputs
    if (!schoolId || !classId || !month || !year || !academicYearId) {
      throw new Error('Missing required fields');
    }

    const formattedMonth = `${year}-${String(month).padStart(2, '0')}`;
    const dueDate = new Date(year, month, 10); // Due on 10th of next month

    // Get fee structure
    const feeStructure = await FeeStructure.findOne({
      schoolId,
      classId,
      academicYearId
    }).session(session);

    if (!feeStructure) {
      throw new Error('Fee structure not found');
    }

    // Get active students
    const students = await Student.find({
      schoolId,
      classId,
      status: 'Active'
    }).session(session);

    if (students.length === 0) {
      throw new Error('No active students found');
    }

    const invoices = [];

    for (const student of students) {
      // Check for existing invoice
      const existingInvoice = await Invoice.findOne({
        studentId: student._id,
        month: formattedMonth,
        academicYear: academicYearId
      }).session(session);

      if (existingInvoice) continue;

      // Calculate previous dues
      const previousInvoices = await Invoice.find({
        studentId: student._id,
        status: { $in: ['Pending', 'Partial', 'Overdue'] },
        month: { $ne: formattedMonth }
      }).session(session);

      let previousDue = 0;
      if (previousInvoices.length > 0) {
        previousDue = previousInvoices.reduce((sum, inv) => sum + inv.remainingDue, 0);
      }

      // Calculate late fee if enabled
      let lateFee = 0;
      if (feeStructure.lateFeeConfig?.isEnabled && previousDue > 0) {
        // Use the oldest unpaid invoice for late fee calculation
        const oldestUnpaid = previousInvoices.sort((a, b) => a.dueDate - b.dueDate)[0];
        lateFee = calculateLateFees(
          { dueDate: oldestUnpaid.dueDate, remainingDue: previousDue, status: oldestUnpaid.status },
          feeStructure
        );
      }

      // Calculate current charges
      let baseAmount = 0;
      let currentCharges = 0;
      const feeDetails = [];

      for (const fee of feeStructure.fees) {
        let applies = true;
        
        // Check if fee applies this month
        if (fee.frequency === 'Quarterly' && month % 3 !== 0) applies = false;
        if (fee.frequency === 'Yearly' && month !== 6) applies = false; // June example
        if (fee.frequency === 'Specific Months' && !fee.specificMonths.includes(month + 1)) applies = false;
        if (fee.type === 'Optional' && fee.preferenceKey && !student[fee.preferenceKey]) applies = false;

        if (applies) {
          const amount = fee.amount;
          if (fee.type === 'Base') {
            baseAmount += amount;
          } else {
            currentCharges += amount;
          }
          feeDetails.push({
            name: fee.name,
            amount: amount,
            type: fee.type
          });
        }
      }

      // Apply discounts
      let discountAmount = 0;
      const appliedDiscounts = [];
      for (const discount of feeStructure.discounts) {
        const discountValue = discount.type === 'Percentage' 
          ? (currentCharges * discount.amount) / 100 
          : discount.amount;
        discountAmount += Math.min(discountValue, currentCharges);
        appliedDiscounts.push({
          name: discount.name,
          amount: discountValue,
          type: discount.type
        });
      }
      currentCharges = Math.max(0, currentCharges - discountAmount);
      console.log(baseAmount,'baseAmount')
      console.log(previousDue,'previousDue')
      // Create invoice
      const totalAmount = baseAmount + currentCharges + previousDue + lateFee;
      const invoice = new Invoice({
        schoolId,
        studentId: student._id,
        classId,
        className: student.className,
        academicYear: academicYearId,
        feeStructureId: feeStructure._id,
        month: formattedMonth,
        dueDate,
        baseAmount,
        previousDue,
        lateFee,
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
    }

    await session.commitTransaction();
    return invoices;
  } catch (error) {
    await session.abortTransaction();
    console.error('Invoice generation error:', error);
    throw error;
  } finally {
    session.endSession();
  }
};

module.exports = { generateMonthlyInvoices };