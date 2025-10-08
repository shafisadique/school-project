const mongoose = require('mongoose');
const moment = require('moment-timezone');
const FeeInvoice = require('../../models/feeInvoice');
const Student = require('../../models/student');
const AcademicYear = require('../../models/academicyear');
const Class = require('../../models/class'); // Added missing import
const APIError = require('../../utils/apiError');

const getAllFeeDashboard = async (user) => {
  try {
    const { schoolId, activeAcademicYear: defaultAcademicYearId } = user;
    const { academicYearId = defaultAcademicYearId } = {}; // Use default if no query params

    if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(academicYearId)) {
      throw new APIError('Invalid school ID or academic year ID', 400);
    }

    const today = moment.tz('Asia/Kolkata');
    const currentMonth = today.format('YYYY-MM');

    const baseMatch = {
      schoolId: new mongoose.Types.ObjectId(schoolId),
      academicYear: new mongoose.Types.ObjectId(academicYearId),
      month: currentMonth
    };

    const summaryAgg = await FeeInvoice.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          overallDue: { $sum: '$remainingDue' },
          overallPaid: { $sum: '$paidAmount' }
        }
      }
    ]);

    const feeStats = summaryAgg[0] || { overallDue: 0, overallPaid: 0 };
    return feeStats;
  } catch (error) {
    throw error;
  }
};
const getFeeDashboard = async (req, res, next) => {
  try {
    const { schoolId, activeAcademicYear: defaultAcademicYearId } = req.user;
    const { month, classId, academicYearId = defaultAcademicYearId } = req.query;
    console.log('req.user:', req.user, 'Query:', { classId, month, academicYearId }); // Debug

    if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(academicYearId)) {
      throw new APIError('Invalid school ID or academic year ID', 400);
    }

    // Step 1: Determine the current month if not provided
    const today = moment.tz('Asia/Kolkata');
    const currentMonth = today.format('YYYY-MM');
    const selectedMonth = month || currentMonth;

    // Step 2: Base match stage for all aggregations
    const baseMatch = {
      schoolId: new mongoose.Types.ObjectId(schoolId),
      academicYear: new mongoose.Types.ObjectId(academicYearId),
      month: selectedMonth
    };

    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      baseMatch.classId = new mongoose.Types.ObjectId(classId);
    }

    // Step 3: Calculate summary metrics
    const summaryAgg = await FeeInvoice.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalRemainingDue: { $sum: '$remainingDue' },
          totalPaid: { $sum: '$paidAmount' },
          totalAmount: { $sum: '$totalAmount' },
          overdueCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Overdue'] }, 1, 0] }
          },
          invoiceCount: { $sum: 1 }
        }
      }
    ]);

    const summary = summaryAgg[0] || {
      totalRemainingDue: 0,
      totalPaid: 0,
      totalAmount: 0,
      overdueCount: 0,
      invoiceCount: 0
    };
    summary.collectionRate = summary.totalAmount > 0
      ? ((summary.totalPaid / summary.totalAmount) * 100).toFixed(2)
      : 0;

    // Step 4: Breakdown by class
    let breakdownByClass = [];
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      const classDetails = await Class.findOne({
        _id: new mongoose.Types.ObjectId(classId),
        schoolId: new mongoose.Types.ObjectId(schoolId)
      });
      if (!classDetails) throw new APIError('Class not found', 404);

      const classBreakdownAgg = await FeeInvoice.aggregate([
        { $match: { ...baseMatch, classId: new mongoose.Types.ObjectId(classId) } },
        {
          $group: {
            _id: '$classId',
            totalRemainingDue: { $sum: '$remainingDue' },
            totalPaid: { $sum: '$paidAmount' },
            totalAmount: { $sum: '$totalAmount' },
            overdueCount: {
              $sum: { $cond: [{ $eq: ['$status', 'Overdue'] }, 1, 0] }
            },
            invoiceCount: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            classId: '$_id',
            className: classDetails.name || 'Unknown',
            totalRemainingDue: 1,
            totalPaid: 1,
            totalAmount: 1,
            overdueCount: 1,
            invoiceCount: 1,
            collectionRate: {
              $cond: [
                { $gt: ['$totalAmount', 0] },
                { $multiply: [{ $divide: ['$totalPaid', '$totalAmount'] }, 100] },
                0
              ]
            }
          }
        }
      ]);
      breakdownByClass = classBreakdownAgg.length > 0 ? classBreakdownAgg : [{
        classId,
        className: classDetails?.name || 'Unknown',
        totalRemainingDue: 0,
        totalPaid: 0,
        totalAmount: 0,
        overdueCount: 0,
        invoiceCount: 0,
        collectionRate: 0
      }];
    } else {
      breakdownByClass = await FeeInvoice.aggregate([
        { $match: baseMatch },
        {
          $lookup: {
            from: 'classes',
            localField: 'classId',
            foreignField: '_id',
            as: 'class'
          }
        },
        { $unwind: '$class' },
        {
          $group: {
            _id: '$classId',
            className: { $first: '$class.name' },
            totalRemainingDue: { $sum: '$remainingDue' },
            totalPaid: { $sum: '$paidAmount' },
            totalAmount: { $sum: '$totalAmount' },
            overdueCount: {
              $sum: { $cond: [{ $eq: ['$status', 'Overdue'] }, 1, 0] }
            },
            invoiceCount: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            classId: '$_id',
            className: 1,
            totalRemainingDue: 1,
            totalPaid: 1,
            totalAmount: 1,
            overdueCount: 1,
            invoiceCount: 1,
            collectionRate: {
              $cond: [
                { $gt: ['$totalAmount', 0] },
                { $multiply: [{ $divide: ['$totalPaid', '$totalAmount'] }, 100] },
                0
              ]
            }
          }
        },
        { $sort: { className: 1 } }
      ]);
    }

    // Step 5: Payment Method Breakdown
    const paymentMethodsAgg = await FeeInvoice.aggregate([
      { $match: baseMatch },
      { $unwind: '$paymentHistory' },
      {
        $group: {
          _id: '$paymentHistory.paymentMethod',
          totalAmount: { $sum: '$paymentHistory.amount' }
        }
      },
      {
        $project: {
          _id: 0,
          method: '$_id',
          totalAmount: 1
        }
      }
    ]);

    // Step 6: Top Defaulters
    const topDefaulters = await FeeInvoice.aggregate([
      { $match: { ...baseMatch, remainingDue: { $gt: 0 } } },
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: '$student' },
      {
        $lookup: {
          from: 'classes',
          localField: 'student.classId',
          foreignField: '_id',
          as: 'class'
        }
      },
      { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          studentName: '$student.name',
          admissionNo: '$student.admissionNo',
          className: { $ifNull: ['$class.name', 'Unknown'] },
          remainingDue: 1
        }
      },
      { $sort: { remainingDue: -1 } },
      { $limit: 10 }
    ]);

    // Step 7: Monthly Trend
    const sixMonthsAgo = moment.tz('Asia/Kolkata').subtract(6, 'months').startOf('month').format('YYYY-MM');
    const monthlyTrendAgg = await FeeInvoice.aggregate([
      {
        $match: {
          schoolId: new mongoose.Types.ObjectId(schoolId),
          academicYear: new mongoose.Types.ObjectId(academicYearId),
          month: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: '$month',
          totalPaid: { $sum: '$paidAmount' },
          totalRemainingDue: { $sum: '$remainingDue' }
        }
      },
      {
        $project: {
          _id: 0,
          month: '$_id',
          totalPaid: 1,
          totalRemainingDue: 1
        }
      },
      { $sort: { month: 1 } }
    ]);

    // Step 8: Compile and send response
    res.json({
      summary,
      breakdownByClass,
      paymentMethods: paymentMethodsAgg,
      topDefaulters,
      monthlyTrend: monthlyTrendAgg,
      filters: {
        selectedMonth,
        selectedClassId: classId || null,
        selectedAcademicYearId: academicYearId
      }
    });
  } catch (error) {
    console.error('Error in getFeeDashboard:', error);
    next(error);
  }
};

module.exports = { getFeeDashboard,getAllFeeDashboard };