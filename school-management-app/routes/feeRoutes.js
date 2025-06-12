const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const validateSchoolAccess = require('../middleware/validateSchoolAccess');
const {
  createFeeStructure,
  getFeeStructures,
  updateFeeStructure,
} = require('../controllers/fee/feeController');
const {
  processPayment,
  getInvoiceDetails,
  getStudentFeeSummary,
  generateInvoicePDF,
  getFeeCollectionReport,
  getDefaultersList,
  generateClassReceipts,
} = require('../controllers/fee/paymentController');
const invoiceService = require('../models/invoice.service');
const { searchStudents } = require('../controllers/student/studentController');
const FeeStructure = require('../models/feeStructure');
const Invoice = require('../models/feeInvoice');
const Student = require('../models/student');

// Fee Structure Routes
router.post('/structures', authMiddleware, createFeeStructure);
router.get('/structures', authMiddleware, getFeeStructures);
router.put('/structures/:id', authMiddleware, validateSchoolAccess(FeeStructure), updateFeeStructure);
router.get('/structures/:id', authMiddleware, validateSchoolAccess(FeeStructure), (req, res) => res.json(req.record));

// Invoice Generation
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { schoolId, classId, className, month, academicYearId, customSchedules, isExamMonth } = req.body;
    if (!schoolId || !classId || !className || !month || !academicYearId) {
      return res.status(400).json({ message: 'Missing required fields: schoolId, classId, className, month, and academicYearId are required.' });
    }

    const invoices = await invoiceService.generateInvoices(schoolId, classId, className, month, academicYearId, customSchedules, isExamMonth);
    res.status(201).json({ message: 'Invoices generated successfully', data: invoices });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch Invoices by Class and Month
router.get('/invoices/class/:classId/month/:month', authMiddleware, async (req, res) => {
  try {
    const { classId, month } = req.params;
    const { academicYearId } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId || !month || !academicYearId) {
      return res.status(400).json({ message: 'Missing required fields: classId, month, and academicYearId are required.' });
    }

    const invoices = await Invoice.find({
      schoolId,
      academicYear: academicYearId,
      month,
      studentId: { $in: (await Student.find({ schoolId, classId: classId })).map(s => s._id) }
    }).populate('studentId', 'name');

    res.status(200).json({ message: 'Invoices retrieved successfully', data: invoices });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Notify Parents
router.post('/notify-parents', authMiddleware, async (req, res) => {
  try {
    const { classId, month, academicYearId } = req.body;
    const schoolId = req.user.schoolId;

    if (!classId || !month || !academicYearId) {
      return res.status(400).json({ message: 'Missing required fields: classId, month, and academicYearId are required.' });
    }

    const students = await Student.find({ schoolId, classId: classId });
    const invoices = await Invoice.find({
      schoolId,
      academicYear: academicYearId,
      month,
      studentId: { $in: students.map(s => s._id) }
    }).populate('studentId', 'name email');

    if (invoices.length === 0) {
      return res.status(404).json({ message: 'No invoices found for the specified class and month.' });
    }

    // Mock notification logic (replace with actual email/SMS service)
    for (const invoice of invoices) {
      const student = invoice.studentId;
      console.log(`Sending notification to ${student.name} (${student.email}) for invoice ${invoice._id}`);
      // Example: Send email or SMS using a service like SendGrid or Twilio
    }

    res.status(200).json({ message: 'Notifications sent successfully to parents.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate Class Receipts
router.post('/receipts', authMiddleware, generateClassReceipts);

// Student Payments
router.get('/students/search/:query', authMiddleware, searchStudents);
router.get('/students/:studentId/summary', authMiddleware, getStudentFeeSummary);

// Invoice Operations
router.get('/invoices/:id', authMiddleware, validateSchoolAccess(Invoice), getInvoiceDetails);
router.post('/invoices/:id/payments', authMiddleware, processPayment);
router.get('/invoices/:id/pdf', authMiddleware, validateSchoolAccess(Invoice), generateInvoicePDF);

// Reports
router.get('/reports/collection', authMiddleware, getFeeCollectionReport);
router.get('/reports/defaulters', authMiddleware, getDefaultersList);

module.exports = router;