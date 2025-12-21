// controllers/student/studentDashboardController.js

const Student = require('../../models/student');
const Holiday = require('../../models/holiday');
const FeeInvoice = require('../../models/feeInvoice');
const Assignment = require('../../models/assignment');
const Teacher = require('../../models/teacher');
const Subject = require('../../models/subject');
const Payment = require('../../models/payment');
const attendance = require('../../models/studentAttendance')

const mongoose = require('mongoose');
const moment = require('moment-timezone');


const getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.user.additionalInfo?.studentId;
    console.log(studentId)
    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Invalid student access' });
    }

    const studentObjId = new mongoose.Types.ObjectId(studentId);
    const schoolObjId = new mongoose.Types.ObjectId(req.user.schoolId);
    const academicYearObjId = new mongoose.Types.ObjectId(req.user.activeAcademicYear);

    const today = moment.tz('Asia/Kolkata');
    const todayStart = today.clone().startOf('day').toDate();
    const todayEnd = today.clone().endOf('day').toDate();

    const [result] = await Student.aggregate([
      { $match: { _id: studentObjId, schoolId: schoolObjId, academicYearId: academicYearObjId, status: true } },

      { $lookup: { from: 'classes', localField: 'classId', foreignField: '_id', as: 'classInfo' } },
      { $unwind: { path: '$classInfo', preserveNullAndEmptyArrays: true } },

      // TODAY'S HOLIDAY
      {
        $lookup: {
          from: 'holidays',
          pipeline: [
            { $match: { schoolId: schoolObjId, date: { $gte: todayStart, $lte: todayEnd } } },
            { $limit: 1 },
            { $project: { title: 1 } }
          ],
          as: 'todayHoliday'
        }
      },

      // ALL HOLIDAYS
      {
        $lookup: {
          from: 'holidays',
          pipeline: [
            { $match: { schoolId: schoolObjId } },
            { $sort: { date: 1 } },
            { $limit: 10 },
            { $project: { title: 1, date: { $dateToString: { format: "%d %b %Y", date: "$date" } } } }
          ],
          as: 'allHolidays'
        }
      },

      // FULL FEE INVOICES + PAYMENT HISTORY — ALL 12 MONTHS
      {
        $lookup: {
          from: 'feeinvoices',
          let: { studentId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$studentId', '$$studentId'] },
                    { $eq: ['$academicYear', academicYearObjId] }
                  ]
                }
              }
            },
            {
              $lookup: {
                from: 'payments',
                localField: '_id',
                foreignField: 'invoiceId',
                as: 'payments'
              }
            },
            {
              $addFields: {
                paidAmount: { $sum: '$payments.amount' },
                remainingDue: { $subtract: ['$totalAmount', { $sum: '$payments.amount' }] },
                paymentHistory: {
                  $map: {
                    input: '$payments',
                    in: {
                      amount: '$$this.amount',
                      method: '$$this.paymentMethod',
                      date: { $dateToString: { format: "%d %b %Y", date: "$$this.date" } }
                    }
                  }
                }
              }
            },
            {
              $project: {
                month: 1,
                totalAmount: 1,
                paidAmount: 1,
                remainingDue: 1,
                status: 1,
                dueDate: { $dateToString: { format: "%b %Y", date: "$dueDate" } },
                paymentHistory: 1
              }
            },
            { $sort: { dueDate: 1 } }
          ],
          as: 'feeInvoices'
        }
      },

      // PENDING ASSIGNMENTS
      {
        $lookup: {
          from: 'assignments',
          let: { classId: '$classId', studentId: studentObjId },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$classId', '$$classId'] }, { $lte: ['$dueDate', new Date()] }] } } },
            { $addFields: { isSubmitted: { $in: ['$$studentId', { $ifNull: ['$submittedBy', []] }] } } },
            { $match: { isSubmitted: false } },
            {
              $lookup: { from: 'subjects', localField: 'subjectId', foreignField: '_id', as: 'subjectInfo' } },
            { $unwind: { path: '$subjectInfo', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                subject: '$subjectInfo.name',
                dueDate: { $dateToString: { format: "%d %b", date: "$dueDate" } }
              }
            }
          ],
          as: 'pendingAssignments'
        }
      },

      // FINAL PROJECT — FULL SESSION
      {
        $project: {
          name: 1,
          admissionNo: 1,
          rollNo: { $ifNull: ['$rollNo', 'Not Assigned'] },
          className: '$classInfo.name',
          section: 1,
          profileImage: '$profileImage',
          todayAttendance: {
            $cond: [
              { $gt: [{ $size: '$todayHoliday' }, 0] },
              'Holiday',
              'School Day'
            ]
          },

          holidayName: { $arrayElemAt: ['$todayHoliday.title', 0] },
          allHolidays: 1,
          pendingAssignments: { $ifNull: ['$pendingAssignments', []] },

          // FULL FEE SESSION — ALL 12 MONTHS
          feeInvoices: { $ifNull: ['$feeInvoices', []] },
          totalFee: { $sum: '$feeInvoices.totalAmount' },
          totalPaid: { $sum: '$feeInvoices.paidAmount' },
          totalDue: { $sum: '$feeInvoices.remainingDue' }
        }
      }
    ]);

    if (!result) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({ success: true, data: result });

  } catch (error) {
    console.error('Dashboard error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

async function getStudentDashboardData(user) {
  const { schoolId, activeAcademicYear: academicYearId } = user;
  if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(academicYearId)) {
    throw new Error('Invalid school ID or academic year ID');
  }

  const totalActiveStudents = await Student.countDocuments({
    schoolId: new mongoose.Types.ObjectId(schoolId),
    academicYearId: new mongoose.Types.ObjectId(academicYearId),
    status: true
  });

  return { totalActiveStudents };
}

const getStudentAttendance = async (req, res, next) => {
  try {
    const { schoolId, activeAcademicYear: academicYearId, role, teacherId } = req.user;
    if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(academicYearId)) {
      throw new APIError('Invalid school ID or academic year ID', 400);
    }

    const { classId, period = 'weekly', month } = req.query;
    let totalStudents = 0;

    // Total active students calculation (time-independent)
    let studentMatch = {
      schoolId: new mongoose.Types.ObjectId(schoolId),
      academicYearId: new mongoose.Types.ObjectId(academicYearId),
      status: true
    };
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      studentMatch.classId = new mongoose.Types.ObjectId(classId);
      const classExists = await Class.findOne({
        _id: studentMatch.classId,
        schoolId: studentMatch.schoolId
      });
      if (!classExists) throw new APIError('Class not found', 404);
    }
    if (role === 'teacher' && teacherId) {
      studentMatch.assignedTeacherId = new mongoose.Types.ObjectId(teacherId);
    }
    totalStudents = await Student.countDocuments(studentMatch);

    // Determine date range and categories based on period
    const today = moment.tz('Asia/Kolkata').startOf('day'); // 11:53 AM IST, September 28, 2025
    let startDate, endDate, groupBy, categories = [];
    switch (period) {
      case 'weekly':
        startDate = moment(today).subtract(6, 'days').startOf('day').toDate(); // September 22, 2025
        endDate = moment(today).endOf('day').toDate(); // September 28, 2025
        groupBy = { $dayOfWeek: '$date' }; // 1 = Sunday, 7 = Saturday
        categories = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        break;
      case 'monthly':
        if (month) {
          startDate = moment.tz(month, 'YYYY-MM', 'Asia/Kolkata').startOf('month').toDate();
          endDate = moment(startDate).endOf('month').toDate();
        } else {
          startDate = moment(today).startOf('month').toDate(); // September 1, 2025
          endDate = moment(today).endOf('month').toDate(); // September 30, 2025
        }
        groupBy = { $week: '$date' };
        const startWeek = moment(startDate).week();
        const endWeek = moment(endDate).week();
        for (let week = startWeek; week <= endWeek; week++) {
          categories.push(`Week ${week - startWeek + 1}`);
        }
        break;
      case 'yearly':
        startDate = moment(today).startOf('year').toDate(); // January 1, 2025
        endDate = moment(today).endOf('year').toDate(); // December 31, 2025
        groupBy = { $month: '$date' };
        categories = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        break;
      default:
        throw new APIError('Invalid period. Use weekly, monthly, or yearly.', 400);
    }

    // Attendance match
    let attendanceMatch = {
      schoolId: new mongoose.Types.ObjectId(schoolId),
      academicYearId: new mongoose.Types.ObjectId(academicYearId),
      date: { $gte: startDate, $lte: endDate }
    };
    if (role === 'teacher' && teacherId) {
      attendanceMatch.teacherId = new mongoose.Types.ObjectId(teacherId);
    }
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      attendanceMatch.classId = new mongoose.Types.ObjectId(classId);
    }

    // Aggregate attendance
    const attendanceAgg = await attendance.aggregate([
      { $match: attendanceMatch },
      { $unwind: '$students' },
      {
        $group: {
          _id: groupBy ? { period: groupBy, status: '$students.status' } : '$students.status',
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.period': 1 } }
    ]);

    // Process aggregation results
    const attendanceData = {
      Present: Array(categories.length).fill(0),
      Absent: Array(categories.length).fill(0),
      Late: Array(categories.length).fill(0)
    };

    attendanceAgg.forEach(item => {
      const status = item._id.status || item._id;
      let index;
      if (groupBy) {
        if (period === 'weekly') {
          // Adjust for day of week (1 = Sunday, 7 = Saturday), map to 0-6 index
          index = (item._id.period - 1 + 7) % 7; // e.g., Sunday (1) -> 0, Monday (2) -> 1, etc.
        } else if (period === 'monthly') {
          const weekDiff = item._id.period - moment(startDate).week();
          index = weekDiff >= 0 ? weekDiff : 0;
        } else if (period === 'yearly') {
          index = item._id.period - 1; // 1 = January (0), 12 = December (11)
        }
        index = Math.max(0, Math.min(index, categories.length - 1));
      } else {
        index = 0; // For daily (no grouping)
      }
      if (attendanceData[status] !== undefined) {
        attendanceData[status][index] = (attendanceData[status][index] || 0) + item.count;
      }
    });

    // Calculate Absent if not directly provided
    for (let i = 0; i < categories.length; i++) {
      const present = attendanceData.Present[i] || 0;
      const late = attendanceData.Late[i] || 0;
      attendanceData.Absent[i] = Math.max(0, totalStudents - present - late); // Ensure non-negative
    }

    res.json({
      totalStudents,
      period,
      categories,
      attendance: attendanceData
    });
  } catch (error) {
    console.error('Error in getStudentAttendance:', error);
    next(error);
  }
};

module.exports = { getStudentDashboard,getStudentDashboardData,getStudentAttendance };