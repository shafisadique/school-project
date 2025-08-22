const mongoose = require('mongoose');
const Student = require('../../models/student');
const Attendance = require('../../models/studentAttendance');
const Class = require('../../models/class');
const APIError = require('../../utils/apiError');

const getStudentAttendance = async (req, res, next) => {
  try {
    const { schoolId, activeAcademicYear: academicYearId, role, teacherId } = req.user;
    if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(academicYearId)) {
      throw new APIError('Invalid school ID or academic year ID', 400);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log('Today:', today, 'School ID:', schoolId, 'Academic Year ID:', academicYearId, 'Role:', role, 'Teacher ID:', teacherId); // Debug

    // Total students (school-wide for admin, teacher-specific for teacher)
    const { classId } = req.query;
    let totalStudents = 0;
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      const classExists = await Class.findOne({
        _id: new mongoose.Types.ObjectId(classId),
        schoolId: new mongoose.Types.ObjectId(schoolId)
      });
      console.log('Class exists:', classExists); // Debug
      if (!classExists) throw new APIError('Class not found', 404);

      if (role === 'teacher' && teacherId) {
        // For teachers, count only students assigned to their classes
        totalStudents = await Student.countDocuments({
          schoolId: new mongoose.Types.ObjectId(schoolId),
          academicYearId: new mongoose.Types.ObjectId(academicYearId),
          classId: new mongoose.Types.ObjectId(classId),
          status: true,
          assignedTeacherId: new mongoose.Types.ObjectId(teacherId) // Adjust field name if different
        });
      } else {
        // For admin, count all students in the class
        totalStudents = await Student.countDocuments({
          schoolId: new mongoose.Types.ObjectId(schoolId),
          academicYearId: new mongoose.Types.ObjectId(academicYearId),
          classId: new mongoose.Types.ObjectId(classId),
          status: true
        });
      }
    } else {
      if (role === 'teacher' && teacherId) {
        // For teachers, count students across all their assigned classes
        totalStudents = await Student.countDocuments({
          schoolId: new mongoose.Types.ObjectId(schoolId),
          academicYearId: new mongoose.Types.ObjectId(academicYearId),
          status: true,
          assignedTeacherId: new mongoose.Types.ObjectId(teacherId) // Adjust field name if different
        });
      } else {
        // For admin, count all students school-wide
        totalStudents = await Student.countDocuments({
          schoolId: new mongoose.Types.ObjectId(schoolId),
          academicYearId: new mongoose.Types.ObjectId(academicYearId),
          status: true
        });
      }
    }

    // Overall attendance (school-wide for admin, teacher-specific for teacher)
    let attendanceMatch = {
      schoolId: new mongoose.Types.ObjectId(schoolId),
      academicYearId: new mongoose.Types.ObjectId(academicYearId),
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    };
    if (role === 'teacher' && teacherId) {
      attendanceMatch.teacherId = new mongoose.Types.ObjectId(teacherId); // Filter by teacher's attendance records
    }
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      attendanceMatch.classId = new mongoose.Types.ObjectId(classId);
    }

    const overallAttendanceAgg = await Attendance.aggregate([
      { $match: attendanceMatch },
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

    // Class-specific attendance (filtered by teacher if applicable)
    let classAttendance = [];
    if (classId && mongoose.Types.ObjectId.isValid(classId)) {
      const classAttendanceMatch = {
        ...attendanceMatch,
        classId: new mongoose.Types.ObjectId(classId)
      };
      classAttendance = await Attendance.aggregate([
        { $match: classAttendanceMatch },
        { $unwind: '$students' },
        {
          $group: {
            _id: '$students.status',
            count: { $sum: 1 }
          }
        }
      ]);
    }

    const classAttendanceSummary = { Present: 0, Absent: 0, Late: 0 };
    classAttendance.forEach(item => {
      classAttendanceSummary[item._id] = item.count;
    });

    // Calculate Absent based on totalStudents minus Present
    const attendanceToUse = classId ? classAttendanceSummary : overallAttendance;
    const absentCount = totalStudents - (attendanceToUse.Present || 0);

    res.json({
      totalStudents,
      overallAttendance: {
        ...overallAttendance,
        Absent: absentCount
      },
      classAttendance: {
        ...classAttendanceSummary,
        Absent: absentCount
      }
    });
  } catch (error) {
    console.error('Error in getStudentAttendance:', error); // Debug
    next(error);
  }
};

module.exports = { getStudentAttendance };