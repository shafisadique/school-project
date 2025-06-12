const AcademicYear = require('../../models/academicyear');
const FeeStructure = require('../../models/feeStructure');

exports.createFeeStructure = async (req, res) => {
  try {
    const { className, frequency, baseFee, feeBreakdown, lateFeeRules, discounts } = req.body;
    const schoolId = req.user.schoolId;

    // Validate academic year
    const academicYear = await AcademicYear.findOne({ schoolId, isActive: true });
    if (!academicYear) {
      return res.status(404).json({ error: 'No active academic year found' });
    }

    // Check for existing fee structure
    const existingFee = await FeeStructure.findOne({
      schoolId,
      academicYear: academicYear._id,
      className
    });
    if (existingFee) {
      return res.status(409).json({ message: `Fee structure already exists for ${className} in ${academicYear.name}` });
    }

    // Create new fee structure
    const newFee = await FeeStructure.create({
      schoolId,
      academicYear: academicYear._id,
      className,
      frequency,
      baseFee,
      feeBreakdown,
      lateFeeRules,
      discounts
    });

    res.status(201).json({ success: true, data: newFee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getFeeStructures = async (req, res) => {
  try {
    const { academicYearId } = req.query;
    const schoolId = req.user.schoolId;

    const filter = { schoolId };
    if (academicYearId) {
      filter.academicYear = academicYearId;
    } else {
      const activeYear = await AcademicYear.findOne({ schoolId, isActive: true });
      if (!activeYear) {
        return res.status(404).json({ error: 'No active academic year found' });
      }
      filter.academicYear = activeYear._id;
    }

    const structures = await FeeStructure.find(filter)
      .populate('academicYear', 'name startDate endDate');

    res.json({ success: true, data: structures });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const { className, frequency, baseFee, feeBreakdown, lateFeeRules, discounts } = req.body;
    const schoolId = req.user.schoolId;

    const feeStructure = await FeeStructure.findOne({ _id: id, schoolId });
    if (!feeStructure) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }

    feeStructure.className = className || feeStructure.className;
    feeStructure.frequency = frequency || feeStructure.frequency;
    feeStructure.baseFee = baseFee || feeStructure.baseFee;
    feeStructure.feeBreakdown = feeBreakdown || feeStructure.feeBreakdown;
    feeStructure.lateFeeRules = lateFeeRules || feeStructure.lateFeeRules;
    feeStructure.discounts = discounts || feeStructure.discounts;

    await feeStructure.save();

    res.json({ success: true, data: feeStructure });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};