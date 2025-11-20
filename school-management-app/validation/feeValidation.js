const Joi = require('joi');

exports.paymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  paymentMethod: Joi.string().valid('Cash', 'Cheque', 'Online', 'Card').required(),
  date: Joi.date().max('now').required(),
  chequeNumber: Joi.when('paymentMethod', {
    is: 'Cheque',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  }),
  transactionId: Joi.when('paymentMethod', {
    is: 'Online',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  })
});

exports.orderSchema = Joi.object({
  schoolId: Joi.string().hex().length(24).required(),
  planType: Joi.string().valid('basic', 'premium', 'enterprise').required(),
  amount: Joi.number().positive().required()
});

// Input sanitization
exports.sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.replace(/[<>]/g, '').trim();
  }
  return input;
};