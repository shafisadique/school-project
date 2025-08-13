const mongoose = require('mongoose');
const Student = require('../../models/student');
const Attendance = require('../../models/studentAttendance');
const Class = require('../../models/class');
const APIError = require('../../utils/apiError');

const getStudentAttendance = async (req, res, next) => {
  try {
    const { schoolId, activeAcademicYear: academicYearId } = req.user;
    console.log('req.user:', req.user); // Debug
    if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(academicYearId)) {
      throw new APIError('Invalid school ID or academic year ID', 400);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('Today:', today, 'School ID:', schoolId, 'Academic Year ID:', academicYearId); // Debug

    // Total students (school-wide or class-specific)
    const { classId } = req.query;
    let totalStudents = 0;
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      const classExists = await Class.findOne({
        _id: new mongoose.Types.ObjectId(classId),
        schoolId: new mongoose.Types.ObjectId(schoolId)
      });
      console.log('Class exists:', classExists); // Debug
      if (!classExists) throw new APIError('Class not found', 404);

      totalStudents = await Student.countDocuments({
        schoolId: new mongoose.Types.ObjectId(schoolId),
        academicYearId: new mongoose.Types.ObjectId(academicYearId),
        classId: new mongoose.Types.ObjectId(classId),
        status: true
      });
      console.log('Total students for class:', totalStudents); // Debug
    } else {
      totalStudents = await Student.countDocuments({
        schoolId: new mongoose.Types.ObjectId(schoolId),
        academicYearId: new mongoose.Types.ObjectId(academicYearId),
        status: true
      });
      console.log('Total students for school:', totalStudents); // Debug
    }

    // Overall attendance (school-wide)
    const overallAttendanceAgg = await Attendance.aggregate([
      {
        $match: {
          schoolId: new mongoose.Types.ObjectId(schoolId),
          academicYearId: new mongoose.Types.ObjectId(academicYearId),
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
    console.log('Overall attendance aggregation:', overallAttendanceAgg); // Debug

    const overallAttendance = { Present: 0, Absent: 0, Late: 0 };
    overallAttendanceAgg.forEach(item => {
      overallAttendance[item._id] = item.count;
    });

    // Class-specific attendance
    let classAttendance = [];
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      classAttendance = await Attendance.aggregate([
        {
          $match: {
            schoolId: new mongoose.Types.ObjectId(schoolId),
            academicYearId: new mongoose.Types.ObjectId(academicYearId),
            classId: new mongoose.Types.ObjectId(classId),
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
      console.log('Class attendance aggregation:', classAttendance); // Debug
    }

    const classAttendanceSummary = { Present: 0, Absent: 0, Late: 0 };
    classAttendance.forEach(item => {
      classAttendanceSummary[item._id] = item.count;
    });

    res.json({
      totalStudents,
      overallAttendance,
      classAttendance: classAttendanceSummary
    });
  } catch (error) {
    console.error('Error in getStudentAttendance:', error); // Debug
    next(error);
  }
};

module.exports = { getStudentAttendance };