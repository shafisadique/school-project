const cron = require('node-cron');
const { calculateLateFees } = require('../utils/lateFeeCalculator');
const Invoice = require('../models/feeInvoice');

const updateInvoiceStatuses = async () => {
  const today = new Date();
  
  try {
    // Find all pending/partial invoices past due date
    const invoices = await Invoice.find({
      dueDate: { $lt: today },
      status: { $in: ['Pending', 'Partial'] }
    }).populate('feeStructureId');

    for (const invoice of invoices) {
      let needsUpdate = false;
      
      // Calculate late fee if enabled
      if (invoice.feeStructureId?.lateFeeConfig?.isEnabled) {
        const lateFee = calculateLateFees(invoice, invoice.feeStructureId);
        
        if (lateFee > 0) {
          invoice.lateFee = lateFee;
          invoice.totalAmount += lateFee;
          invoice.remainingDue += lateFee;
          invoice.invoiceDetails.push({
            name: 'Late Fee',
            amount: lateFee
          });
          needsUpdate = true;
        }
      }

      // Update status to overdue if still unpaid
      if (invoice.remainingDue > 0) {
        invoice.status = 'Overdue';
        needsUpdate = true;
      }

      if (needsUpdate) {
        await invoice.save();
      }
    }

    console.log(`Updated ${invoices.length} invoice statuses`);
  } catch (error) {
    console.error('Error updating invoice statuses:', error);
  }
};

// Schedule to run daily at 3 AM
cron.schedule('0 3 * * *', updateInvoiceStatuses);

module.exports = { updateInvoiceStatuses };