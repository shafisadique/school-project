// utils/lateFeeCalculator.js
const moment = require('moment');

exports.calculateLateFees = (invoice, feeStructure) => {
  if (!feeStructure.lateFeeConfig.isEnabled) return 0;
  if (invoice.status === 'Paid') return 0;
  
  const dueDate = moment(invoice.dueDate);
  const today = moment();
  let daysLate = today.diff(dueDate, 'days') - feeStructure.lateFeeConfig.gracePeriodDays;
  
  if (daysLate <= 0) return 0;

  const config = feeStructure.lateFeeConfig;
  let calculatedFee = 0;

  switch(config.calculationType) {
    case 'daily':
      calculatedFee = config.dailyRate * daysLate;
      break;
    case 'fixed':
      calculatedFee = config.fixedAmount;
      break;
    case 'percentage':
      calculatedFee = (invoice.remainingDue * config.percentageRate) / 100;
      break;
  }

  // Apply cap if exists
  if (config.maxLateFee > 0) {
    calculatedFee = Math.min(calculatedFee, config.maxLateFee);
  }

  return calculatedFee;
};