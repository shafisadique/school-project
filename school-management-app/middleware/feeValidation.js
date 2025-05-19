const { body } = require('express-validator');

exports.validateBulkInvoice = [
  body('className').notEmpty().withMessage('Class name is required'),
  body('month').isISO8601().withMessage('Invalid month format'),
  body('academicYearId').isMongoId().withMessage('Invalid academic year ID'),
  body('sections').optional().isArray().withMessage('Sections must be an array')
];