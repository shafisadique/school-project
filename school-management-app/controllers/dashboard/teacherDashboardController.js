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

    // Today's date range (midnight to midnight) in IST
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Total active teachers
    const totalActiveTeachers = await Teacher.countDocuments({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      academicYearId: new mongoose.Types.ObjectId(academicYearId),
      status: true
    });

    // Get all teacherIds who are active
    const activeTeachers = await Teacher.find({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      academicYearId: new mongoose.Types.ObjectId(academicYearId),
      status: true
    }).select('_id');

    const activeTeacherIds = activeTeachers.map(t => t._id);

    // Find teachers marked Present today
    const presentToday = await TeacherAttendance.countDocuments({
      teacherId: { $in: activeTeacherIds },
      schoolId: new mongoose.Types.ObjectId(schoolId),
      academicYearId: new mongoose.Types.ObjectId(academicYearId),
      date: { $gte: today, $lt: tomorrow },
      status: 'Present'
    });

    // Find teachers on Approved Leave today
    const onLeaveToday = await TeacherAbsence.countDocuments({
      teacherId: { $in: activeTeacherIds },
      schoolId: new mongoose.Types.ObjectId(schoolId),
      academicYearId: new mongoose.Types.ObjectId(academicYearId),
      date: { $gte: today, $lt: tomorrow },
      status: 'Approved'
    });

    // Absent = Total Active - (Present + On Leave)
    const absentToday = totalActiveTeachers - (presentToday + onLeaveToday);

    return {
      totalActiveTeachers,
      presentToday,
      absentToday,
      onLeaveToday
    };

  } catch (error) {
    throw error;
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
const getTeacherDashboard = async (req, res, next) => {
  try {
    const { schoolId, activeAcademicYear: academicYearId } = req.user;

    // Today at 00:00:00 IST
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if today is holiday
    const holiday = await Holiday.findOne({
      schoolId,
      date: { $gte: today, $lt: tomorrow }
    });

    if (holiday) {
      return res.json({
        totalTeachers: 0,
        presentToday: 0,
        absentToday: 0,
        onLeaveToday: 0,
        isHoliday: true,
        message: 'Today is a holiday'
      });
    }

    // Get all active teachers
    const teachers = await Teacher.find({
      schoolId,
      academicYearId,
      status: true
    }).select('_id');

    const teacherIds = teachers.map(t => t._id);
    const totalTeachers = teachers.length;

    if (totalTeachers === 0) {
      return res.json({
        totalTeachers: 0,
        presentToday: 0,
        absentToday: 0,
        onLeaveToday: 0,
        isHoliday: false
      });
    }

    // Count Present
    const presentToday = await TeacherAttendance.countDocuments({
      teacherId: { $in: teacherIds },
      schoolId,
      academicYearId,
      date: { $gte: today, $lt: tomorrow },
      status: 'Present'
    });

    // Count On Leave (Approved)
    const onLeaveToday = await TeacherAbsence.countDocuments({
      teacherId: { $in: teacherIds },
      schoolId,
      academicYearId,
      date: { $gte: today, $lt: tomorrow },
      status: 'Approved'
    });

    const absentToday = totalTeachers - presentToday - onLeaveToday;

    res.json({
      totalTeachers,
      presentToday,
      absentToday,
      onLeaveToday,
      isHoliday: false,
      pendingLeaveRequests: await TeacherAbsence.countDocuments({
        schoolId,
        academicYearId,
        status: 'Pending'
      })
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { getTeacherDashboard, getAllTeacherDashboard, TeacherDashboard };