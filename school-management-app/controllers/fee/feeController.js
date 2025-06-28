const FeeStructure = require('../../models/feeStructure');
const AcademicYear = require('../../models/academicyear');
const Class = require('../../models/class');
const FeeInvoice = require('../../models/feeInvoice')
const mongoose = require('mongoose');

const Route = require('../../models/route');

exports.createFeeStructure = async (req, res) => {
  try {
    const { schoolId, classId, academicYearId, fees, lateFeeConfig, discounts, createdBy } = req.body;

    // Basic validation
    if (!schoolId || !classId || !academicYearId || !createdBy) {
      return res.status(400).json({ message: 'Missing schoolId, classId, academicYearId, or createdBy' });
    }
    if (!fees || !Array.isArray(fees) || fees.length === 0) {
      return res.status(400).json({ message: 'At least one fee is required' });
    }

    // Check if academic year and class exist
    const academicYear = await AcademicYear.findById(academicYearId);
    if (!academicYear) {
      return res.status(404).json({ message: 'Academic year not found' });
    }
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Check for duplicate fee structure
    const existingFeeStructure = await FeeStructure.findOne({ schoolId, classId, academicYearId });
    if (existingFeeStructure) {
      return res.status(400).json({ message: 'Fee structure already exists' });
    }

    // Validate and prepare fees with route check
    const validatedFees = await Promise.all(fees.map(async (fee) => {
      let routeOptions = fee.routeOptions || [];
      if (fee.name.toLowerCase().includes('transport') && routeOptions.length > 0) {
        // Validate each routeId exists in the Route collection
        const validRoutes = await Promise.all(routeOptions.map(async (opt) => {
          const route = await Route.findOne({ _id: opt.routeId, schoolId });
          return route ? { routeId: opt.routeId, amount: opt.amount >= 0 ? opt.amount : 0 } : null;
        }));
        routeOptions = validRoutes.filter(opt => opt !== null);
      }
      return {
        name: fee.name,
        amount: fee.amount >= 0 ? fee.amount : 0,
        type: ['Base', 'Optional'].includes(fee.type) ? fee.type : 'Base',
        preferenceKey: fee.preferenceKey || null,
        routeOptions: routeOptions,
        frequency: ['Monthly', 'Quarterly', 'Yearly', 'Specific Months'].includes(fee.frequency) ? fee.frequency : 'Monthly',
        specificMonths: Array.isArray(fee.specificMonths) ? fee.specificMonths : []
      };
    }));

    // Create new fee structure
    const feeStructure = new FeeStructure({
      schoolId,
      classId,
      academicYearId,
      fees: validatedFees,
      lateFeeConfig: lateFeeConfig || {
        isEnabled: false,
        calculationType: 'daily',
        dailyRate: 0,
        fixedAmount: 0,
        percentageRate: 0,
        maxLateFee: 0,
        gracePeriodDays: 0
      },
      discounts: discounts || [],
      createdBy,
      status: true
    });

    await feeStructure.save();

    res.status(201).json({ 
      message: 'Fee structure created successfully', 
      data: feeStructure 
    });
  } catch (error) {
    console.error('Error creating fee structure:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get fee structures based on query parameters
exports.getFeeStructures = async (req, res) => {
  try {
    const { schoolId, classId, academicYearId } = req.query;

    if (!schoolId) {
      return res.status(400).json({ message: 'schoolId is required' });
    }

    const query = { schoolId };

    if (classId) {
      query.classId = classId;
    }

    if (academicYearId) {
      query.academicYearId = academicYearId;
    } else {
      const activeYear = await AcademicYear.findOne({ schoolId, isActive: true });
      if (activeYear) {
        query.academicYearId = activeYear._id;
      }
    }

    const feeStructures = await FeeStructure.find(query)
      .populate('classId', 'name')
      .populate('academicYearId', 'name')
      .lean();

    if (!feeStructures || feeStructures.length === 0) {
      return res.status(404).json({ message: 'No fee structures found' });
    }

    res.status(200).json({ message: 'Fee structures retrieved successfully', data: feeStructures });
  } catch (error) {
    console.error('Error fetching fee structures:', error);
    res.status(500).json({ message: 'Server error while fetching fee structures', error: error.message });
  }
};

// Get a single fee structure by ID
exports.getFeeStructureById = async (req, res) => {
  try {
    const { id } = req.params;

    const feeStructure = await FeeStructure.findById(id)
      .populate('classId', 'name')
      .populate('academicYearId', 'name')
      .lean();

    if (!feeStructure) {
      return res.status(404).json({ message: 'Fee structure not found' });
    }

    res.status(200).json({ message: 'Fee structure retrieved successfully', data: feeStructure });
  } catch (error) {
    console.error('Error fetching fee structure:', error);
    res.status(500).json({ message: 'Server error while fetching fee structure', error: error.message });
  }
};

// Update a fee structure
exports.updateFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const { fees, lateFeeRules, discounts } = req.body;

    const feeStructure = await FeeStructure.findById(id);
    if (!feeStructure) {
      return res.status(404).json({ message: 'Fee structure not found' });
    }

    if (fees) {
      if (!Array.isArray(fees) || fees.length === 0) {
        return res.status(400).json({ message: 'At least one fee is required' });
      }
      for (const fee of fees) {
        if (!fee.name || !fee.amount || !fee.type || !fee.frequency) {
          return res.status(400).json({ message: 'Each fee must have name, amount, type, and frequency' });
        }
        if (fee.amount < 0) {
          return res.status(400).json({ message: 'Fee amount cannot be negative' });
        }
        if (!['Base', 'Optional'].includes(fee.type)) {
          return res.status(400).json({ message: 'Fee type must be Base or Optional' });
        }
        if (!['Monthly', 'Quarterly', 'Yearly', 'Specific Months'].includes(fee.frequency)) {
          return res.status(400).json({ message: 'Fee frequency must be Monthly, Quarterly, Yearly, or Specific Months' });
        }
        if (fee.type === 'Optional' && !fee.preferenceKey) {
          return res.status(400).json({ message: 'Optional fees must have a preferenceKey' });
        }
        if (fee.type === 'Base' && fee.preferenceKey) {
          return res.status(400).json({ message: 'Base fees should not have a preferenceKey' });
        }
      }
      feeStructure.fees = fees;
    }

    if (lateFeeRules) {
      if (lateFeeRules.dailyRate < 0 || lateFeeRules.maxLateFee < 0) {
        return res.status(400).json({ message: 'Late fee rules cannot have negative values' });
      }
      feeStructure.lateFeeRules = lateFeeRules;
    }

    if (discounts) {
      if (!Array.isArray(discounts)) {
        return res.status(400).json({ message: 'Discounts must be an array' });
      }
      for (const discount of discounts) {
        if (!discount.name || !discount.amount || !discount.type) {
          return res.status(400).json({ message: 'Each discount must have name, amount, and type' });
        }
        if (discount.amount < 0) {
          return res.status(400).json({ message: 'Discount amount cannot be negative' });
        }
        if (!['Percentage', 'Fixed'].includes(discount.type)) {
          return res.status(400).json({ message: 'Discount type must be Percentage or Fixed' });
        }
      }
      feeStructure.discounts = discounts;
    }

    await feeStructure.save();

    res.status(200).json({ message: 'Fee structure updated successfully', data: feeStructure });
  } catch (error) {
    console.error('Error updating fee structure:', error);
    res.status(500).json({ message: 'Server error while updating fee structure', error: error.message });
  }
};

exports.deleteFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const feeStructure = await FeeStructure.findById(id);

    if (!feeStructure) {
      return res.status(404).json({ message: 'Fee structure not found' });
    }

    const invoiceCount = await FeeInvoice.countDocuments({ schoolId: feeStructure.schoolId });
    if (invoiceCount > 0) {
      return res.status(400).json({ message: 'Cannot delete fee structure. It is linked to existing invoices.' });
    }

    feeStructure.isDeleted = true;
    await feeStructure.save();

    res.status(200).json({ message: 'Fee structure marked as deleted', data: feeStructure });
  } catch (error) {
    console.error('Error deleting fee structure:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// controllers/feeController.js
exports.getPaidInvoiceList = async (req, res) => {
  try {
    const { academicYearId, className } = req.query;
    const schoolId = req.user.schoolId;

    const matchStage = { schoolId, $or: [{ status: 'Paid' }, { status: 'Partial' }] };
    if (academicYearId) matchStage.academicYear = mongoose.Types.ObjectId(academicYearId);
    if (className) {
      const students = await Student.find({ schoolId, className }).select('_id');
      matchStage.studentId = { $in: students.map(s => s._id) };
    }

    const invoices = await FeeInvoice.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: '$student' },
      {
        $lookup: {
          from: 'academicyears',
          localField: 'academicYear',
          foreignField: '_id',
          as: 'academicYear',
        },
      },
      { $unwind: '$academicYear' },
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          totalPaid: { $sum: '$paidAmount' },
          totalDue: { $sum: '$remainingDue' },
          invoices: {
            $push: {
              student: { name: '$student.name', admissionNo: '$student.admissionNo', className: '$student.className' },
              month: '$month',
              totalAmount: '$totalAmount',
              paidAmount: '$paidAmount',
              remainingDue: '$remainingDue',
              status: '$status',
              academicYear: '$academicYear.name',
            },
          },
        },
      },
      { $project: { _id: 0 } },
    ]);

    const summary = invoices[0] || {
      totalInvoices: 0,
      totalAmount: 0,
      totalPaid: 0,
      totalDue: 0,
      invoices: [],
    };

    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};