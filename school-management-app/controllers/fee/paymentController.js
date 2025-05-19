const mongoose = require('mongoose');
const moment = require('moment');
const FeeStructure = require('../../models/feeStructure');
const Student = require('../../models/student');
const FeeInvoice = require('../../models/feeInvoice');
const AcademicYear = require('../../models/academicyear');

// Helper function for fee calculations
const calculateFees = (student, feeStructure, monthDate) => {
  const isExamMonth = feeStructure.examMonths.includes(
    moment(monthDate).format('YYYY-MM')
  );
  
  return {
    studentId: student._id,
    baseAmount: feeStructure.baseFee,
    tuitionFee: feeStructure.feeBreakdown.tuitionFee,
    examFee: isExamMonth ? feeStructure.feeBreakdown.examFee : 0,
    transportFee: student.usesTransport ? feeStructure.feeBreakdown.transportFee : 0,
    hostelFee: student.usesHostel ? feeStructure.feeBreakdown.hostelFee : 0,
    miscFee: feeStructure.feeBreakdown.miscFee,
    totalAmount: feeStructure.baseFee + 
               feeStructure.feeBreakdown.tuitionFee +
               (isExamMonth ? feeStructure.feeBreakdown.examFee : 0) +
               (student.usesTransport ? feeStructure.feeBreakdown.transportFee : 0) +
               (student.usesHostel ? feeStructure.feeBreakdown.hostelFee : 0) +
               feeStructure.feeBreakdown.miscFee
  };
};

// Bulk invoice generation for a class
exports.generateBulkMonthlyInvoices = async (req, res) => {
  try {
    const { className, month, academicYearId, sections } = req.body;
    const schoolId = req.user.schoolId;

    // Validate academic year
    const academicYear = await AcademicYear.findOne({
      _id: academicYearId,
      schoolId,
      isActive: true
    }).orFail(new Error('Invalid academic year'));

    // Validate month
    const monthDate = moment(month, 'YYYY-MM');
    if (!monthDate.isValid() || 
        monthDate < academicYear.startDate || 
        monthDate > academicYear.endDate) {
      return res.status(400).json({
        success: false,
        error: `Invalid month or not in ${academicYear.name} session`
      });
    }

    // Get fee structure
    const feeStructure = await FeeStructure.findOne({
      schoolId,
      academicYear: academicYearId,
      className
    }).orFail(new Error('Fee structure not found'));

    // Get students
    const students = await Student.find({
      schoolId,
      className,
      academicYear: academicYearId,
      section: { $in: sections }
    }).select('_id usesTransport usesHostel');

    // Prepare bulk operations
    const bulkOps = students.map(student => ({
      updateOne: {
        filter: {
          studentId: student._id,
          academicYear: academicYearId,
          month: monthDate.format('YYYY-MM')
        },
        update: {
          $setOnInsert: {
            ...calculateFees(student, feeStructure, monthDate),
            schoolId,
            status: 'Pending',
            paymentHistory: [],
            dueDate: moment().endOf('month').toDate()
          }
        },
        upsert: true
      }
    }));

    // Execute bulk operation
    const result = await FeeInvoice.bulkWrite(bulkOps, { ordered: false });
    
    res.json({
      success: true,
      created: result.upsertedCount,
      existing: result.matchedCount
    });

  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Process individual payment
exports.processPayment = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { amount, paymentMethod = 'Cash' } = req.body;
    const schoolId = req.user.schoolId;

    // Validate invoice
    const invoice = await FeeInvoice.findOne({
      _id: invoiceId,
      schoolId
    }).orFail(new Error('Invoice not found'));

    // Validate payment amount
    if (amount <= 0 || amount > invoice.remainingDue) {
      return res.status(400).json({
        success: false,
        error: `Invalid amount. Remaining due: ₹${invoice.remainingDue}`
      });
    }

    // Update invoice
    invoice.paymentHistory.push({
      date: new Date(),
      amount,
      method: paymentMethod,
      processedBy: req.user.id
    });

    invoice.paidAmount += amount;
    invoice.remainingDue = invoice.totalAmount - invoice.paidAmount;
    invoice.status = invoice.remainingDue > 0 ? 'Partially Paid' : 'Paid';

    // Update student records
    await Student.findByIdAndUpdate(invoice.studentId, {
      $inc: { totalPaid: amount, totalDue: -amount }
    });

    const updatedInvoice = await invoice.save();

    res.json({
      success: true,
      data: updatedInvoice
    });

  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get student fee summary
exports.getStudentFeeSummary = async (req, res) => {
  try {
    const { studentId } = req.params;
    const schoolId = req.user.schoolId;

    const [student, invoices] = await Promise.all([
      Student.findById(studentId),
      FeeInvoice.find({ studentId, schoolId })
        .sort('month')
        .populate('academicYear', 'name')
    ]);

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    res.json({
      success: true,
      data: {
        student: student.name,
        totalPaid: student.totalPaid,
        totalDue: student.totalDue,
        invoices: invoices.map(invoice => ({
          month: invoice.month,
          amount: invoice.totalAmount,
          paid: invoice.paidAmount,
          status: invoice.status,
          academicYear: invoice.academicYear.name
        }))
      }
    });

  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// Get invoice details
exports.getInvoiceDetails = async (req, res) => {
  try {
    const invoice = await FeeInvoice.findById(req.params.id)
      .populate('studentId', 'name admissionNo className')
      .populate('academicYear', 'name')
      .populate('schoolId', 'name address');

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      data: {
        invoiceDate: invoice.createdAt,
        dueDate: invoice.dueDate,
        status: invoice.status,
        student: invoice.studentId,
        academicYear: invoice.academicYear,
        breakdown: invoice.invoiceDetails,
        payments: invoice.paymentHistory,
        totals: {
          baseAmount: invoice.baseAmount,
          total: invoice.totalAmount,
          paid: invoice.paidAmount,
          due: invoice.remainingDue
        }
      }
    });

  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};