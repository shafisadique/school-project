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


const getMonthlyAttendance = async (teacherId, academicYearId, schoolId) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Get teacher with createdAt (jo already hai!)
    const teacher = await Teacher.findById(teacherId).select('createdAt name');
    if (!teacher) {
      console.log('Teacher not found:', teacherId);
      return {};
    }

    // createdAt ko joining date maan lo
    const joinDate = new Date(teacher.createdAt);
    joinDate.setHours(0, 0, 0, 0);

    // Attendance records
    const records = await TeacherAttendance.find({
      teacherId,
      schoolId,
      academicYearId,
      date: { 
        $gte: new Date(year, month, 1), 
        $lte: new Date(year, month + 1, 0, 23, 59, 59, 999)
      }
    }).select('date status').lean();

    // Holidays
    const holidays = await Holiday.find({
      schoolId,
      date: { $gte: new Date(year, month, 1), $lte: new Date(year, month + 1, 0) }
    }).lean();

    const holidayDates = new Set(
      holidays.map(h => {
        const d = new Date(h.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    );

    // Weekly holiday
    const school = await School.findById(schoolId).select('weeklyHolidayDay');
    const weeklyHoliday = school?.weeklyHolidayDay || 'Sunday';

    const map = {};

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      currentDate.setHours(0, 0, 0, 0);
      const timestamp = currentDate.getTime();
      const dayName = currentDate.toLocaleString('en-US', { weekday: 'long' });

      // Agar teacher isse pehle join nahi hua tha → skip (ya Absent mat dikhao)
      if (currentDate < joinDate) {
        continue; // ya map[day] = 'Not Joined' rakh sakte ho
      }

      // Holiday ya Weekly Holiday
      if (holidayDates.has(timestamp) || dayName === weeklyHoliday) {
        map[day] = 'Holiday';
        continue;
      }

      // Future date → ignore
      if (currentDate > now) {
        continue;
      }

      // Attendance record?
      const record = records.find(r => {
        const rd = new Date(r.date);
        rd.setHours(0, 0, 0, 0);
        return rd.getTime() === timestamp;
      });

      map[day] = record ? record.status : 'Absent';
    }

    console.log('Monthly Attendance Map:', map); // Debug ke liye
    return map;

  } catch (err) {
    console.error('getMonthlyAttendance error:', err);
    return {};
  }
};

// ==================== TeacherDashboard ====================
const TeacherDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const schoolId = req.user.schoolId;
    const academicYearId = req.user.activeAcademicYear;

    // Validation
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(academicYearId)) {
      throw new APIError('Invalid user, school, or academic year ID', 400);
    }

    // Today in IST
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get teacher document
    const teacher = await Teacher.findOne({ userId }).select('_id name');
    if (!teacher) throw new APIError('Teacher not found', 404);
    const teacherId = teacher._id;

    // Holiday check
    let isHoliday = false;
    const school = await School.findById(schoolId).select('weeklyHolidayDay');
    const todayDayName = today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' });
    if (school?.weeklyHolidayDay === todayDayName) {
      isHoliday = true;
    } else {
      const holiday = await Holiday.findOne({ schoolId, date: { $gte: today, $lt: tomorrow } });
      if (holiday) isHoliday = true;
    }

    // Personal attendance status
    let personalAttendanceStatus = 'Absent';
    if (!isHoliday) {
      const att = await TeacherAttendance.findOne({
        teacherId,
        schoolId,
        academicYearId,
        date: { $gte: today, $lt: tomorrow }
      });

      if (att?.status === 'Present') personalAttendanceStatus = 'Present';

      const leave = await TeacherAbsence.findOne({
        teacherId,
        schoolId,
        academicYearId,
        date: { $gte: today, $lt: tomorrow },
        status: 'Approved'
      });

      if (leave) personalAttendanceStatus = 'On Leave';
    }

    // MONTHLY ATTENDANCE — AB YE KAM KAREGA!
    const monthlyTeacherAttendance = await getMonthlyAttendance(teacherId, academicYearId, schoolId);

    // Other data
    const pendingAssignments = await Assignment.find({
      teacherId,
      status: { $in: ['pending', 'submitted'] }
    }).populate('classId', 'name').populate('subjectId', 'name').limit(5).lean();

    const recentStudentAttendance = await studentAttendance.aggregate([
      { $match: { teacherId, date: { $gte: today, $lt: tomorrow } } },
      { $unwind: '$students' },
      { $group: {
          _id: null,
          presentCount: { $sum: { $cond: [{ $eq: ['$students.status', 'Present'] }, 1, 0] } },
          absentCount: { $sum: { $cond: [{ $eq: ['$students.status', 'Absent'] }, 1, 0] } },
          lateCount: { $sum: { $cond: [{ $eq: ['$students.status', 'Late'] }, 1, 0] } },
          totalStudents: { $sum: 1 }
      }}
    ]).then(r => r[0] || { presentCount: 0, absentCount: 0, lateCount: 0, totalStudents: 0 });

    const upcomingHolidays = await Holiday.find({ schoolId, date: { $gte: new Date() } }).sort('date').limit(3);
    const pendingLeaves = await TeacherAbsence.find({ teacherId, status: 'Pending', isTeacherApplied: true }).sort('-date');

    // FINAL RESPONSE
    res.status(200).json({
      success: true,
      data: {
        teacher,
        personalAttendanceStatus,
        pendingAssignments,
        recentStudentAttendance,
        upcomingHolidays,
        pendingLeaves,
        isHoliday,
        monthlyTeacherAttendance   // YE AB AAYEGA!
      }
    });

  } catch (error) {
    console.error('TeacherDashboard Error:', error);
    next(error);
  }
};

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