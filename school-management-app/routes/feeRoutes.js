const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const validateSchoolAccess = require('../middleware/validateSchoolAccess');
const {  externalRoleMiddleware, isAdmin } = require('../middleware/roleMiddleware');
const path = require('path');
const fs = require('fs');
const {
  createFeeStructure,
  getFeeStructures,
  getPaidInvoiceList,
  updateFeeStructure,
  deleteFeeStructure,
} = require('../controllers/fee/feeController');
const {
  processPayment,
  getInvoiceDetails,
  getStudentFeeSummary,
  generateInvoicePDF,
  getFeeCollectionReport,
  getDefaultersList,
  generateClassReceipts,
  getFeeCollectionDetailsReport,
  generateReceiptPDF,
  getStudentInvoices,
  searchInvoiceStudents,
  getStudentPaymentHistory,
  sendDefaulterSMS,
} = require('../controllers/fee/paymentController');
const invoiceService = require('../models/invoice.service');
const { searchStudents } = require('../controllers/student/studentController');
const FeeStructure = require('../models/feeStructure');
const Invoice = require('../models/feeInvoice');
const Student = require('../models/student');
const Receipt = require('../models/receipt');
const adminOrAccountant = externalRoleMiddleware(['admin', 'accountant']);
// Fee Structure Routes
router.post('/structures', authMiddleware, createFeeStructure);
router.get('/structures', authMiddleware, getFeeStructures);
router.put('/structures/:id', authMiddleware, validateSchoolAccess(FeeStructure), updateFeeStructure);
router.get('/structures/:id', authMiddleware, validateSchoolAccess(FeeStructure), (req, res) => res.json(req.record));
router.delete('/structures/:id', authMiddleware, validateSchoolAccess(FeeStructure), deleteFeeStructure);

// Add route for get-fee-structure (used by frontend)
router.get('/get-fee-structure', authMiddleware, getFeeStructures);
router.get('/search', authMiddleware, isAdmin, searchInvoiceStudents);

// Invoice Generation
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { schoolId, classId, className, month, academicYearId, customSchedules, isExamMonth, studentId, miscalculationStudents } = req.body;
    if (!schoolId || !classId || !className || !month || !academicYearId) {
      return res.status(400).json({ message: 'Missing required fields: schoolId, classId, className, month, and academicYearId are required.' });
    }

    const invoices = await invoiceService.generateInvoices(schoolId, classId, className, month, academicYearId, customSchedules, isExamMonth, studentId, miscalculationStudents);
    res.status(201).json({ message: 'Invoices generated successfully', data: invoices });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.get('/download-receipt/:filename', authMiddleware, (req, res) => {
  const filePath = path.join(__dirname, '../temp/receipts', req.params.filename);

  // Security check to prevent directory traversal
  if (filePath.includes('..')) {
    return res.status(400).json({ message: 'Invalid file path' });
  }

  fs.access(filePath, fs.constants.F_OK, err => {
    if (err) {
      return res.status(404).json({ message: 'File not found' });
    }
    res.download(filePath);
  });
});


router.get('/invoices',authMiddleware, invoiceService.getInvoicesByClassAndMonth);

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
router.post('/receipts', authMiddleware, generateClassReceipts);
router.get('/students/search/:query', authMiddleware, searchStudents);
router.get('/students/:studentId/summary', authMiddleware, getStudentFeeSummary);
router.get('/invoices/:id', authMiddleware, validateSchoolAccess(Invoice), getInvoiceDetails);
router.get('/reports/collection-details', authMiddleware, getFeeCollectionDetailsReport);
router.post('/students/:studentId/payments', authMiddleware, processPayment);
router.get('/invoices/:id/pdf', authMiddleware, validateSchoolAccess(Invoice), generateInvoicePDF);
router.get('/reports/collection', authMiddleware, getFeeCollectionReport);
router.get('/reports/defaulters', authMiddleware, getDefaultersList);
router.post('/send-defaulter-sms', authMiddleware, sendDefaulterSMS);
router.get('/paid-invoices', authMiddleware, adminOrAccountant,getPaidInvoiceList );
router.get('/invoices/student/:studentId', authMiddleware, getStudentInvoices);
router.get('/students/:studentId/payment-history', authMiddleware, getStudentPaymentHistory);
router.get('/receipts/:receiptId/pdf', authMiddleware, validateSchoolAccess(Receipt), generateReceiptPDF);
module.exports = router;
