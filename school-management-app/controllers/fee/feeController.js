const AcademicYear = require('../../models/academicyear');
const FeeStructure = require('../../models/feeStructure');
const Student = require('../../models/student');
const moment = require('moment');

exports.createFeeStructure = async (req, res) => {
  try {
    const { className, baseFee, feeBreakdown } = req.body;
    const schoolId = req.user.schoolId;

    const academicYear = await AcademicYear.findOne({
      schoolId,
      isActive: true
    }).orFail(new Error('No active academic year'));

    const existingFee = await FeeStructure.findOne({
      schoolId,
      academicYear: academicYear._id,
      className
    });

    if (existingFee) {
      return res.status(409).json({ 
        message: `Fee structure exists for ${academicYear.name}`
      });
    }

    const newFee = await FeeStructure.create({
      schoolId,
      academicYear: academicYear._id,
      className,
      baseFee,
      feeBreakdown
    });

    res.status(201).json(newFee);
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
      const activeYear = await AcademicYear.findOne({ 
        schoolId, 
        isActive: true 
      });
      filter.academicYear = activeYear?._id;
    }

    const structures = await FeeStructure.find(filter)
      .populate('academicYear', 'name startDate endDate');

    res.json(structures);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.generateMonthlyInvoice = async (req, res) => {
  try {
    const { studentId, month } = req.body;
    const schoolId = req.user.schoolId;

    const academicYear = await AcademicYear.findOne({
      schoolId,
      isActive: true
    }).orFail(new Error('Active academic year not found'));

    if (!moment(month, 'YYYY-MM', true).isValid()) {
      return res.status(400).json({ message: 'Invalid month format' });
    }

    const invoiceDate = new Date(`${month}-01`);
    if (invoiceDate < academicYear.startDate || invoiceDate > academicYear.endDate) {
      return res.status(400).json({
        message: `Month not in ${academicYear.name}`
      });
    }

    const student = await Student.findOne({ 
      _id: studentId, 
      schoolId 
    }).orFail(new Error('Student not found'));

    const feeStructure = await FeeStructure.findOne({
      academicYear: academicYear._id,
      className: student.className
    }).orFail(new Error('Fee structure not found'));

    // Invoice generation logic here...

    res.status(201).json(newInvoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};