const mongoose = require('mongoose');
const moment = require('moment');
const PDFDocument = require('pdfkit-table');
const fs = require('fs').promises; // Promise-based fs
const AdmZip = require('adm-zip');
const School = require('../../models/school');
const Receipt = require('../../models/receipt');
const FeeInvoice  = require('../../models/feeInvoice');
const Student = require ('../../models/student')
const Payment = require('../../models/payment');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const SchoolInvoice = require('../../models/schoolInvoice');
const Subscription = require('../../models/subscription');
const auditLogs = require('../../models/auditLogs');
const { paymentSchema, orderSchema, sanitizeInput } = require('../../validation/feeValidation');
const SMSService = require('../../utils/smsProvider')
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});


exports.createPaymentOrder = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Validate input
      const { error, value } = orderSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          details: error.details 
        });
      }

      const sanitizedData = {
        schoolId: sanitizeInput(value.schoolId),
        planType: sanitizeInput(value.planType),
        amount: value.amount
      };

      if (req.user.role !== 'superadmin') {
        throw { status: 403, message: 'Access denied: Superadmin only' };
      }

      const order = await razorpay.orders.create({
        amount: sanitizedData.amount * 100, // Convert to paise
        currency: 'INR',
        receipt: `school_${sanitizedData.schoolId}_${Date.now()}`
      });

      const invoice = new SchoolInvoice({
        schoolId: sanitizedData.schoolId,
        paymentId: order.id,
        amount: sanitizedData.amount,
        planType: sanitizedData.planType,
        status: 'pending'
      });
      await invoice.save({ session });

      await new auditLogs({
        userId: req.user.id,
        action: 'create_payment_order',
        details: { schoolId: sanitizedData.schoolId, planType: sanitizedData.planType, amount: sanitizedData.amount, paymentId: order.id }
      }).save({ session });

      res.status(200).json({ message: 'Payment order created', data: { order, invoiceId: invoice._id } });
    });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Error creating payment order' });
  } finally {
    await session.endSession();
  }
};


exports.handleWebhook = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const signature = req.headers['x-razorpay-signature'];
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!secret) {
        console.error('RAZORPAY_WEBHOOK_SECRET not set');
        return res.status(200).json({ message: 'Server configuration error' });
      }

      const bodyPayload = JSON.stringify(req.body);
      const expectedSignature = crypto.createHmac('sha256', secret).update(bodyPayload).digest('hex');

      // Use constant-time comparison to prevent timing attacks
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        console.error('Invalid webhook signature');
        return res.status(200).json({ message: 'Invalid webhook signature' });
      }

      // ... rest of the webhook code remains the same
      const { event, payload: webhookPayload } = req.body;
      if (!webhookPayload?.payment?.entity?.order_id) {
        console.error('Invalid webhook payload: order_id missing');
        return res.status(200).json({ message: 'Invalid webhook payload' });
      }

      if (event === 'payment.captured') {
        const paymentId = webhookPayload.payment.entity.order_id;
        const invoice = await SchoolInvoice.findOneAndUpdate(
          { paymentId, status: 'pending' },
          {
            status: 'completed',
            updatedAt: new Date(),
            paymentDetails: {
              method: 'Online',
              transactionId: webhookPayload.payment.entity.id,
              date: new Date()
            }
          },
          { new: true, session }
        );

        if (!invoice) {
          console.error('Invoice not found for paymentId:', paymentId);
          return res.status(200).json({ message: 'Invoice not found' });
        }

        await Subscription.findOneAndUpdate(
          { schoolId: invoice.schoolId },
          {
            planType: invoice.planType,
            status: 'active',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            updatedAt: new Date()
          },
          { upsert: true, session }
        );

        await new auditLogs({
          userId: null,
          action: 'payment_processed',
          details: { schoolId: invoice.schoolId, paymentId, planType: invoice.planType }
        }).save({ session });
      }

      res.status(200).json({ message: 'Webhook processed' });
    });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).json({ message: 'Error processing webhook: ' + (err.message || 'Unknown error') });
  } finally {
    await session.endSession();
  }
};


exports.generateSchoolInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await SchoolInvoice.findById(id)
      .populate('schoolId', 'name address');

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const doc = new PDFDocument();
    const filePath = `./temp/school_invoice_${id}.pdf`;
    const tempDir = './temp';

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    doc.pipe(fs.createWriteStream(filePath));

    const schoolName = invoice.schoolId?.name || 'Unknown School';
    const schoolAddress = invoice.schoolId?.address
      ? `${invoice.schoolId.address.street || ''}, ${invoice.schoolId.address.city || ''}, ${invoice.schoolId.address.state || ''}, ${invoice.schoolId.address.country || ''}, ${invoice.schoolId.address.postalCode || ''}`
          .replace(/, ,/g, ',').replace(/^,|,$/g, '').trim() || 'No Address'
      : 'No Address';

    doc.fontSize(18).text(schoolName, { align: 'center' });
    doc.fontSize(12).text(schoolAddress, { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).text('School Subscription Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice Date: ${moment(invoice.createdAt).format('DD/MM/YYYY') || 'N/A'}`);
    doc.text(`Plan Type: ${invoice.planType || 'N/A'}`);
    doc.text(`Amount: ₹${invoice.amount || 0}`);
    doc.text(`Status: ${invoice.status || 'N/A'}`);
    if (invoice.paymentDetails) {
      doc.text(`Payment Method: ${invoice.paymentDetails.method || 'N/A'}`);
      doc.text(`Transaction ID: ${invoice.paymentDetails.transactionId || 'N/A'}`);
      doc.text(`Payment Date: ${moment(invoice.paymentDetails.date).format('DD/MM/YYYY') || 'N/A'}`);
    }

    doc.end();

    res.download(filePath, `school_invoice_${schoolName}_${invoice.planType}.pdf`, (err) => {
      if (err) {
        console.error('Download error:', err);
        return res.status(500).json({ error: 'Failed to download invoice PDF' });
      }
      setTimeout(() => {
        fs.unlink(filePath, (err) => {
          if (err) console.error('Failed to delete temp file:', err);
        });
      }, 1000);
    });
  } catch (err) {
    console.error('Error generating school invoice PDF:', err);
    res.status(500).json({ error: 'Failed to generate invoice PDF: ' + err.message });
  }
};

// Add this to your paymentController.js
exports.getStudentPaymentHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const schoolId = req.user.schoolId;

    // Validate student ID
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Invalid student ID' });
    }

    // Get ALL payments for this student across all invoices
    const payments = await Payment.find({
      studentId: new mongoose.Types.ObjectId(studentId),
      schoolId: new mongoose.Types.ObjectId(schoolId)
    })
    .populate('invoiceId', 'month totalAmount')
    .populate('processedBy', 'name')
    .lean();

    // FIXED: Sort ASC by invoiceMonth (parse to date; fallback to date if no month)
    const sortedPayments = payments
      .map(p => ({
        ...p,
        sortKey: p.invoiceId?.month ? new Date(p.invoiceId.month + '-01') : p.date
      }))
      .sort((a, b) => a.sortKey.getTime() - b.sortKey.getTime());

    // Format the response
    const paymentHistory = sortedPayments.map(payment => ({
      _id: payment._id,
      date: payment.date,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      transactionId: payment.transactionId,
      chequeNumber: payment.chequeNumber,
      processedBy: payment.processedBy?.name || 'Admin',
      invoiceMonth: payment.invoiceId?.month || 'N/A',
      invoiceAmount: payment.invoiceId?.totalAmount || 0,
      receiptNumber: `REC-${moment(payment.date).format('YYYYMMDD')}-${payment._id.toString().slice(-6)}`
    }));

    res.json({
      success: true,
      data: paymentHistory,
      summary: {
        totalPayments: payments.length,
        totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
        paymentMethods: [...new Set(payments.map(p => p.paymentMethod))]
      }
    });

  } catch (err) {
    console.error('getStudentPaymentHistory error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.processPayment = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    // Role check (keep your existing role check)
    const allowedRoles = ['admin', 'accountant'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions. Only admin and accountant can process payments.' 
      });
    }

    // Add validation
    const { error, value } = paymentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details 
      });
    }

    const { studentId } = req.params;
    const sanitizedData = {
      amount: value.amount,
      paymentMethod: sanitizeInput(value.paymentMethod),
      date: value.date,
      chequeNumber: value.chequeNumber ? sanitizeInput(value.chequeNumber) : undefined,
      transactionId: value.transactionId ? sanitizeInput(value.transactionId) : undefined
    };

    // Validate student ID
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'Invalid student ID format' });
    }

    await session.startTransaction();
    const { schoolId, id: userId } = req.user;

    // Add student verification
    const student = await Student.findOne({ 
      _id: studentId, 
      schoolId,
      status: true
    }).session(session);

    if (!student) {
      throw new Error('Student not found or inactive');
    }

    if (typeof sanitizedData.amount !== 'number' || sanitizedData.amount <= 0) {
      throw new Error('Invalid amount: must be a positive number');
    }

    const invoices = await FeeInvoice.find({
      studentId,
      schoolId,
      status: { $in: ['Pending', 'Partial', 'Overdue'] }
    }).sort({ dueDate: 1 }).session(session);

    if (invoices.length === 0) {
      throw new Error('No outstanding invoices found for this student');
    }

    let remainingAmount = sanitizedData.amount;
    const updatedInvoices = [];
    const receipts = [];
    let unappliedOverpay = 0;  // Track overpay after all invoices

    // Apply to outstanding invoices (oldest due first)
    for (const invoice of invoices) {
      if (remainingAmount <= 0) break;

      // FIXED: Cap to actual outstanding (positive) due only
      const outstandingDue = Math.max(0, invoice.remainingDue);
      const amountToApply = Math.min(remainingAmount, outstandingDue);

      if (amountToApply > 0) {
        // Standard payment to this invoice
        const payment = new Payment({
          studentId,
          invoiceId: invoice._id,
          amount: amountToApply,
          date: sanitizedData.date || new Date(),
          paymentMethod: sanitizedData.paymentMethod,
          chequeNumber: sanitizedData.chequeNumber,
          transactionId: sanitizedData.transactionId,
          schoolId,
          processedBy: userId
        });
        await payment.save({ session });

        invoice.paymentHistory.push({
          amount: amountToApply,
          paymentMethod: sanitizedData.paymentMethod,
          date: payment.date,
          transactionId: payment.transactionId,
          chequeNumber: payment.chequeNumber,
          processedBy: userId
        });

        invoice.paidAmount += amountToApply;
        invoice.remainingDue -= amountToApply;  // Now allows negative if prior credit
        invoice.status = invoice.remainingDue <= 0 ? 'Paid' : 'Partial';  // FIXED: <=0 for Paid

        remainingAmount -= amountToApply;
        await invoice.save({ session });
        updatedInvoices.push(invoice);

        // FIXED: Propagate change to future (delta = -amountToApply, but full for negatives)
        let delta = -amountToApply;
        let currentMonthDate = moment.tz(invoice.month + '-01', 'YYYY-MM-DD', 'Asia/Kolkata');
        let nextMonth = currentMonthDate.add(1, 'month').format('YYYY-MM');
        let nextInvoice = await FeeInvoice.findOne({
          studentId: studentId,
          schoolId,
          month: nextMonth
        }).session(session);

        while (nextInvoice) {
          nextInvoice.previousDue += delta;
          nextInvoice.totalAmount += delta;  // Adjust total (previous affects it)
          nextInvoice.remainingDue += delta;
          nextInvoice.status = nextInvoice.remainingDue <= 0 ? 'Paid' : 
                               (nextInvoice.remainingDue < nextInvoice.totalAmount ? 'Partial' : 'Pending');
          await nextInvoice.save({ session });

          currentMonthDate = moment.tz(nextInvoice.month + '-01', 'YYYY-MM-DD', 'Asia/Kolkata');
          nextMonth = currentMonthDate.add(1, 'month').format('YYYY-MM');
          nextInvoice = await FeeInvoice.findOne({
            studentId: studentId,
            schoolId,
            month: nextMonth
          }).session(session);
        }

        const receipt = await generateReceipt(payment);
        receipts.push(receipt);
      }
    }

    // FIXED: Handle unapplied overpay (remainingAmount > 0)
    if (remainingAmount > 0) {
      unappliedOverpay = remainingAmount;
      // Log as overpay credit payment (no invoice)
      const overpayPayment = new Payment({
        studentId,
        invoiceId: null,
        amount: remainingAmount,
        date: sanitizedData.date || new Date(),
        paymentMethod: `${sanitizedData.paymentMethod} (Overpay Credit)`,
        schoolId,
        processedBy: userId
      });
      await overpayPayment.save({ session });

      // Propagate to first future invoice or student totalDue
      const nextMonth = moment().add(1, 'month').format('YYYY-MM');
      let nextInvoice = await FeeInvoice.findOne({
        studentId,
        schoolId,
        month: nextMonth,
        status: { $ne: 'Paid' }  // Only non-fully paid future
      }).session(session);

      if (nextInvoice) {
        // Apply credit to future invoice
        const delta = -remainingAmount;
        nextInvoice.previousDue += delta;
        nextInvoice.totalAmount += delta;
        nextInvoice.remainingDue += delta;
        nextInvoice.status = nextInvoice.remainingDue <= 0 ? 'Paid' : 'Partial';
        await nextInvoice.save({ session });
        // Re-propagate from this nextInvoice to further future
        let furtherDelta = delta;
        let furtherMonth = moment.tz(nextMonth + '-01', 'YYYY-MM-DD', 'Asia/Kolkata').add(1, 'month').format('YYYY-MM');
        let furtherInvoice = await FeeInvoice.findOne({
          studentId,
          schoolId,
          month: furtherMonth
        }).session(session);
        while (furtherInvoice) {
          furtherInvoice.previousDue += furtherDelta;
          furtherInvoice.totalAmount += furtherDelta;
          furtherInvoice.remainingDue += furtherDelta;
          furtherInvoice.status = furtherInvoice.remainingDue <= 0 ? 'Paid' : 
                                   (furtherInvoice.remainingDue < furtherInvoice.totalAmount ? 'Partial' : 'Pending');
          await furtherInvoice.save({ session });
          furtherMonth = moment.tz(furtherInvoice.month + '-01', 'YYYY-MM-DD', 'Asia/Kolkata').add(1, 'month').format('YYYY-MM');
          furtherInvoice = await FeeInvoice.findOne({
            studentId,
            schoolId,
            month: furtherMonth
          }).session(session);
        }
      } else {
        // No future: Credit to student overall (add `totalCredit` field to Student schema if needed)
        await Student.findByIdAndUpdate(
          studentId,
          { $inc: { totalDue: -remainingAmount } },  // Reduce overall due
          { session }
        );
      }
    }

    const totalPaid = sanitizedData.amount - unappliedOverpay;
    await Student.findByIdAndUpdate(
      studentId,
      { $inc: { totalPaid: totalPaid, totalDue: -totalPaid } },
      { session }
    );

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Payment processed across invoices',
      data: { 
        invoices: updatedInvoices, 
        receipts, 
        overpayCredit: unappliedOverpay 
      }
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Payment processing error:', err);
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
};

exports.generateAdvanceInvoices = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { studentId, monthsAhead } = req.body;
    const { schoolId, classId, academicYearId } = await Student.findById(studentId).select('schoolId classId academicYear');

    if (!studentId || !monthsAhead || monthsAhead < 1) {
      throw new Error('studentId and monthsAhead are required, and monthsAhead must be positive');
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonthIndex = new Date().getMonth();
    const invoices = [];

    for (let i = 1; i <= monthsAhead; i++) {
      const futureMonthIndex = (currentMonthIndex + i) % 12;
      const futureMonth = monthNames[futureMonthIndex];
      const futureYear = new Date().getFullYear() + Math.floor((currentMonthIndex + i) / 12);
      const formattedMonth = `${futureYear}-${String(futureMonthIndex + 1).padStart(2, '0')}`;

      const existingInvoice = await FeeInvoice.findOne({
        studentId,
        month: formattedMonth,
        academicYear: academicYearId,
        schoolId,
      }).session(session);

      if (existingInvoice) continue;

      const className = (await Student.findById(studentId).select('className')).className;
      const invoice = await generateInvoices(schoolId, classId, className, futureMonth, academicYearId, [], false, studentId);
      invoices.push(...invoice);
    }

    await session.commitTransaction();
    res.json({ success: true, data: invoices });
  } catch (err) {
    console.error('Error generating advance invoices:', err);
    await session.abortTransaction();
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
};


exports.generatePaymentReceipt = async (invoice, amount, paymentMethod) => {
  const doc = new PDFDocument();
  const filePath = `./temp/receipt_${invoice._id}_${Date.now()}.pdf`;
  
  if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp');
  }

  doc.pipe(fs.createWriteStream(filePath));

  const school = await School.findById(invoice.schoolId);
  const student = await Student.findById(invoice.studentId);

  doc.fontSize(18).text(school.name, { align: 'center' });
  doc.fontSize(12).text(school.address, { align: 'center' });
  doc.moveDown();

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

exports.getInvoiceDetails = async (req, res) => {
  try {
    const invoice = await feeInvoice.findById(req.params.id)
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
        academicYear: invoice.academicYear.name, // Already included
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

// exports.getFeeCollectionReport = async (req, res) => {
//   try {
//     const { academicYearId, month, className } = req.query;
//     const schoolId = req.user.schoolId;

//     const matchStage = { schoolId };
//     if (academicYearId) matchStage.academicYear = mongoose.Types.ObjectId(academicYearId);
//     if (month) matchStage.month = month;
//     if (className) {
//       const students = await Student.find({ schoolId, className }).select('_id');
//       matchStage.studentId = { $in: students.map(s => s._id) };
//     }

//     const invoices = await feeInvoice.aggregate([
//       { $match: matchStage },
//       {
//         $lookup: {
//           from: 'students',
//           localField: 'studentId',
//           foreignField: '_id',
//           as: 'student',
//         },
//       },
//       { $unwind: '$student' },
//       {
//         $lookup: {
//           from: 'academicyears',
//           localField: 'academicYear',
//           foreignField: '_id',
//           as: 'academicYear',
//         },
//       },
//       { $unwind: '$academicYear' },
//       {
//         $group: {
//           _id: null,
//           totalInvoices: { $sum: 1 },
//           totalAmount: { $sum: '$totalAmount' },
//           totalPaid: { $sum: '$paidAmount' },
//           totalDue: { $sum: '$remainingDue' },
//           invoices: {
//             $push: {
//               student: { name: '$student.name', admissionNo: '$student.admissionNo', className: '$student.className' },
//               month: '$month',
//               totalAmount: '$totalAmount',
//               paidAmount: '$paidAmount',
//               remainingDue: '$remainingDue',
//               status: '$status',
//               academicYear: '$academicYear.name',
//             },
//           },
//         },
//       },
//       { $project: { _id: 0 } },
//     ]);

//     const summary = invoices[0] || {
//       totalInvoices: 0,
//       totalAmount: 0,
//       totalPaid: 0,
//       totalDue: 0,
//       invoices: [],
//     };

//     res.json({ success: true, data: summary });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// POST /api/fee/send-defaulter-sms
exports.sendDefaulterSMS = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const schoolId = new mongoose.Types.ObjectId(req.user.schoolId);
      const { message: customMessage } = req.body;

      // 1. Get active subscription
      const subscription = await Subscription.findOne({
        schoolId,
        status: 'active'
      }).session(session);

      if (!subscription) throw new APIError('No active subscription found', 403);

      // 2. Check SMS limit
      const smsUsed = subscription.usageStats.smsUsedThisMonth || 0;
      const smsLimit = subscription.messageLimits.smsMonthly || 0;
      const smsRemaining = smsLimit - smsUsed;

      if (smsRemaining <= 0) {
        return res.status(403).json({
          success: false,
          message: 'SMS limit exceeded for this month',
          used: smsUsed,
          limit: smsLimit,
          remaining: 0
        });
      }

      // 3. GET ONE ROW PER STUDENT → CORRECT TOTAL DUE
      const defaulters = await FeeInvoice.aggregate([
        { $match: { schoolId, remainingDue: { $gt: 0 } } },

        // Sort by latest month first
        { $sort: { dueDate: -1 } },

        // Keep only latest invoice per student
        {
          $group: {
            _id: '$studentId',
            latestRemainingDue: { $first: '$remainingDue' },
            latestMonth: { $first: '$month' },
            doc: { $first: '$$ROOT' }
          }
        },

        // Lookup student
        {
          $lookup: {
            from: 'students',
            localField: '_id',
            foreignField: '_id',
            as: 'student'
          }
        },
        { $unwind: '$student' },

        // Must have at least one parent phone
        {
          $match: {
            $or: [
              { 'student.parents.fatherPhone': { $ne: null, $ne: '' } },
              { 'student.parents.motherPhone': { $ne: null, $ne: '' } }
            ]
          }
        },

        // Final fields
        {
          $project: {
            studentName: '$student.name',
            admissionNo: '$student.admissionNo',
            remainingDue: '$latestRemainingDue', // This is correct: 3400 only
            parentPhone: {
              $cond: [
                { $ne: ['$student.parents.fatherPhone', ''] },
                '$student.parents.fatherPhone',
                '$student.parents.motherPhone'
              ]
            }
          }
        },

        { $sort: { remainingDue: -1 } }
      ]).session(session);


      if (defaulters.length === 0) {
        return res.json({ success: true, sent: 0, message: 'No defaulters with valid phone' });
      }

      // 4. Send SMS — only 1 per student!
      const toSend = defaulters.slice(0, smsRemaining);
      const school = await School.findById(schoolId).session(session);
      const senderId = school.communication?.smsSenderName || 'EDGLOBE';
      let sent = 0;
      const failed = [];
      for (const defaulter of toSend) {
      try {
        const schoolName = school.name || 'Your School';
        const senderName = school.communication?.smsSenderName || 'EDGLOBE';

        // This format is REQUIRED for template
        const templateMessage = `${defaulter.studentName}|${defaulter.remainingDue}|${schoolName}`;

        await SMSService.sendSMS(defaulter.parentPhone, templateMessage, senderName);
        sent++;
      } catch (error) {
        failed.push({
          name: defaulter.studentName,
          phone: defaulter.parentPhone,
          error: error.message || 'SMS failed'
        });
      }
    }

      // 5. Update usage
      subscription.usageStats.smsUsedThisMonth += sent;
      await subscription.save({ session });

      school.smsRemaining = smsLimit - subscription.usageStats.smsUsedThisMonth;
      await school.save({ session });

      // 6. Response
      res.json({
        success: true,
        message: 'Defaulter SMS sent successfully',
        sent,
        failed: failed.length,
        totalUniqueDefaulters: defaulters.length,
        remainingSMS: school.smsRemaining,
        failedDetails: failed
      });
    });
  } catch (error) {
    console.error('Send SMS Error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to send SMS'
    });
  } finally {
    session.endSession();
  }
};

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

// exports.generateClassReceipts = async (req, res) => {
//   try {
//     const { schoolId, className, month, academicYearId } = req.body;

//     if (!schoolId || !className || !month || !academicYearId) {
//       return res.status(400).json({ error: 'Missing required fields: schoolId, className, month, and academicYearId are required.' });
//     }

//     const school = await School.findById(schoolId);
//     if (!school) {
//       return res.status(404).json({ error: 'School not found' });
//     }

//     const students = await Student.find({
//       schoolId,
//       className,
//       academicYear: academicYearId
//     });

//     if (!students || students.length === 0) {
//       return res.status(404).json({ error: 'No students found for this class and academic year.' });
//     }

//     const studentIds = students.map(student => student._id);
//     const invoices = await FeeInvoice.find({
//       schoolId,
//       studentId: { $in: studentIds },
//       month,
//       academicYear: academicYearId
//     });

//     if (!invoices || invoices.length === 0) {
//       return res.status(404).json({ error: 'No invoices found for this class and month.' });
//     }

//     const receipts = [];
//     const tempDir = './temp_receipts';

//     if (!fs.existsSync(tempDir)) {
//       fs.mkdirSync(tempDir, { recursive: true });
//     }

//     for (const student of students) {
//       const studentInvoice = invoices.find(inv => inv.studentId.toString() === student._id.toString());
//       if (!studentInvoice) continue;

//       const doc = new PDFDocument();
//       const filePath = `${tempDir}/${student.admissionNo}_receipt.pdf`;

//       doc.pipe(fs.createWriteStream(filePath));

//       const schoolName = school.name || 'Unknown School';
//       const schoolAddress = school.address
//         ? `${school.address.street || ''}, ${school.address.city || ''}, ${school.address.state || ''}, ${school.address.country || ''}, ${school.address.postalCode || ''}`
//             .replace(/, ,/g, ',').replace(/^,|,$/g, '').trim() || 'No Address'
//         : 'No Address';

//       doc.fontSize(18).text(schoolName, { align: 'center' });
//       doc.fontSize(12).text(schoolAddress, { align: 'center' });

//       doc.moveDown();
//       doc.fontSize(14).text(`Name: ${student.name}`);
//       doc.text(`Admission No: ${student.admissionNo}`);
//       doc.text(`Class: ${student.className}`);
//       doc.text(`Month: ${month}`);

//       const feeTable = {
//         headers: ['Description', 'Amount (Rs.)'],
//         rows: studentInvoice.invoiceDetails
//           ? Object.entries(studentInvoice.invoiceDetails)
//               .filter(([_, value]) => value > 0)
//               .map(([key, value]) => [
//                 key.charAt(0).toUpperCase() + key.slice(1),
//                 value
//               ])
//           : []
//       };

//       doc.moveDown();
//       doc.table  (feeTable, {
//         prepareHeader: () => doc.font('Helvetica-Bold'),
//         padding: 5
//       });

//       doc.end();
//       receipts.push(filePath);
//     }

//     if (receipts.length === 0) {
//       return res.status(404).json({ error: 'No receipts generated. No invoices found for the selected students.' });
//     }

//     const zip = new AdmZip();
//     receipts.forEach(file => zip.addLocalFile(file));
//     const zipPath = `${tempDir}/receipts.zip`;
//     zip.writeZip(zipPath);

//     res.download(zipPath, `class_receipts_${className}_${month}.zip`, () => {
//       fs.rmSync(tempDir, { recursive: true });
//     });
//   } catch (err) {
//     console.error('Error generating class receipts:', err);
//     res.status(500).json({ error: err.message });
//   }
// };

exports.getFeeCollectionReport = async (req, res) => {
  try {
    const { academicYearId, month, className, classId } = req.query;  // Add classId
    const schoolId = req.user.schoolId;

    const matchStage = { schoolId };
    if (academicYearId) matchStage.academicYear = new mongoose.Types.ObjectId(academicYearId);
    if (month) matchStage.month = month;
    if (className) matchStage.className = className;  // Use invoice's className!
    if (classId) matchStage.classId = new mongoose.Types.ObjectId(classId);

    const invoices = await FeeInvoice.aggregate([  // No need for student filter stage
      { $match: matchStage },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },  // Allow if student inactive
      {
        $lookup: {
          from: 'academicyears',
          localField: 'academicYear',
          foreignField: '_id',
          as: 'academicYear',
        },
      },
      { $unwind: { path: '$academicYear', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$paidAmount' },
          totalDue: { $sum: '$remainingDue' },
          invoices: {
            $push: {
              student: { 
                name: { $ifNull: ['$student.name', 'Unknown'] }, 
                admissionNo: { $ifNull: ['$student.admissionNo', 'N/A'] } 
              },
              className: '$className',  // Historical from invoice
              month: '$month',
              totalAmount: '$totalAmount',
              paidAmount: '$paidAmount',
              remainingDue: '$remainingDue',
              status: '$status',
              academicYear: { $ifNull: ['$academicYear.name', 'N/A'] },
            },
          },
        },
      },
      { $project: { _id: 0 } },
    ]);

    const summary = invoices[0] || {
      totalInvoices: 0, totalAmount: 0, totalPaid: 0, totalDue: 0, invoices: []
    };

    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.generateClassReceipts = async (req, res) => {
  try {
    console.log(req.body)
    const { schoolId, className, month, academicYearId } = req.body;  // Keep as-is

    if (!schoolId || !className || !month || !academicYearId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const school = await School.findById(schoolId);
    if (!school) return res.status(404).json({ error: 'School not found' });

    // NEW: Query invoices by historical className/year (not current students)
    const invoices = await FeeInvoice.find({
      schoolId,
      className,  // Historical!
      month,
      academicYear: new mongoose.Types.ObjectId(academicYearId)
    }).populate('studentId', 'name admissionNo');  // Get current student basics

    if (!invoices || invoices.length === 0) {
      return res.status(404).json({ error: 'No invoices found for this class/month/year' });
    }

    const receipts = [];
    const tempDir = './temp_receipts';
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    for (const invoice of invoices) {  // Loop over invoices, not students
      const student = invoice.studentId;  // Populated
      if (!student) continue;

      const doc = new PDFDocument();
      const filePath = `${tempDir}/${student.admissionNo}_receipt.pdf`;

      doc.pipe(fs.createWriteStream(filePath));

      // ... (keep your school header code)

      doc.fontSize(14).text(`Name: ${student.name}`);
      doc.text(`Admission No: ${student.admissionNo}`);
      doc.text(`Class: ${invoice.className}`);  // Use invoice's historical class!
      doc.text(`Month: ${month}`);

      // ... (keep feeTable code, using invoice.invoiceDetails)

      doc.end();
      receipts.push(filePath);
    }

    if (receipts.length === 0) {
      return res.status(404).json({ error: 'No receipts generated' });
    }

    // ... (keep zip/download code)
  } catch (err) {
    console.error('Error generating class receipts:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getFeeCollectionDetailsReport = async (req, res) => {
  try {
    const { startDate, endDate, classId, section, method } = req.query;
    const schoolId = req.user.schoolId;

    // Validate and convert classId to ObjectId
    let classIdObj = null;
    if (classId) {
      try {
        classIdObj = new mongoose.Types.ObjectId(classId);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: 'Invalid class ID format'
        });
      }
    }

    // Create date range filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    const aggregation = [
      // Stage 1: Match by school
      { 
        $match: { 
          schoolId: new mongoose.Types.ObjectId(schoolId) 
        } 
      },
      
      // Stage 2: Lookup student information
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: '$student' },
      
      // Stage 3: Apply class/section filter
      {
        $match: {
          ...(classIdObj ? { 'student.classId': classIdObj } : {}),
          ...(section ? { 'student.section': section } : {})
        }
      },
      
      // Stage 4: Unwind payment history
      { $unwind: '$paymentHistory' },
      
      // Stage 5: Apply method filter
      ...(method ? [{
        $match: { 'paymentHistory.paymentMethod': method }
      }] : []),
      
      // Stage 6: Apply date filter
      ...(Object.keys(dateFilter).length > 0 ? [{
        $match: { 'paymentHistory.date': dateFilter }
      }] : []),
      
      // Stage 7: Project relevant fields
      {
        $project: {
          date: '$paymentHistory.date',
          amount: '$paymentHistory.amount',
          method: '$paymentHistory.paymentMethod',
          chequeNumber: '$paymentHistory.chequeNumber',
          transactionId: '$paymentHistory.transactionId',
          processedBy: '$paymentHistory.processedBy',
          student: {
            name: '$student.name',
            admissionNo: '$student.admissionNo',
            classId: '$student.classId',
            className: '$student.className',
            section: '$student.section'
          },
          invoiceMonth: '$month'
        }
      },
      
      // Stage 8: Sort by date
      { $sort: { date: -1 } }
    ];

    const transactions = await feeInvoice.aggregate(aggregation);
    
    // Calculate summary
    const summary = {
      total: 0,
      cashTotal: 0,
      chequeTotal: 0,
      onlineTotal: 0,
      transactionCount: transactions.length
    };
    
    transactions.forEach(t => {
      const amount = t.amount;
      summary.total += amount;
      if (t.method === 'Cash') summary.cashTotal += amount;
      else if (t.method === 'Cheque') summary.chequeTotal += amount;
      else if (t.method === 'Online') summary.onlineTotal += amount;
    });

    res.json({ 
      success: true, 
      data: {
        summary,
        transactions
      }
    });

  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to generate report',
      error: err.message 
    });
  }
};

const generateReceipt = async (payment) => {
  const receipt = new Receipt({
    paymentId: payment._id,
    studentId: payment.studentId,
    invoiceId: payment.invoiceId,
    amount: payment.amount,
    date: payment.date,
    paymentMethod: payment.paymentMethod,
    schoolId: payment.schoolId,
    receiptNumber: `REC-${Date.now()}-${payment._id.toString().slice(-6)}`, // Example receipt number generation
    processedBy: payment.processedBy,
    generatedBy: payment.processedBy // Add this line to satisfy the required field
  });
  await receipt.save();
  return receipt;
};

exports.generateReceiptPDF = async (req, res) => {
  try {
    const { receiptId } = req.params;
    const receipt = await Receipt.findById(receiptId)
      .populate('paymentId')
      .populate('studentId', 'name admissionNo className')
      .populate('invoiceId')
      .populate('schoolId', 'name address');
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    console.log('Populated studentId:', receipt.studentId); // Check the populated student data

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt_${receipt.receiptNumber}.pdf`);
    doc.pipe(res);

    const schoolName = receipt.schoolId?.name || 'Unknown School';
    const schoolAddress = receipt.schoolId?.address
      ? `${receipt.schoolId.address.street || ''}, ${receipt.schoolId.address.city || ''}, ${receipt.schoolId.address.state || ''}, ${receipt.schoolId.address.country || ''}, ${receipt.schoolId.address.postalCode || ''}`
          .replace(/, ,/g, ',')
          .replace(/^,|,$/g, '')
          .trim() || 'No Address'
      : 'No Address';

    doc.fontSize(18).text(schoolName, { align: 'center' });
    doc.fontSize(12).text(schoolAddress, { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).text('Payment Receipt', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Receipt Number: ${receipt.receiptNumber || 'N/A'}`);
    doc.text(`Date: ${moment(receipt.date).format('DD/MM/YYYY') || 'N/A'}`);
    doc.text(`Student Name: ${receipt.studentId?.name || 'Unknown Student'}`);
    doc.text(`Admission No: ${receipt.studentId?.admissionNo || 'N/A'}`);
    doc.text(`Class: ${receipt.studentId?.className || 'N/A'}`);
    doc.text(`Invoice Month: ${receipt.invoiceId?.month || 'N/A'}`);
    doc.text(`Amount Paid: ₹${receipt.amount || 0}`);
    doc.text(`Payment Method: ${receipt.paymentMethod || 'N/A'}`);

    doc.end();
  } catch (err) {
    console.error('Error generating receipt PDF:', err);
    res.status(500).json({ error: 'Failed to generate receipt PDF: ' + err.message });
  }
};

const pdf = require('html-pdf');
const Handlebars = require('handlebars');
const path = require('path'); // Import the path module
const feeInvoice = require('../../models/feeInvoice');
const feeStructure = require('../../models/feeStructure');

exports.generateInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;

    const invoice = await feeInvoice.findOne({ _id: id, schoolId })
      .populate({
        path: 'studentId',
        select: 'name admissionNo classId',
        populate: {
          path: 'classId',
          model: 'Class',
          select: 'name'
        }
      })
      .populate('academicYear', 'name')
      .populate('schoolId', 'name address');

    if (!invoice) {
      console.log(`Invoice not found for ID: ${id}, School ID: ${schoolId}`);
      return res.status(404).json({ error: 'Invoice not found' });
    }

    console.log('Invoice:', JSON.stringify(invoice, null, 2));
    console.log('Student with Class:', JSON.stringify(invoice.studentId, null, 2));

    // Compile the HTML template
    const templateHtml = await fs.readFile(path.join(__dirname, './invoice-template.html'), { encoding: 'utf-8' }); // Corrected syntax
    const template = Handlebars.compile(templateHtml);

    // Prepare data for the template
    const schoolAddress = invoice.schoolId?.address
      ? [
          invoice.schoolId.address.street,
          invoice.schoolId.address.city,
          invoice.schoolId.address.state,
          invoice.schoolId.address.country,
          invoice.schoolId.address.postalCode
        ]
          .filter(part => part) // Remove empty parts
          .join(', ')
          .trim() || 'No Address'
      : 'No Address';

    const feeRows = [];
    for (const detail of invoice.invoiceDetails || []) {
      if (detail.amount > 0) {
        feeRows.push({ description: detail.name.charAt(0).toUpperCase() + detail.name.slice(1), amount: detail.amount });
      }
    }
    feeRows.push({ description: 'Previous Due', amount: invoice.previousDue || 0 });
    feeRows.push({ description: 'Late Fee', amount: invoice.lateFee || 0 });
    if (invoice.discountsApplied && invoice.discountsApplied.length > 0) {
      invoice.discountsApplied.forEach(discount => {
        feeRows.push({ description: discount.name || 'Discount', amount: `-${discount.amount || 0}` });
      });
    }
    feeRows.push({ description: 'Total', amount: invoice.totalAmount || 0 });

    const data = {
      schoolName: invoice.schoolId?.name || 'Unknown School',
      schoolAddress,
      invoiceDate: moment(invoice.createdAt).format('DD/MM/YYYY') || 'N/A',
      dueDate: moment(invoice.dueDate).format('DD/MM/YYYY') || 'N/A',
      studentName: invoice.studentId?.name || 'Unknown Student',
      admissionNo: invoice.studentId?.admissionNo || 'N/A',
      className: invoice.studentId?.classId?.name || 'N/A',
      month: invoice.month || 'N/A',
      academicYear: invoice.academicYear?.name || 'N/A',
      feeRows,
      paidAmount: invoice.paidAmount || 0,
      remainingDue: invoice.remainingDue || 0,
      status: invoice.status || 'N/A'
    };

    // Render the template with data
    const html = template(data);

    // Configure PDF options
    const options = {
      format: 'A4',
      border: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
    base: 'file:///E:/school Management Project/', // Absolute path to the image directory
    phantomPath: require('phantomjs-prebuilt').path,
    timeout: 30000 // Increase timeout for image loading
    };

    // Generate PDF
    const filePath = path.join(__dirname, `./temp/invoice_${id}.pdf`);
    pdf.create(html, options).toFile(filePath, async (err, result) => {
      if (err) {
        console.error('PDF creation error:', err);
        return res.status(500).json({ error: 'Failed to generate invoice PDF', details: err.message });
      }

      res.download(filePath, `invoice_${invoice.studentId?.admissionNo || 'unknown'}_${invoice.month || 'unknown'}.pdf`, async (err) => {
        if (err) {
          console.error('Download error:', err);
          return res.status(500).json({ error: 'Failed to download invoice PDF', details: err.message });
        }
        try {
          await fs.unlink(filePath);
          console.log('Temp file deleted:', filePath);
        } catch (unlinkErr) {
          console.error('Failed to delete temp file:', unlinkErr);
        }
      });
    });
  } catch (err) {
    console.error('Error generating invoice PDF:', err);
    res.status(500).json({ error: 'Failed to generate invoice PDF: ' + err.message });
  }
};

// new methid
exports.applyLateFees = async () => {
  const overdueInvoices = await FeeInvoice.find({ status: 'Pending', dueDate: { $lt: new Date() } });
  for (const invoice of overdueInvoices) {
    const feeStructure = await feeStructure.findOne({ schoolId: invoice.schoolId, classId: invoice.studentId.classId });
    if (feeStructure.lateFeeConfig.isEnabled) {
      const daysLate = Math.floor((new Date() - invoice.dueDate) / (1000 * 60 * 60 * 24));
      if (daysLate > feeStructure.lateFeeConfig.gracePeriodDays) {
        let lateFee = 0;
        if (feeStructure.lateFeeConfig.calculationType === 'daily') {
          lateFee = Math.min(daysLate * feeStructure.lateFeeConfig.dailyRate, feeStructure.lateFeeConfig.maxLateFee);
        } else if (feeStructure.lateFeeConfig.calculationType === 'fixed') {
          lateFee = feeStructure.lateFeeConfig.fixedAmount;
        } else if (feeStructure.lateFeeConfig.calculationType === 'percentage') {
          lateFee = Math.min((feeStructure.lateFeeConfig.percentageRate / 100) * invoice.totalAmount, feeStructure.lateFeeConfig.maxLateFee);
        }
        invoice.lateFee = lateFee;
        invoice.totalAmount += lateFee;
        invoice.remainingDue += lateFee;
        invoice.status = 'Overdue';
        await invoice.save();
      }
    }
  }
};


exports.processRefund = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { invoiceId, amount, reason } = req.body;
    const invoice = await feeInvoice.findById(invoiceId).session(session);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (amount > invoice.paidAmount) {
      throw new Error('Refund amount exceeds paid amount');
    }
    invoice.paidAmount -= amount;
    invoice.remainingDue += amount;
    invoice.status = invoice.remainingDue > 0 ? 'Partial' : 'Pending';
    invoice.paymentHistory.push({
      amount: -amount,
      paymentMethod: 'Refund',
      date: new Date(),
      reason,
      processedBy: req.user.id
    });
    await invoice.save({ session });
    await Student.findByIdAndUpdate(
      invoice.studentId,
      { $inc: { totalPaid: -amount, totalDue: amount } },
      { session }
    );
    await session.commitTransaction();
    res.json({ success: true, message: 'Refund processed', data: invoice });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ error: err.message });
  } finally {
    session.endSession();
  }
};




exports.searchInvoiceStudents = async (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    const { schoolId, limit = 50 } = req.query;

    // Validate schoolId
    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json({ message: 'Valid schoolId required' });
    }
    if (!q || q.length < 2) {
      return res.json({ students: [] });
    }

    // Search in Invoice with populated student
    const invoices = await feeInvoice.find({
      schoolId: new mongoose.Types.ObjectId(schoolId),
    })
      .populate({
        path: 'studentId',
        match: {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { admissionNo: { $regex: q, $options: 'i' } }
          ]
        },
        select: 'name admissionNo _id'
      })
      .select('studentId')
      .limit(Math.min(+limit * 3, 300)) // Get more to deduplicate
      .lean();

    // Extract and deduplicate students
    const studentMap = new Map();
    invoices.forEach(inv => {
      if (inv.studentId) {
        const id = inv.studentId._id.toString();
        if (!studentMap.has(id)) {
          studentMap.set(id, {
            _id: inv.studentId._id,
            name: inv.studentId.name,
            admissionNo: inv.studentId.admissionNo
          });
        }
      }
    });

    const students = Array.from(studentMap.values()).slice(0, +limit);

    res.json({ students });
  } catch (err) {
    console.error('Invoice student search error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


// NEW: Get all invoices for a specific student (for parent/admin student view)
exports.getStudentInvoices = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { academicYearId } = req.query;
    const schoolId = req.user.schoolId;

    // Validate student ID
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Invalid student ID' });
    }

    // Verify student exists and is active
    const student = await Student.findOne({ _id: studentId, schoolId, status: true });
    if (!student) {
      return res.status(404).json({ message: 'Student not found or inactive' });
    }

    // Build match query
    const match = { studentId, schoolId };
    if (academicYearId) {
      if (!mongoose.Types.ObjectId.isValid(academicYearId)) {
        return res.status(400).json({ message: 'Invalid academicYearId' });
      }
      match.academicYear = academicYearId;
    }

    // Fetch invoices with required fields
    const invoices = await feeInvoice.find(match)
      .populate('academicYear', 'name')
      .populate('paymentHistory.processedBy', 'name')
      .sort({ month: 1 })  // ASC by month for proper carry-forward
      .lean();

    if (!invoices.length) {
      return res.json({ ledgers: [] });
    }

    // Group by academic year
    const grouped = {};
    invoices.forEach(inv => {
      const yearId = inv.academicYear?._id?.toString() || 'unknown';
      const yearName = inv.academicYear?.name || 'Unknown Year';
      if (!grouped[yearId]) {
        grouped[yearId] = { yearId, yearName, invoices: [] };
      }
      grouped[yearId].invoices.push(inv);
    });

    // Process each academic year independently
    const ledgers = Object.values(grouped).map(group => {
      let runningDue = 0;  // Starts at 0; allows negative for credits
      const ledger = group.invoices.map(inv => {
        const previousDue = runningDue;  // Can be negative (credit)
        const currentFee = inv.baseAmount || 0;  // Base monthly fee (e.g., ₹650)
        // FIXED: Full totalDues calc including late/discounts
        const lateFee = inv.lateFee || 0;
        const discounts = inv.discountsApplied?.reduce((sum, d) => sum + (d.amount || 0), 0) || 0;
        const totalDues = previousDue + currentFee + lateFee - discounts;
        const paid = inv.paidAmount || 0;
        const remaining = totalDues - paid;  // Allows negative

        // FIXED: Full carry (negative = credit to next)
        runningDue = remaining;

        // FIXED: Inline overdue/status logic
        const now = new Date();  // Or test: new Date('2025-11-14')
        const status = remaining <= 0 ? 'Paid' :
                       (remaining < totalDues ? 'Partial' :
                        (now > inv.dueDate ? 'Overdue' : 'Pending'));

        return {
          _id: inv._id,
          month: inv.month,
          previousDue,  // Display negative as credit (e.g., -₹350)
          currentFee,
          totalDues,
          paidAmount: paid,
          remainingDue: remaining,  // Display negative
          status,
          dueDate: inv.dueDate,
          payments: (inv.paymentHistory || []).map(p => ({
            date: p.date,
            amount: p.amount,
            method: p.paymentMethod,
            transactionId: p.transactionId,
            processedBy: p.processedBy?.name || 'Admin'
          }))
        };
      });

      // FIXED: Summary - totalDue only positive; account for credits
      const summary = {
        totalPaid: ledger.reduce((s, r) => s + r.paidAmount, 0),
        totalDue: ledger.reduce((s, r) => s + Math.max(0, r.remainingDue), 0),  // Ignore credits in total due
        monthsWithPayments: ledger.filter(r => r.paidAmount > 0).length,
        totalMonths: ledger.length,
        overdueMonths: ledger.filter(r => r.status === 'Overdue').length
      };

      return {
        academicYearId: group.yearId,
        academicYearName: group.yearName,
        ledger,
        summary
      };
    });

    // Sort by academic year (oldest first)
    ledgers.sort((a, b) => a.academicYearName.localeCompare(b.academicYearName));

    res.json({ ledgers });
  } catch (err) {
    console.error('getStudentInvoices error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


// exports.getStudentInvoices = async (req, res) => {
//   try {
//     const { studentId } = req.params;
//     const schoolId = req.user.schoolId;

//     if (!mongoose.Types.ObjectId.isValid(studentId)) {
//       return res.status(400).json({ message: 'Invalid student ID' });
//     }

//     const invoices = await feeInvoice.find({
//       schoolId,
//       studentId
//     })
//       .populate('academicYear', 'name')
//       .sort({ month: 1 })
//       .lean();

//     if (!invoices.length) {
//       return res.json({ ledgers: [] });
//     }

//     // Group by academicYear
//     const grouped = {};
//     invoices.forEach(inv => {
//       const yearId = inv.academicYear?._id?.toString() || 'unknown';
//       if (!grouped[yearId]) {
//         grouped[yearId] = {
//           academicYearId: yearId,
//           academicYearName: inv.academicYear?.name || 'Unknown Year',
//           invoices: []
//         };
//       }
//       grouped[yearId].invoices.push(inv);
//     });

//     // Process each year independently
//     const ledgers = Object.values(grouped).map(group => {
//       let runningDue = 0;
//       const ledger = group.invoices.map(inv => {
//         const previousDue = runningDue;
//         const totalDues = previousDue + inv.totalAmount;
//         const paid = inv.paidAmount || 0;
//         const remaining = totalDues - paid;
//         runningDue = remaining > 0 ? remaining : 0;

//         return {
//           _id: inv._id,
//           month: inv.month,
//           previousDue,
//           currentFee: inv.totalAmount,
//           totalDues,
//           paidAmount: paid,
//           remainingDue: remaining,
//           status: inv.status,
//           dueDate: inv.dueDate,
//           payments: inv.paymentHistory || []
//         };
//       });

//       const summary = {
//         totalPaid: ledger.reduce((s, r) => s + r.paidAmount, 0),
//         totalDue: ledger.reduce((s, r) => s + r.remainingDue, 0),
//         monthsWithPayments: ledger.filter(r => r.paidAmount > 0).length,
//         totalMonths: ledger.length,
//         overdueMonths: ledger.filter(r => r.status === 'Overdue').length
//       };

//       return {
//         academicYearId: group.academicYearId,
//         academicYearName: group.academicYearName,
//         ledger,
//         summary
//       };
//     });

//     // Sort by year (oldest first)
//     ledgers.sort((a, b) => a.academicYearName.localeCompare(b.academicYearName));

//     res.json({ ledgers });
//   } catch (err) {
//     console.error('getStudentInvoices error:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// };