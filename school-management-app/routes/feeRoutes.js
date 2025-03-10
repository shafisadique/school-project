const express = require('express');
const router = express.Router();
const feeController = require('../controllers/fee/feeController');
const authMiddleware = require('../middleware/authMiddleware');
const { generateMonthlyInvoice, makePayment ,generateClassInvoices, getInvoiceDetails, getStudentInvoices} = require('../controllers/fee/paymentController');
const generateClassReceipts = require('../controllers/fee/feeReciptController');

// ✅ Create Fee Structure (Admin)
router.post('/create-structure', authMiddleware, feeController.createFeeStructure);
router.get('/get-fee-structure',authMiddleware,feeController.getFeeStructures)


router.get('/students/:studentId/invoices', authMiddleware,getStudentInvoices);
router.get('/invoices/:id', authMiddleware, getInvoiceDetails);
router.post('/invoices/:id/pay', authMiddleware, makePayment);
router.post('/invoices', authMiddleware, generateMonthlyInvoice);
router.post('/invoices/bulk', authMiddleware, generateClassInvoices);
router.post('/receipts',authMiddleware, generateClassReceipts.generateClassReceipts);

module.exports = router;
