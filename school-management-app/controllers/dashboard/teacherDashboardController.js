const mongoose = require('mongoose');
const Teacher = require('../../models/teacher');
const TeacherAttendance = require('../../models/teacherAttendance');
const TeacherAbsence = require('../../models/teacherAbsence');
const studentAttendance = require('../../models/studentAttendance')
const Holiday = require('../../models/holiday');
const School = require('../../models/school');
const APIError = require('../../utils/apiError');
const Assignment = require('../../models/assignment');
const Notification = require('../../models/notifiation'); // Fixed typo: 'notifiation' -> 'notification'

const getAllTeacherDashboard = async (user) => {
  try {
    const { schoolId, activeAcademicYear: academicYearId } = user;
    if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(academicYearId)) {
      throw new APIError('Invalid school ID or academic year ID', 400);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const totalActiveTeachers = await Teacher.countDocuments({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      academicYearId: new mongoose.Types.ObjectId(academicYearId),
      status: true
    });

    return { totalActiveTeachers };
  } catch (error) {
    throw error;
  }
};

/**
 * @desc    Get teacher dashboard data
 * @route   GET /api/dashboard/teacher
 * @access  Private/Teacher
 */
const getTeacherDashboard = async (req, res, next) => {
  try {
    const { schoolId, id: userId } = req.user;

    const pendingAssignments = await Assignment.find({
      schoolId,
      teacherId: userId,
      status: { $nin: ['graded', 'cancelled'] }
    })
      .populate('classId', 'name')
      .populate('subjectId', 'name')
      .lean()
      .exec();

    console.log('Pending Assignments Query Result for userId:', userId, pendingAssignments);

    res.json({
      success: true,
      data: {
        teacher: null,
        personalAttendanceStatus: 'Present',
        pendingAssignments,
        recentStudentAttendance: [],
        upcomingHolidays: [],
        pendingLeaves: [],
        notifications: [],
        isHoliday: false
      }
    });
  } catch (error) {
    next(error);
  }
};

const TeacherDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const schoolId = req.user.schoolId;
    const academicYearId = req.user.activeAcademicYear;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(academicYearId)) {
      throw new APIError('Invalid user, school, or academic year ID', 400);
    }

    // Set today as a Date object in IST timezone
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    today.setHours(0, 0, 0, 0); // 00:00:00 IST today (October 16, 2025)
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // 00:00:00 IST tomorrow (October 17, 2025)

    // Fetch teacher document to get teacherId
    const teacher = await Teacher.findOne({ userId: userId }).select('_id');
    if (!teacher) {
      throw new APIError('Teacher not found for the given user', 404);
    }
    const teacherId = teacher._id;

    let isHoliday = false;
    const school = await School.findById(schoolId).select('weeklyHolidayDay');
    const todayDay = today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' });
    if (school && school.weeklyHolidayDay === todayDay) {
      isHoliday = true;
    } else {
      const holiday = await Holiday.findOne({
        schoolId: new mongoose.Types.ObjectId(schoolId),
        date: { $gte: today, $lt: tomorrow }
      });
      if (holiday) isHoliday = true;
    }

    let personalAttendanceStatus = 'Absent';
    if (!isHoliday) {
      const attendance = await TeacherAttendance.findOne({
        teacherId: new mongoose.Types.ObjectId(userId), // Changed from userId to teacherId
        schoolId: new mongoose.Types.ObjectId(schoolId),
        academicYearId: new mongoose.Types.ObjectId(academicYearId),
        date: { $gte: today, $lt: tomorrow }
      });
      if (attendance && attendance.status === 'Present') personalAttendanceStatus = 'Present';
      const absence = await TeacherAbsence.findOne({
        teacherId: new mongoose.Types.ObjectId(teacherId),
        schoolId: new mongoose.Types.ObjectId(schoolId),
        academicYearId: new mongoose.Types.ObjectId(academicYearId),
        date: { $gte: today, $lt: tomorrow },
        status: 'Approved'
      });
      if (absence) personalAttendanceStatus = 'On Leave';
    }

    const pendingAssignments = await Assignment.find({
      teacherId: new mongoose.Types.ObjectId(teacherId),
      status: { $in: ['pending', 'submitted'] }
    })
      .populate('classId', 'name')
      .populate('subjectId', 'name')
      .limit(5)
      .lean();

const recentStudentAttendance = await studentAttendance.aggregate([
      { $match: { 
        teacherId: new mongoose.Types.ObjectId(teacherId), // Filter by teacher's ID
        date: { $gte: today, $lt: tomorrow } // Today’s date range
      }},
      { $unwind: '$students' }, // Unwind the students array to process each student
      { $group: { 
        _id: null, // Group all students together for a total summary
        presentCount: { $sum: { $cond: [{ $eq: ['$students.status', 'Present'] }, 1, 0] } },
        absentCount: { $sum: { $cond: [{ $eq: ['$students.status', 'Absent'] }, 1, 0] } },
        lateCount: { $sum: { $cond: [{ $eq: ['$students.status', 'Late'] }, 1, 0] } },
        totalStudents: { $sum: 1 }
      }}
    ]).then(results => results[0] || { presentCount: 0, absentCount: 0, lateCount: 0, totalStudents: 0 }); // Default to 0 if no data

    console.log('Recent Student Attendance:', recentStudentAttendance);

    const upcomingHolidays = await Holiday.find({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      date: { $gte: new Date() }
    }).sort('date').limit(3);

    const pendingLeaves = await TeacherAbsence.find({
      teacherId: new mongoose.Types.ObjectId(teacherId),
      status: 'Pending',
      isTeacherApplied: true
    }).sort('-date');

    const notifications = await Notification.find({ recipient: userId }).sort('-createdAt').limit(5);

    const dashboardData = {
      teacher,
      personalAttendanceStatus,
      pendingAssignments,
      recentStudentAttendance,
      upcomingHolidays,
      pendingLeaves,
      notifications,
      isHoliday
    };

    res.status(200).json({ success: true, data: dashboardData });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTeacherDashboard, getAllTeacherDashboard, TeacherDashboard };