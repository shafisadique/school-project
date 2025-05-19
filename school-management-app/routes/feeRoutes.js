const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const validateSchoolAccess = require('../middleware/validateSchoolAccess');
const {
  generateBulkMonthlyInvoices,
  processPayment,
  getInvoiceDetails,
  getStudentFeeSummary
} = require('../controllers/fee/paymentController');
const {
  createFeeStructure,
  getFeeStructures
} = require('../controllers/fee/feeController');
const { searchStudents } = require('../controllers/student/studentController');
const FeeStructure = require('../models/feeStructure');
const feeInvoice = require('../models/feeInvoice');

// Fee Structure Routes
router.post('/structures', 
  authMiddleware, 
  createFeeStructure
);

router.get('/structures', 
  authMiddleware,
  getFeeStructures
);

router.get('/structures/:id',
  authMiddleware,
  validateSchoolAccess(FeeStructure),
  (req, res) => res.json(req.record)
);

// Bulk Operations
router.post('/invoices/bulk',
  authMiddleware,
  generateBulkMonthlyInvoices
);

// Student Payments
router.get('/students/search/:query',
  authMiddleware,
  searchStudents
);

router.get('/students/:studentId/summary',
  authMiddleware,
  getStudentFeeSummary
);

// Invoice Operations
router.get('/invoices/:id',
  authMiddleware,
  validateSchoolAccess(feeInvoice),
  getInvoiceDetails
);

router.post('/invoices/:id/payments',
  authMiddleware,
  processPayment
);

module.exports = router;