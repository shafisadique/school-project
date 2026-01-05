// routes/reportsRoutes.js
const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports/reportsController');
const authMiddleware = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/roleMiddleware');

router.post('/custom', authMiddleware, isAdmin, reportsController.generateCustomReport);
router.get('/udise-compliance', authMiddleware, isAdmin, reportsController.getUDISECompliance);
router.get('/udise/:template', authMiddleware, isAdmin, reportsController.generateUDISEReport);
router.post('/export/:format', authMiddleware, isAdmin, reportsController.exportReport);

module.exports = router;