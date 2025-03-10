const FeeStructure = require('../../models/feeStructure');
const Student = require('../../models/student');
const FeeInvoice = require('../../models/feeInvoice');
const moment = require('moment');

exports.generateMonthlyInvoice = async (req, res) => {
    try {
        const { studentId, month, customFees = {} } = req.body;

        // Validate month format (YYYY-MM)
        if (!moment(month, 'YYYY-MM', true).isValid()) {
            return res.status(400).json({ message: 'Invalid month format. Use YYYY-MM' });
        }

        const student = await Student.findById(studentId);
        console.log(student)
        if (!student) return res.status(404).json({ message: 'Student not found' });

        const feeStructure = await FeeStructure.findOne({
            schoolId: student.schoolId,
            session: student.currentSession,
            className: student.className
        });
        // console.log(feeStructure.findOne(student.schoolId))
        if (!feeStructure) {
            return res.status(400).json({ 
                message: `No fee structure found for ${student.className}`
            });
        }

        // Check for existing invoice for this month
        const existingInvoice = await FeeInvoice.findOne({
            studentId,
            month,
            // status: { $ne: 'Paid' }
        });

        if (existingInvoice) {
            return res.status(400).json({ 
                message: `Unpaid invoice already exists for ${month}`
            });
        }

        // Calculate previous dues (excluding current month)
        const unpaidInvoices = await FeeInvoice.find({
            studentId,
            status: { $ne: 'Paid' },
            month: { $ne: month }
        });

        const previousDue = unpaidInvoices.reduce((sum, invoice) => sum + invoice.remainingDue, 0);

        // Calculate current month fees
        const currentMonthFees = {
            tuitionFee: feeStructure.feeBreakdown.tuitionFee, // Add this
            examFee: feeStructure.feeBreakdown.examFee,       // Add this
            transportFee: customFees.transportFee ?? 
                         (student.usesTransport ? feeStructure.feeBreakdown.transportFee : 0),
            hostelFee: customFees.hostelFee ?? 
                      (student.usesHostel ? feeStructure.feeBreakdown.hostelFee : 0),
            miscFee: customFees.miscFee ?? feeStructure.feeBreakdown.miscFee
        };


        const baseAmount = feeStructure.baseFee;
        const currentCharges = Object.values(currentMonthFees).reduce((a, b) => a + b, 0);
        const totalFee = baseAmount + currentCharges + previousDue;

        // Create invoice with fee breakdown
        const newInvoice = new FeeInvoice({
            studentId,
            schoolId: student.schoolId,
            session: student.currentSession,
            month,
            baseAmount: feeStructure.baseFee,
            previousDue,
            currentCharges: Object.values(currentMonthFees).reduce((a, b) => a + b, 0),
            invoiceDetails: {  // ✅ Use schema's required field
                tuitionFee: currentMonthFees.tuitionFee,
                examFee: currentMonthFees.examFee,
                labFee: feeStructure.feeBreakdown.labFee,
                transportFee: currentMonthFees.transportFee,
                hostelFee: currentMonthFees.hostelFee,
                miscFee: currentMonthFees.miscFee
            },
            totalAmount: totalFee,
            remainingDue: totalFee,
            dueDate: moment().endOf('month').toDate(),
            paymentHistory: []
        });

        await newInvoice.save();

        
        // Update student's fee status if custom fees are provided
        if (customFees.transportFee !== undefined) {
            student.usesTransport = customFees.transportFee > 0;
        }
        if (customFees.hostelFee !== undefined) {
            student.usesHostel = customFees.hostelFee > 0;
        }
        await student.save();

        res.status(201).json({ 
            message: 'Invoice generated successfully',
            invoice: newInvoice 
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.makePayment = async (req, res) => {
    try {
      const { amountPaid, method = 'Cash' } = req.body;
      
      const invoice = await FeeInvoice.findById(req.params.id)
        .populate('studentId', 'totalDue totalPaid');
  
      // Validate payment
      if (amountPaid > invoice.remainingDue) {
        return res.status(400).json({ 
          message: `Payment cannot exceed remaining due of ${invoice.remainingDue}`
        });
      }
  
      // Record payment
      invoice.paymentHistory.push({
        date: new Date(),
        amount: amountPaid,
        method,
        receivedBy: req.user.id
      });
  
      // Update invoice status
      invoice.paidAmount += amountPaid;
      invoice.remainingDue = invoice.totalAmount - invoice.paidAmount;
      invoice.status = invoice.remainingDue > 0 ? 'Partially Paid' : 'Paid';
  
      // Update student financials
      const student = await Student.findById(invoice.studentId);
      student.totalPaid += amountPaid;
      student.totalDue -= amountPaid;
  
      await Promise.all([invoice.save(), student.save()]);
  
      res.json({
        message: 'Payment recorded',
        receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
        newBalance: invoice.remainingDue
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
// Additional helper endpoint
exports.getStudentFeeSummary = async (req, res) => {
    try {
        const { studentId } = req.params;

        const [invoices, student] = await Promise.all([
            FeeInvoice.find({ studentId }).sort({ month: 1 }),
            Student.findById(studentId)
        ]);

        const summary = {
            currentDue: 0,
            totalPaid: student.totalPaid,
            upcomingDue: student.totalDue,
            feeHistory: invoices.map(invoice => ({
                month: invoice.month,
                amount: invoice.totalAmount,
                paid: invoice.paidAmount,
                status: invoice.status
            }))
        };

        res.json(summary);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// paymentController.js
exports.recordPayment = async (req, res) => {
    try {
      const { invoiceId } = req.params;
      const { amountPaid } = req.body;
  
      // 1. Find the invoice
      const invoice = await FeeInvoice.findById(invoiceId);
      
      // 2. Validate payment amount
      if (amountPaid > invoice.remainingDue) {
        return res.status(400).json({
          message: `Payment cannot exceed remaining due of ${invoice.remainingDue}`
        });
      }
  
      // 3. Update payment details
      invoice.paymentHistory.push({
        date: new Date(),
        amount: amountPaid,
        method: 'Cash', // or from request body
        receivedBy: req.user.id
      });
  
      // 4. Update financials
      invoice.paidAmount += amountPaid;
      invoice.remainingDue = invoice.totalAmount - invoice.paidAmount;
      
      // 5. Update status
      invoice.status = invoice.remainingDue > 0 ? 'Partially Paid' : 'Paid';
  
      // 6. Save changes
      await invoice.save();
  
      // 7. Update student's financial summary
      await Student.findByIdAndUpdate(invoice.studentId, {
        $inc: { totalPaid: amountPaid, totalDue: -amountPaid }
      });
  
      res.json({
        message: 'Payment recorded successfully',
        newBalance: invoice.remainingDue
      });
  
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  exports.generateClassInvoices = async (req, res) => {
    try {
      const { schoolId, className, session, month } = req.body;
  
      // Validate inputs
      if (!moment(month, 'YYYY-MM', true).isValid()) {
        return res.status(400).json({ message: 'Invalid month format' });
      }
  
      // Get fee structure
      const feeStructure = await FeeStructure.findOne({ schoolId, className, session });
      if (!feeStructure) {
        return res.status(404).json({ message: 'Fee structure not found' });
      }
  
      // Get all students in class
      const students = await Student.find({ 
        schoolId, 
        className,
        currentSession: session 
      });
  
      // Prepare bulk operations
      const bulkOps = [];
      const updatedStudents = [];
  
      for (const student of students) {

        // Check existing invoice for this month
        const exists = await FeeInvoice.findOne({
          studentId: student._id,
          month,
          status: { $ne: 'Paid' }
        });
  
        if (exists) continue;
  
        // Calculate previous dues (excluding current month)
        const unpaidInvoices = await FeeInvoice.find({
          studentId: student._id,
          status: { $ne: 'Paid' },
          month: { $ne: month }
        });
  
        const previousDue = unpaidInvoices.reduce((sum, invoice) => sum + invoice.remainingDue, 0);
  
        // Calculate current fees
        // Calculate current fees (FIXED EXAM FEE CALCULATION)
      const isExamMonth = feeStructure.examMonths.includes(month);
      const examFee = isExamMonth ? feeStructure.feeBreakdown.examFee : 0;

      const transportFee = student.usesTransport ? feeStructure.feeBreakdown.transportFee : 0;
      const hostelFee = student.usesHostel ? feeStructure.feeBreakdown.hostelFee : 0;
        
        const currentCharges = 
          feeStructure.feeBreakdown.tuitionFee +
          examFee+
          transportFee +
          hostelFee +
          feeStructure.feeBreakdown.miscFee;
  
        const totalFee = feeStructure.baseFee + currentCharges + previousDue;
  
        // Prepare invoice
        bulkOps.push({
          insertOne: {
            document: {
              studentId: student._id,
              schoolId,
              session,
              month,
              baseAmount: feeStructure.baseFee,
              previousDue,
              currentCharges,
              invoiceDetails: {
                tuitionFee: feeStructure.feeBreakdown.tuitionFee,
                examFee: examFee,
                transportFee:transportFee,
                hostelFee:hostelFee,
                miscFee: feeStructure.feeBreakdown.miscFee
              },
              totalAmount: totalFee,
              remainingDue: totalFee,
              status: 'Pending',
              paymentHistory: [],
              dueDate: moment().endOf('month').toDate()
            }
          }
        });
  
        // Track students needing updates
        if (transportFee > 0 || hostelFee > 0) {
          updatedStudents.push(student._id);
        }
      }
  
      // Execute bulk operations
      const result = await FeeInvoice.bulkWrite(bulkOps);
  
      // Update student transport/hostel status in bulk
      await Student.updateMany(
        { _id: { $in: updatedStudents } },
        { 
          $set: { 
            usesTransport: true,
            usesHostel: true 
          }
        }
      );
  
      res.status(201).json({
        message: `Generated ${result.insertedCount} invoices`,
        insertedCount: result.insertedCount,
        existingInvoices: students.length - result.insertedCount
      });
  
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  

  exports.getInvoiceDetails = async (req, res) => {
    try {
      const invoice = await FeeInvoice.findById(req.params.id)
        .populate('studentId', 'name admissionNo className')
        .populate('schoolId', 'name address')
        .populate('paymentHistory.receivedBy', 'name');
  
      if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  
      res.json({
        school: invoice.schoolId,
        student: invoice.studentId,
        invoiceDate: invoice.createdAt,
        dueDate: invoice.dueDate,
        status: invoice.status,
        feeBreakdown: invoice.invoiceDetails,
        paymentHistory: invoice.paymentHistory,
        totals: {
          baseAmount: invoice.baseAmount,
          previousDue: invoice.previousDue,
          currentCharges: invoice.currentCharges,
          totalAmount: invoice.totalAmount,
          remainingDue: invoice.remainingDue
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  // controllers/fee/paymentController.js
exports.getStudentInvoices = async (req, res) => {
    try {
      const { studentId } = req.params;
      
      const invoices = await FeeInvoice.find({ studentId })
        .populate('studentId', 'name admissionNo className')
        .sort({ createdAt: -1 });
        console.log(invoices)
      res.status(200).json({
        success: true,
        count: invoices.length,
        data: invoices
      });
      
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  };