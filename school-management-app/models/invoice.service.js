const moment = require('moment');
const Invoice = require('../models/feeInvoice');
const FeeStructure = require('../models/feeStructure');
const Student = require('../models/student');
const AcademicYear = require('../models/academicyear');

// Helper function to calculate fees (adapted from paym entController.js)
const calculateFees = async (student, feeStructure, monthDate, previousDue = 0, paymentSchedule, isExamMonth) => {
  // Start with zero and only add the relevant breakdown components
  let totalAmount = feeStructure.feeBreakdown.tuitionFee +
    (isExamMonth ? feeStructure.feeBreakdown.examFee : 0) +
    (student.usesTransport ? feeStructure.feeBreakdown.transportFee : 0) +
    (student.usesHostel ? feeStructure.feeBreakdown.hostelFee : 0) +
    feeStructure.feeBreakdown.miscFee +
    (feeStructure.feeBreakdown.labFee || 0) +
    previousDue;

  // The baseAmount should reflect the adjusted base fee for reporting purposes
  let baseAmount = totalAmount - previousDue; // Exclude previousDue for baseAmount

  // Define invoice details (breakdown) for display in the invoice
  let invoiceDetails = {
    tuitionFee: feeStructure.feeBreakdown.tuitionFee,
    examFee: isExamMonth ? feeStructure.feeBreakdown.examFee : 0,
    transportFee: student.usesTransport ? feeStructure.feeBreakdown.transportFee : 0,
    hostelFee: student.usesHostel ? feeStructure.feeBreakdown.hostelFee : 0,
    miscFee: feeStructure.feeBreakdown.miscFee,
    labFee: feeStructure.feeBreakdown.labFee || 0,
  };

  // Adjust totalAmount and invoiceDetails based on payment schedule
  if (paymentSchedule === 'Monthly' && feeStructure.frequency === 'Quarterly') {
    totalAmount = totalAmount / 3; // Quarterly fee divided into 3 months
    baseAmount = baseAmount / 3;
    invoiceDetails.tuitionFee = invoiceDetails.tuitionFee / 3;
    invoiceDetails.examFee = invoiceDetails.examFee / 3;
    invoiceDetails.transportFee = invoiceDetails.transportFee / 3;
    invoiceDetails.hostelFee = invoiceDetails.hostelFee / 3;
    invoiceDetails.miscFee = invoiceDetails.miscFee / 3;
    invoiceDetails.labFee = invoiceDetails.labFee / 3;
  } else if (paymentSchedule === 'BiMonthly' && feeStructure.frequency === 'Quarterly') {
    totalAmount = (totalAmount / 3) * 2; // Pay for 2 months together
    baseAmount = (baseAmount / 3) * 2;
    invoiceDetails.tuitionFee = (invoiceDetails.tuitionFee / 3) * 2;
    invoiceDetails.examFee = (invoiceDetails.examFee / 3) * 2;
    invoiceDetails.transportFee = (invoiceDetails.transportFee / 3) * 2;
    invoiceDetails.hostelFee = (invoiceDetails.hostelFee / 3) * 2;
    invoiceDetails.miscFee = (invoiceDetails.miscFee / 3) * 2;
    invoiceDetails.labFee = (invoiceDetails.labFee / 3) * 2;
  } else if (paymentSchedule === 'Custom') {
    const months = parseInt(paymentSchedule.customPaymentDetails?.match(/\d+/)?.[0] || '1');
    totalAmount = (totalAmount / 3) * months;
    baseAmount = (baseAmount / 3) * months;
    invoiceDetails.tuitionFee = (invoiceDetails.tuitionFee / 3) * months;
    invoiceDetails.examFee = (invoiceDetails.examFee / 3) * months;
    invoiceDetails.transportFee = (invoiceDetails.transportFee / 3) * months;
    invoiceDetails.hostelFee = (invoiceDetails.hostelFee / 3) * months;
    invoiceDetails.miscFee = (invoiceDetails.miscFee / 3) * months;
    invoiceDetails.labFee = (invoiceDetails.labFee / 3) * months;
  }

  // Calculate late fee
  let lateFee = 0;
  const dueDate = moment(monthDate).endOf('month').toDate();
  if (new Date() > dueDate && totalAmount > 0) {
    const daysLate = moment().diff(dueDate, 'days');
    lateFee = Math.min(
      feeStructure.lateFeeRules.dailyRate * daysLate,
      feeStructure.lateFeeRules.maxLateFee
    );
    totalAmount += lateFee;
  }

  // Apply discounts
  const discountsApplied = [];
  let discountTotal = 0;
  for (const discount of feeStructure.discounts) {
    let discountAmount = discount.type === 'Percentage'
      ? (totalAmount * discount.amount) / 100
      : discount.amount;
    discountTotal += discountAmount;
    discountsApplied.push({ name: discount.name, amount: discountAmount });
  }
  totalAmount -= discountTotal;

  return {
    studentId: student._id,
    baseAmount,
    previousDue,
    lateFee,
    currentCharges: baseAmount, // Current charges exclude previousDue and lateFee
    invoiceDetails,
    totalAmount,
    remainingDue: totalAmount,
    discountsApplied,
  };
};

const generateInvoices = async (schoolId, classId, className, month, academicYearId, customSchedules = []) => {
  console.log(`Generating invoices for classId: ${classId}, className: ${className}, month: ${month}, academicYearId: ${academicYearId}`);
  const monthDate = moment(month, 'YYYY-MM');
  if (!monthDate.isValid()) {
    throw new Error('Invalid month format. Use YYYY-MM.');
  }

  const academicYear = await AcademicYear.findById(academicYearId);
  if (!academicYear) {
    throw new Error('Invalid academic year ID.');
  }

  if (monthDate < moment(academicYear.startDate) || monthDate > moment(academicYear.endDate)) {
    throw new Error(`Month ${month} is not within the academic year ${academicYear.name}`);
  }

  if (academicYear.schoolId.toString() !== schoolId) {
    throw new Error('Academic year does not belong to this school.');
  }

  const students = await Student.find({ schoolId, classId: classId });
  console.log(`Found ${students.length} students for classId: ${classId}`);
  if (!students.length) {
    throw new Error('No students found for this class.');
  }

  const feeStructure = await FeeStructure.findOne({ schoolId, className, academicYear: academicYearId });
  if (!feeStructure) {
    throw new Error('Fee structure not found for this class.');
  }

  const invoices = [];
  for (const student of students) {
    const existingInvoice = await Invoice.findOne({
      studentId: student._id,
      academicYear: academicYear._id,
      month: monthDate.format('YYYY-MM'),
    });
    if (existingInvoice) continue;

    const customSchedule = customSchedules.find(cs => cs.studentId === student._id.toString());
    const paymentSchedule = customSchedule?.paymentSchedule || feeStructure.frequency;

    const previousInvoices = await Invoice.find({
      studentId: student._id,
      academicYear: academicYear._id,
      month: { $lt: monthDate.format('YYYY-MM') },
    });
    const previousDue = previousInvoices.reduce((sum, inv) => sum + inv.remainingDue, 0);

    const feeDetails = await calculateFees(student, feeStructure, monthDate, previousDue, customSchedule || { paymentSchedule });

    const invoice = new Invoice({
      ...feeDetails,
      schoolId,
      feeStructureId: feeStructure._id,
      academicYear: academicYear._id,
      month: monthDate.format('YYYY-MM'),
      dueDate: moment(monthDate).endOf('month').toDate(),
      status: 'Pending',
      paymentSchedule,
      customPaymentDetails: customSchedule?.customPaymentDetails,
      paymentHistory: [],
    });
    invoices.push(invoice);
  }

  if (invoices.length === 0) {
    throw new Error('Invoices already exist for this class and month.');
  }

  await Invoice.insertMany(invoices);
  return invoices;
};

module.exports = { generateInvoices };