// controllers/adminDashboardController.js
const mongoose = require('mongoose');
const Student = require('../../models/student');
const Attendance = require('../../models/attendance');
const Class = require('../../models/class');
const APIError = require('../../utils/apiError');

const getStudentAttendance = async (req, res, next) => {
  try {
    const { schoolId, activeAcademicYear: academicYearId } = req.user;
    if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(academicYearId)) {
      throw new APIError('Invalid school ID or academic year ID', 400);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Total students
    const totalStudents = await Student.countDocuments({
      schoolId: new mongoose.Types.ObjectId(schoolId), // Use new keyword
      academicYearId: new mongoose.Types.ObjectId(academicYearId), // Use new keyword
      status: true
    });

    // Overall attendance
    const overallAttendanceAgg = await Attendance.aggregate([
      {
        $match: {
          schoolId: new mongoose.Types.ObjectId(schoolId), // Use new keyword
          academicYearId: new mongoose.Types.ObjectId(academicYearId), // Use new keyword
          date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
        }
      },
      { $unwind: '$students' },
      {
        $group: {
          _id: '$students.status',
          count: { $sum: 1 }
        }
      }
    ]);

    const overallAttendance = { Present: 0, Absent: 0, Late: 0 };
    overallAttendanceAgg.forEach(item => {
      overallAttendance[item._id] = item.count;
    });

    // Class-specific attendance
    let classAttendance = [];
    let classes = [];
    const { classId } = req.query;
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      const classExists = await Class.findOne({
        _id: new mongoose.Types.ObjectId(classId), // Use new keyword
        schoolId: new mongoose.Types.ObjectId(schoolId) // Use new keyword
      });
      if (!classExists) throw new APIError('Class not found', 404);

      classAttendance = await Attendance.aggregate([
        {
          $match: {
            schoolId: new mongoose.Types.ObjectId(schoolId), // Use new keyword
            academicYearId: new mongoose.Types.ObjectId(academicYearId), // Use new keyword
            classId: new mongoose.Types.ObjectId(classId), // Use new keyword
            date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
          }
        },
        { $unwind: '$students' },
        {
          $group: {
            _id: '$students.status',
            count: { $sum: 1 }
          }
        }
      ]);
    } else {
      classes = await Class.find({ schoolId: new mongoose.Types.ObjectId(schoolId) }).select('name _id'); // Use new keyword
    }

    const classAttendanceSummary = { Present: 0, Absent: 0, Late: 0 };
    classAttendance.forEach(item => {
      classAttendanceSummary[item._id] = item.count;
    });

    res.json({
      totalStudents,
      overallAttendance,
      classAttendance: classAttendanceSummary,
      classes
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getStudentAttendance };