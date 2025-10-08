// controllers/teacher/attendanceController.js
const mongoose = require('mongoose');
const TeacherAttendance = require('../../models/teacherAttendance');
const TeacherAbsence = require('../../models/teacherAbsence');
const Teacher = require('../../models/teacher');
const Holiday = require('../../models/holiday');
const APIError = require('../../utils/apiError');
const School = require('../../models/school');
const { calculateDistance } = require('../../utils/locationUtils');

exports.markAttendance = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { teacherId, date, status, leaveType, remarks, academicYearId,lat, lng } = req.body;
      const { schoolId, id: recordedBy } = req.user;

      if (!academicYearId) {
        throw new APIError('Academic year ID is required', 400);
      }
      if (!lat || !lng) {
        throw new APIError('Location coordinates are required', 400);
      }

      const attendanceDate = new Date(date);
      attendanceDate.setHours(0, 0, 0, 0);

      // Get current date in IST
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const istOffset = 5.5 * 60 * 60 * 1000;
      const todayIST = new Date(today.getTime() + istOffset);
      todayIST.setHours(0, 0, 0, 0);

      // Validate date
      if (attendanceDate > todayIST) {
        throw new APIError('Cannot mark attendance for a future date', 400);
      }

      if (!date || isNaN(attendanceDate.getTime())) {
        attendanceDate = todayIST;
      }

      // Get school's weekly holiday day
      const school = await School.findById(schoolId).session(session);
      if (!school) throw new APIError('School not found', 404);
      
      const weeklyHolidayDay = school.weeklyHolidayDay;
      const attendanceDay = attendanceDate.toLocaleDateString('en-US', { weekday: 'long' });

      if (attendanceDay === weeklyHolidayDay && status !== 'Holiday') {
        throw new APIError(`Cannot mark attendance on ${weeklyHolidayDay} unless status is Holiday`, 400);
      }

      // Check specific holiday
      const holiday = await Holiday.findOne({ schoolId, date: attendanceDate }).session(session);
      if (holiday && status !== 'Holiday') {
        throw new APIError('Cannot mark attendance on a holiday unless status is Holiday', 400);
      }
      console.log('kecking scholool latet', lat, lng, school.latitude, school.longitude)
      // GPS Validation: Check if within school premises
      const distance = calculateDistance(lat, lng, school.latitude, school.longitude);
      if (distance > school.radius) {
        throw new APIError('Cannot mark attendance outside school premises', 403);
      }

      // Check existing attendance
      const existingAttendance = await TeacherAttendance.findOne({ 
        teacherId, 
        date: attendanceDate 
      }).session(session);
      
      if (existingAttendance) {
        throw new APIError('Attendance already recorded for this date', 400);
      }

      // Handle absent/leave cases
      if (status === 'Absent' || status === 'On Leave') {
        const teacher = await Teacher.findById(teacherId).session(session);
        if (!teacher) throw new APIError('Teacher not found', 404);

        if (status === 'On Leave' && leaveType && leaveType !== 'Unpaid') {
          if (teacher.leaveBalance <= 0) {
            throw new APIError('No leave balance available', 400);
          }
          teacher.leaveBalance -= 1;
          await teacher.save({ session });
        }

        await TeacherAbsence.create(
          [{
            teacherId,
            schoolId,
            academicYearId,
            date: attendanceDate,
            reason: remarks || (status === 'Absent' ? 'Unplanned absence' : `${leaveType} leave`),
            status: status === 'On Leave' ? 'Pending' : 'Approved',
            leaveType: status === 'On Leave' ? leaveType : 'Unpaid'
          }],
          { session }
        );
      }

      // Create attendance record
      const attendance = await TeacherAttendance.create(
        [{
          teacherId,
          schoolId,
          academicYearId,
          date: attendanceDate,
          status,
          leaveType: status === 'On Leave' ? leaveType : null,
          remarks,
          recordedBy
        }],
        { session }
      );

      res.status(201).json({
        success: true,
        message: 'Attendance recorded successfully',
        data: attendance[0]
      });
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

exports.getAttendanceByTeacher = async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const { startDate, endDate, academicYearId } = req.query;
    const { schoolId } = req.user;

    if (!academicYearId) {
      throw new APIError('Academic year ID is required', 400);
    }

    let query = { 
      teacherId, 
      schoolId,
      academicYearId 
    };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const attendance = await TeacherAttendance.find(query)
      .populate('teacherId', 'name email')
      .sort({ date: -1 })
      .lean();

    res.json({
      success: true,
      count: attendance.length,
      data: attendance
    });
  } catch (error) {
    next(error);
  }
};

exports.getDailyAttendance = async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { date, academicYearId } = req.query;

    if (!academicYearId) {
      throw new APIError('Academic year ID is required', 400);
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Check holiday
    const holiday = await Holiday.findOne({ 
      schoolId, 
      date: attendanceDate 
    });
    
    if (holiday) {
      return res.json({
        success: true,
        message: 'This is a holiday',
        holiday: holiday,
        data: []
      });
    }

    const attendance = await TeacherAttendance.find({ 
      schoolId, 
      academicYearId,
      date: attendanceDate 
    })
      .populate('teacherId', 'name email')
      .lean();

    res.json({
      success: true,
      count: attendance.length,
      data: attendance
    });
  } catch (error) {
    next(error);
  }
};