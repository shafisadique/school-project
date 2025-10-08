const mongoose = require('mongoose');
const Student = require('../../models/student');
const Attendance = require('../../models/studentAttendance');
const Class = require('../../models/class');
const APIError = require('../../utils/apiError');
const moment = require('moment-timezone');

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
    const attendanceAgg = await Attendance.aggregate([
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

module.exports = { getStudentAttendance, getStudentDashboardData };