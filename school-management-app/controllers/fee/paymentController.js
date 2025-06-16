const mongoose = require('mongoose');
const moment = require('moment');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const AdmZip = require('adm-zip');
const FeeStructure = require('../../models/feeStructure');
const Student = require('../../models/student');
const FeeInvoice = require('../../models/feeInvoice');
const AcademicYear = require('../../models/academicyear');
const School = require('../../models/school');

// Helper function for fee calculations
const calculateFees = async (student, feeStructure, monthDate, previousDue = 0, isExamMonth = false) => {
  let totalAmount = feeStructure.baseFee +
    feeStructure.feeBreakdown.tuitionFee +
    (isExamMonth ? feeStructure.feeBreakdown.examFee : 0) +
    (student.usesTransport ? feeStructure.feeBreakdown.transportFee : 0) +
    (student.usesHostel ? feeStructure.feeBreakdown.hostelFee : 0) +
    feeStructure.feeBreakdown.miscFee +
    (feeStructure.feeBreakdown.labFee || 0) +
    previousDue;

  // Calculate late fee if overdue
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
    baseAmount: feeStructure.baseFee,
    previousDue,
    lateFee,
    currentCharges: feeStructure.baseFee +
      feeStructure.feeBreakdown.tuitionFee +
      (isExamMonth ? feeStructure.feeBreakdown.examFee : 0) +
      (student.usesTransport ? feeStructure.feeBreakdown.transportFee : 0) +
      (student.usesHostel ? feeStructure.feeBreakdown.hostelFee : 0) +
      feeStructure.feeBreakdown.miscFee +
      (feeStructure.feeBreakdown.labFee || 0),
    invoiceDetails: {
      tuitionFee: feeStructure.feeBreakdown.tuitionFee,
      examFee: isExamMonth ? feeStructure.feeBreakdown.examFee : 0,
      transportFee: student.usesTransport ? feeStructure.feeBreakdown.transportFee : 0,
      hostelFee: student.usesHostel ? feeStructure.feeBreakdown.hostelFee : 0,
      miscFee: feeStructure.feeBreakdown.miscFee,
      labFee: feeStructure.feeBreakdown.labFee || 0
    },
    totalAmount,
    remainingDue: totalAmount,
    discountsApplied
  };
};

// Generate single invoice for a student
exports.generateSingleInvoice = async (req, res) => {
  try {
    const { studentId, month, academicYearId } = req.body;
    const schoolId = req.user.schoolId;

    // Validate academic year
    const academicYear = await AcademicYear.findOne({ _id: academicYearId, schoolId });
    if (!academicYear) {
      return res.status(404).json({ error: 'Academic year not found' });
    }

    // Validate month
    const monthDate = moment(month, 'YYYY-MM');
    if (!monthDate.isValid() || monthDate < academicYear.startDate || monthDate > academicYear.endDate) {
      return res.status(400).json({ error: `Invalid month or not in ${academicYear.name} session` });
    }

    // Get student
    const student = await Student.findOne({ _id: studentId, schoolId });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get fee structure
    const feeStructure = await FeeStructure.findOne({
      schoolId,
      academicYear: academicYearId,
      className: student.className
    });
    if (!feeStructure) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }

    // Check for existing invoice
    const existingInvoice = await FeeInvoice.findOne({
      studentId,
      academicYear: academicYearId,
      month: monthDate.format('YYYY-MM')
    });
    if (existingInvoice) {
      return res.status(409).json({ error: 'Invoice already exists for this month' });
    }

    // Calculate previous due
    const previousInvoices = await FeeInvoice.find({
      studentId,
      academicYear: academicYearId,
      month: { $lt: monthDate.format('YYYY-MM') }
    });
    const previousDue = previousInvoices.reduce((sum, inv) => sum + inv.remainingDue, 0);

    // Calculate fees (isExamMonth defaults to false for now)
    const feeDetails = await calculateFees(student, feeStructure, monthDate, previousDue);

    // Create invoice
    const newInvoice = await FeeInvoice.create({
      ...feeDetails,
      schoolId,
      academicYear: academicYearId,
      month: monthDate.format('YYYY-MM'),
      dueDate: moment(monthDate).endOf('month').toDate(),
      status: 'Pending',
      paymentHistory: []
    });

    res.status(201).json({ success: true, data: newInvoice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Bulk invoice generation for a class
exports.generateBulkMonthlyInvoices = async (req, res) => {
  try {
    const { className, month, academicYearId, sections } = req.body;
    const schoolId = req.user.schoolId;

    // Validate academic year
    const academicYear = await AcademicYear.findOne({ _id: academicYearId, schoolId });
    if (!academicYear) {
      return res.status(404).json({ error: 'Academic year not found' });
    }

    // Validate month
    const monthDate = moment(month, 'YYYY-MM');
    if (!monthDate.isValid() || monthDate < academicYear.startDate || monthDate > academicYear.endDate) {
      return res.status(400).json({ error: `Invalid month or not in ${academicYear.name} session` });
    }

    // Get fee structure
    const feeStructure = await FeeStructure.findOne({
      schoolId,
      academicYear: academicYearId,
      className
    });
    if (!feeStructure) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }

    // Get students
    const students = await Student.find({
      schoolId,
      className,
      academicYear: academicYearId,
      section: { $in: sections }
    }).select('_id className usesTransport usesHostel');

    // Prepare bulk operations
    const bulkOps = [];
    for (const student of students) {
      const existingInvoice = await FeeInvoice.findOne({
        studentId: student._id,
        academicYear: academicYearId,
        month: monthDate.format('YYYY-MM')
      });
      if (existingInvoice) continue;

      // Calculate previous due
      const previousInvoices = await FeeInvoice.find({
        studentId: student._id,
        academicYear: academicYearId,
        month: { $lt: monthDate.format('YYYY-MM') }
      });
      const previousDue = previousInvoices.reduce((sum, inv) => sum + inv.remainingDue, 0);

      const feeDetails = await calculateFees(student, feeStructure, monthDate, previousDue);

      bulkOps.push({
        insertOne: {
          document: {
            ...feeDetails,
            schoolId,
            academicYear: academicYearId,
            month: monthDate.format('YYYY-MM'),
            dueDate: moment(monthDate).endOf('month').toDate(),
            status: 'Pending',
            paymentHistory: []
          }
        }
      });
    }

    // Execute bulk operation
    if (bulkOps.length === 0) {
      return res.status(200).json({ success: true, message: 'No new invoices to generate' });
    }

    const result = await FeeInvoice.bulkWrite(bulkOps, { ordered: false });

    res.json({
      success: true,
      created: result.insertedCount,
      message: `${result.insertedCount} invoices generated`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.processPayment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { invoiceId } = req.params;
    console.log(req.body)
    const { amount, paymentMethod, date, chequeNumber, transactionId } = req.body;
    const { schoolId, role, id: userId } = req.user;

    // Validate invoice
    console.log(invoiceId);
    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId }).session(session);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Role-based payment restrictions
    if (role === 'Parent' && ['Cash', 'Cheque'].includes(paymentMethod)) {
      throw new Error('Parents can only process online payments');
    }
    if (role === 'Student') {
      throw new Error('Students are not authorized to process payments');
    }

    // Validate payment amount
    if (typeof amount !== 'number' || amount <= 0 || amount > invoice.remainingDue) {
      throw new Error(`Invalid amount. Remaining due: ₹${invoice.remainingDue}`);
    }
    console.log(paymentMethod)
    // Validate payment method
    if (!['Cash', 'Cheque', 'Online'].includes(paymentMethod)) {
      throw new Error('Invalid payment method');
    }
    if (paymentMethod === 'Cheque' && (!chequeNumber || typeof chequeNumber !== 'string')) {
      throw new Error('Cheque number is required');
    }
    if (paymentMethod === 'Online' && (!transactionId || typeof transactionId !== 'string')) {
      throw new Error('Transaction ID is required for online payments');
    }

    // For parents, verify they own the student
    if (role === 'Parent') {
      const student = await Student.findOne({ _id: invoice.studentId, parentId: userId });
      if (!student) {
        throw new Error('Unauthorized: You can only pay for your child’s invoices');
      }
    }

    // Update invoice
    invoice.paymentHistory.push({
      date: date || new Date(),
      amount,
      method: paymentMethod,
      processedBy: userId,
      ...(paymentMethod === 'Cheque' && { chequeNumber }),
      ...(paymentMethod === 'Online' && { transactionId })
    });

    invoice.paidAmount += amount;
    invoice.remainingDue = invoice.totalAmount - invoice.paidAmount;
    invoice.status = invoice.remainingDue > 0 ? 'Partial' : 'Paid';

    // Update student records
    await Student.findByIdAndUpdate(
      invoice.studentId,
      { $inc: { totalPaid: amount, totalDue: -amount } },
      { session }
    );

    await invoice.save({ session });
    await session.commitTransaction();

    // Generate receipt
    const receiptPath = await generatePaymentReceipt(invoice, amount, paymentMethod);

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: invoice,
      receipt: receiptPath
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(err.message.includes('Unauthorized') ? 403 : 400).json({ error: err.message });
  } finally {
    session.endSession();
  }
};

// Generate payment receipt PDF
const generatePaymentReceipt = async (invoice, amount, paymentMethod) => {
  const doc = new PDFDocument();
  const filePath = `./temp/receipt_${invoice._id}_${Date.now()}.pdf`;
  
  if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp');
  }

  doc.pipe(fs.createWriteStream(filePath));

  const school = await School.findById(invoice.schoolId);
  const student = await Student.findById(invoice.studentId);

  // Header
  doc.fontSize(18).text(school.name, { align: 'center' });
  doc.fontSize(12).text(school.address, { align: 'center' });
  doc.moveDown();

  // Receipt Details
  doc.fontSize(14).text('Payment Receipt', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Receipt Date: ${moment().format('DD/MM/YYYY')}`);
  doc.text(`Student Name: ${student.name}`);
  doc.text(`Admission No: ${student.admissionNo}`);
  doc.text(`Class: ${student.className}`);
  doc.text(`Month: ${invoice.month}`);
  doc.text(`Amount Paid: ₹${amount}`);
  doc.text(`Payment Method: ${paymentMethod}`);
  doc.text(`Remaining Due: ₹${invoice.remainingDue}`);

  doc.end();
  return filePath;
};

// Get student fee summary
exports.getStudentFeeSummary = async (req, res) => {
  try {
    const { studentId } = req.params;
    const schoolId = req.user.schoolId;

    const [student, invoices] = await Promise.all([
      Student.findOne({ _id: studentId, schoolId }),
      FeeInvoice.find({ studentId, schoolId })
        .sort('month')
        .populate('academicYear', 'name')
    ]);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({
      success: true,
      data: {
        student: {
          name: student.name,
          admissionNo: student.admissionNo,
          className: student.className
        },
        totalPaid: student.totalPaid || 0,
        totalDue: student.totalDue || 0,
        invoices: invoices.map(invoice => ({
          month: invoice.month,
          totalAmount: invoice.totalAmount,
          paidAmount: invoice.paidAmount,
          remainingDue: invoice.remainingDue,
          status: invoice.status,
          academicYear: invoice.academicYear.name
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({
      success: true,
      data: {
        invoiceDate: invoice.createdAt,
        dueDate: invoice.dueDate,
        status: invoice.status,
        student: invoice.studentId,
        academicYear: invoice.academicYear.name,
        school: invoice.schoolId,
        breakdown: invoice.invoiceDetails,
        previousDue: invoice.previousDue,
        lateFee: invoice.lateFee,
        discountsApplied: invoice.discountsApplied,
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
    res.status(500).json({ error: err.message });
  }
};

// Generate invoice PDF
exports.generateInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const invoice = await FeeInvoice.findOne({ _id: id, schoolId })
      .populate('studentId', 'name admissionNo className')
      .populate('academicYear', 'name')
      .populate('schoolId', 'name address');

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const doc = new PDFDocument();
    const filePath = `./temp/invoice_${id}.pdf`;
    
    if (!fs.existsSync('./temp')) {
      fs.mkdirSync('./temp');
    }

    doc.pipe(fs.createWriteStream(filePath));

    // Header
    doc.fontSize(18).text(invoice.schoolId.name, { align: 'center' });
    doc.fontSize(12).text(invoice.schoolId.address, { align: 'center' });
    doc.moveDown();

    // Invoice Details
    doc.fontSize(14).text('Fee Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice Date: ${moment(invoice.createdAt).format('DD/MM/YYYY')}`);
    doc.text(`Due Date: ${moment(invoice.dueDate).format('DD/MM/YYYY')}`);
    doc.text(`Student Name: ${invoice.studentId.name}`);
    doc.text(`Admission No: ${invoice.studentId.admissionNo}`);
    doc.text(`Class: ${invoice.studentId.className}`);
    doc.text(`Month: ${invoice.month}`);
    doc.text(`Academic Year: ${invoice.academicYear.name}`);

    // Fee Breakdown Table
    doc.moveDown();
    const feeTable = {
      headers: ['Description', 'Amount (₹)'],
      rows: [
        ['Base Fee', invoice.baseAmount],
        ['Tuition Fee', invoice.invoiceDetails.tuitionFee],
        ['Exam Fee', invoice.invoiceDetails.examFee],
        ['Transport Fee', invoice.invoiceDetails.transportFee],
        ['Hostel Fee', invoice.invoiceDetails.hostelFee],
        ['Miscellaneous Fee', invoice.invoiceDetails.miscFee],
        ['Lab Fee', invoice.invoiceDetails.labFee],
        ['Previous Due', invoice.previousDue],
        ['Late Fee', invoice.lateFee]
      ]
    };

    if (invoice.discountsApplied.length > 0) {
      invoice.discountsApplied.forEach(discount => {
        feeTable.rows.push([discount.name, `-${discount.amount}`]);
      });
    }

    feeTable.rows.push(['Total', invoice.totalAmount]);

    doc.table(feeTable, {
      prepareHeader: () => doc.font('Helvetica-Bold'),
      padding: 5
    });

    // Payment Status
    doc.moveDown();
    doc.text(`Paid Amount: ₹${invoice.paidAmount}`);
    doc.text(`Remaining Due: ₹${invoice.remainingDue}`);
    doc.text(`Status: ${invoice.status}`);

    doc.end();

    res.download(filePath, `invoice_${invoice.studentId.admissionNo}_${invoice.month}.pdf`, () => {
      fs.unlinkSync(filePath);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fee collection report
exports.getFeeCollectionReport = async (req, res) => {
  try {
    const { academicYearId, month, className } = req.query;
    const schoolId = req.user.schoolId;

    const filter = { schoolId };
    if (academicYearId) filter.academicYear = academicYearId;
    if (month) filter.month = month;
    if (className) {
      const students = await Student.find({ schoolId, className }).select('_id');
      filter.studentId = { $in: students.map(s => s._id) };
    }

    const invoices = await FeeInvoice.find(filter)
      .populate('studentId', 'name admissionNo className')
      .populate('academicYear', 'name');

    const summary = {
      totalInvoices: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      totalPaid: invoices.reduce((sum, inv) => sum + inv.paidAmount, 0),
      totalDue: invoices.reduce((sum, inv) => sum + inv.remainingDue, 0),
      invoices: invoices.map(invoice => ({
        student: invoice.studentId,
        month: invoice.month,
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        remainingDue: invoice.remainingDue,
        status: invoice.status,
        academicYear: invoice.academicYear.name
      }))
    };

    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get defaulters list
exports.getDefaultersList = async (req, res) => {
  try {
    const { academicYearId, className } = req.query;
    const schoolId = req.user.schoolId;

    const filter = { schoolId, status: 'Overdue' };
    if (academicYearId) filter.academicYear = academicYearId;
    if (className) {
      const students = await Student.find({ schoolId, className }).select('_id');
      filter.studentId = { $in: students.map(s => s._id) };
    }

    const invoices = await FeeInvoice.find(filter)
      .populate('studentId', 'name admissionNo className')
      .populate('academicYear', 'name');

    res.json({
      success: true,
      data: invoices.map(invoice => ({
        student: invoice.studentId,
        month: invoice.month,
        totalAmount: invoice.totalAmount,
        paidAmount: invoice.paidAmount,
        remainingDue: invoice.remainingDue,
        dueDate: invoice.dueDate,
        academicYear: invoice.academicYear.name
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.generateClassReceipts = async (req, res) => {
  try {
    const { schoolId, className, month, academicYearId } = req.body;

    // Validate required fields
    if (!schoolId || !className || !month || !academicYearId) {
      return res.status(400).json({ error: 'Missing required fields: schoolId, className, month, and academicYearId are required.' });
    }

    // Find students for the given class and academic year
    const students = await Student.find({
      schoolId,
      className,
      academicYear: academicYearId
    });

    if (!students || students.length === 0) {
      return res.status(404).json({ error: 'No students found for this class and academic year.' });
    }

    // Find invoices for the students for the given month
    const studentIds = students.map(student => student._id);
    const invoices = await FeeInvoice.find({
      schoolId,
      studentId: { $in: studentIds },
      month,
      academicYear: academicYearId
    });

    if (!invoices || invoices.length === 0) {
      return res.status(404).json({ error: 'No invoices found for this class and month.' });
    }

    const receipts = [];
    const tempDir = './temp_receipts';

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    for (const student of students) {
      const studentInvoice = invoices.find(inv => inv.studentId.toString() === student._id.toString());
      if (!studentInvoice) continue; // Skip students with no invoice for this month

      const doc = new PDFDocument();
      const filePath = `${tempDir}/${student.admissionNo}_receipt.pdf`;

      doc.pipe(fs.createWriteStream(filePath));

      doc.fontSize(18).text('Rainbow Public School', { align: 'center' });
      doc.fontSize(12).text('Karbala Chowk, Jhalpo, Jhumri Telaiya, Koderma, Jharkhand', { align: 'center' });

      doc.moveDown();
      doc.fontSize(14).text(`Name: ${student.name}`);
      doc.text(`Admission No: ${student.admissionNo}`);
      doc.text(`Class: ${student.className}`);
      doc.text(`Month: ${month}`);

      const feeTable = {
        headers: ['Description', 'Amount (Rs.)'],
        rows: studentInvoice.invoiceDetails ? Object.entries(studentInvoice.invoiceDetails).map(([key, value]) => [
          key.charAt(0).toUpperCase() + key.slice(1),
          value
        ]) : []
      };

      doc.moveDown();
      doc.table(feeTable, {
        prepareHeader: () => doc.font('Helvetica-Bold'),
        padding: 5
      });

      doc.end();
      receipts.push(filePath);
    }

    if (receipts.length === 0) {
      return res.status(404).json({ error: 'No receipts generated. No invoices found for the selected students.' });
    }

    const zip = new AdmZip();
    receipts.forEach(file => zip.addLocalFile(file));
    const zipPath = `${tempDir}/receipts.zip`;
    zip.writeZip(zipPath);

    res.download(zipPath, `class_receipts_${className}_${month}.zip`, () => {
      fs.rmSync(tempDir, { recursive: true });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};