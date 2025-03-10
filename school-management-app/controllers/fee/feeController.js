const FeeStructure = require('../../models/feeStructure');
const Student = require('../../models/student');
const FeeInvoice = require('../../models/feeInvoice');
const school = require('../../models/school');

exports.createFeeStructure = async (req, res) => {
    try {
      const { schoolId, session, className, baseFee, feeBreakdown } = req.body;
  
      // ✅ Ensure Fee Structure Does Not Already Exist
      const existingFee = await FeeStructure.findOne({ schoolId, session, className });
      if (existingFee) {
        return res.status(400).json({ message: 'Fee structure already exists for this school, class, and session' });
      }
  
      // ✅ Create Fee Structure
      const newFee = new FeeStructure({
        schoolId,
        session,
        className,
        baseFee,
        feeBreakdown
      });
  
      await newFee.save();
      res.status(201).json({ message: 'Fee structure created successfully', feeStructure: newFee });
  
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  exports.getFeeStructures = async (req, res) => {
    try {
      const { schoolId, session, className } = req.query;
  
      // Build query dynamically
      const query = { schoolId };
      if (session) query.session = session;
      if (className) query.className = className;
  
      const feeStructures = await FeeStructure.find(query)
        .populate('schoolId', 'name address')
        .sort({ className: 1 });
  
      if (!feeStructures.length) {
        return res.status(404).json({ message: 'No fee structures found' });
      }
  
      res.status(200).json(feeStructures);
  
    } catch (err) {
      res.status(500).json({ 
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  };

  exports.generateMonthlyInvoice = async (req, res) => {
    try {
      const { studentId, session, month, customFees } = req.body;
  
      // ✅ Fetch Student
      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }
  
      // ✅ Fetch School Fee Structure
      const feeStructure = await FeeStructure.findOne({ 
        schoolId: student.schoolId,
        session,
        className: student.className
      });
  
      if (!feeStructure) {
        return res.status(400).json({ message: `No fee structure found for class ${student.className} in this school` });
      }
  
      // ✅ Fetch Last Month's Invoice for Due Amount
      const lastInvoice = await FeeInvoice.findOne({
        studentId,
        session,
        status: { $ne: 'Paid' }
      }).sort({ createdAt: -1 });
  
      const previousDue = lastInvoice ? lastInvoice.remainingDue : 0;
  
      // ✅ Calculate Total Fee
      const totalFee = 
        feeStructure.baseFee +
        (customFees.transportFee || 0) +
        (customFees.hostelFee || 0) +
        previousDue;
  
      // ✅ Create Invoice
      const newInvoice = new FeeInvoice({
        studentId,
        schoolId: student.schoolId,
        session,
        month,
        invoiceDetails: {
          ...feeStructure.feeBreakdown,
          transportFee: customFees.transportFee || 0,
          hostelFee: customFees.hostelFee || 0
        },
        previousDue,
        totalAmount: totalFee,
        paidAmount: 0 ,
        remainingDue: totalFee
      });
  
      await newInvoice.save();
      res.status(201).json({ message: 'Invoice generated', invoice: newInvoice });
  
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  
  exports.makePayment = async (req, res) => {
    try {
      const { id: invoiceId } = req.params; // Get from URL parameter
      const { amountPaid } = req.body;
  
      // Rest of the code remains the same...
      const invoice = await FeeInvoice.findById(invoiceId);
      invoice.paymentHistory.push({
        amount: amountPaid,
        date: new Date(),
        method: req.body.method || 'Cash',
        receivedBy: req.user.id
      });
    
      if (!invoice) {
        return res.status(404).json({ message: 'Invoice not found' });
      }
  
      // ✅ Fetch the Student Associated with this Invoice
      const student = await Student.findById(invoice.studentId);
      if (!student) {
        return res.status(404).json({ message: 'Student associated with this invoice not found' });
      }
  
      // ✅ Fetch the School & Verify the Invoice Belongs to It
      const school = await school.findById(student.schoolId);
      if (!school) {
        return res.status(404).json({ message: 'School for this student not found' });
      }
  
      // ✅ Ensure the Invoice is for the Correct School
      if (String(invoice.schoolId) !== String(school._id)) {
        return res.status(403).json({ message: 'Invoice does not belong to this school' });
      }
  
      // ✅ Ensure the Amount Paid is Valid
      if (amountPaid <= 0) {
        return res.status(400).json({ message: 'Amount paid must be greater than zero' });
      }
  
      // ✅ Update Paid Amount & Remaining Due
      invoice.paidAmount += amountPaid;
      invoice.remainingDue = invoice.totalAmount - invoice.paidAmount;
  
      // ✅ Update Status
      if (invoice.remainingDue === 0) {
        invoice.status = 'Paid';
      } else {
        invoice.status = 'Partially Paid';
      }
  
      await invoice.save();
  
      res.status(200).json({
        message: 'Payment successful',
        updatedInvoice: invoice
      });
  
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  
  exports.processPayment = async (req, res) => {
    try {
      const { studentId, amount } = req.body;
      let remaining = amount;
      
      const invoices = await FeeInvoice.find({ studentId, status: { $ne: 'Paid' } })
        .sort({ month: 1 });
  
      for (const invoice of invoices) {
        if (remaining <= 0) break;
        const payment = Math.min(remaining, invoice.remainingDue);
        
        invoice.paymentHistory.push({
          date: new Date(),
          amount: payment,
          method: req.body.method || 'Cash',
          receivedBy: req.user.id
        });
  
        invoice.paidAmount += payment;
        invoice.remainingDue -= payment;
        invoice.status = invoice.remainingDue > 0 ? 'Partially Paid' : 'Paid';
        remaining -= payment;
        
        await invoice.save();
      }
  
      await Student.findByIdAndUpdate(studentId, {
        $inc: { totalPaid: amount, totalDue: -amount }
      });
  
      res.json({ 
        message: 'Payment processed',
        remainingBalance: remaining 
      });
  
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };