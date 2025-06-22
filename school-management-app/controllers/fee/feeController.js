const FeeStructure = require('../../models/feeStructure');
const AcademicYear = require('../../models/academicyear');
const Class = require('../../models/class');
const FeeInvoice = require('../../models/feeInvoice')
// Create a new fee structure
exports.createFeeStructure = async (req, res) => {
  try {
    const {
      schoolId,
      classId,
      academicYearId,
      fees,
      lateFeeRules,
      discounts,
      createdBy
    } = req.body;

    // Validate required fields
    if (!schoolId || !classId || !academicYearId || !createdBy) {
      return res.status(400).json({ message: 'schoolId, classId, academicYearId, and createdBy are required' });
    }

    if (!fees || !Array.isArray(fees) || fees.length === 0) {
      return res.status(400).json({ message: 'At least one fee is required' });
    }

    // Validate fees array
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
        return res.status(400).json({ message: 'Optional fees must have a preferenceKey (e.g., usesTransport)' });
      }
      if (fee.type === 'Base' && fee.preferenceKey) {
        return res.status(400).json({ message: 'Base fees should not have a preferenceKey' });
      }
    }

    // Validate discounts
    if (discounts && Array.isArray(discounts)) {
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
    }

    // Validate lateFeeRules
    if (lateFeeRules && (lateFeeRules.dailyRate < 0 || lateFeeRules.maxLateFee < 0)) {
      return res.status(400).json({ message: 'Late fee rules cannot have negative values' });
    }

    // Validate references
    const academicYearDoc = await AcademicYear.findById(academicYearId);
    if (!academicYearDoc) {
      return res.status(404).json({ message: 'Academic year not found' });
    }

    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Check for existing fee structure
    const existingFeeStructure = await FeeStructure.findOne({ schoolId, classId, academicYearId });
    if (existingFeeStructure) {
      return res.status(400).json({ message: 'Fee structure already exists for this class and academic year' });
    }

    // Create the fee structure
    const feeStructure = new FeeStructure({
      schoolId,
      classId,
      academicYearId,
      fees,
      lateFeeRules: lateFeeRules || { dailyRate: 0, maxLateFee: 0 },
      discounts: discounts || [],
      createdBy,
      status: true
    });

    await feeStructure.save();

    res.status(201).json({ message: 'Fee structure created successfully', data: feeStructure });
  } catch (error) {
    console.error('Error creating fee structure:', error);
    res.status(500).json({ message: 'Server error while creating fee structure', error: error.message });
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