const mongoose = require('mongoose');
const Attendance = require('../../models/studentAttendance');
const Student = require('../../models/student');
const Subject = require('../../models/subject');
const APIError = require('../../utils/apiError');
const Class = require('../../models/class');
const School = require('../../models/school');
const Teacher = require('../../models/teacher');
const Holiday = require('../../models/holiday');
const classSubjectAssignment = require('../../models/classSubjectAssignment');

const markAttendance = async (req, res, next) => {
  try {
    const { 
      classId, 
      subjectId, 
      date, 
      students, 
      academicYearId: academicYearIdFromBody,
      location 
    } = req.body;

    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const academicYearId = req.user.activeAcademicYear || academicYearIdFromBody;

    // === 1. Validation ===
    if (!academicYearId || !classId || !subjectId || !date || !students?.length) {
      throw new APIError('Missing required fields', 400);
    }

    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      throw new APIError('Teacher location (latitude & longitude) is required', 400);
    }

    const teacher = await Teacher.findOne({ userId }).select('_id');
    if (!teacher) throw new APIError('Teacher profile not found', 404);
    const teacherId = teacher._id.toString();

    // === 2. Authorization Check ===
    const classData = await Class.findById(classId)
      .populate('attendanceTeacher', '_id')
      .populate('substituteAttendanceTeachers', '_id');
    if (!classData) throw new APIError('Class not found', 404);

    const isSubjectTeacher = await Subject.exists({
      _id: subjectId,
      'teacherAssignments.teacherId': teacherId,
      'teacherAssignments.academicYearId': academicYearId,
      classes: classId
    });

    const isAttendanceTeacher = classData.attendanceTeacher?._id.toString() === teacherId;
    const isSubstituteTeacher = classData.substituteAttendanceTeachers.some(t => t._id.toString() === teacherId);

    if (!isSubjectTeacher && !isAttendanceTeacher && !isSubstituteTeacher) {
      throw new APIError('Not authorized to mark attendance for this class/subject', 403);
    }

    // === 3. School Timing + Geolocation Check ===
    const school = await School.findById(schoolId).select('schoolTiming latitude longitude radius weeklyHolidayDay');
    if (!school) throw new APIError('School not found', 404);

    // SAFE: Handle missing or partial schoolTiming
    const schoolTiming = school.schoolTiming || {};
    const openingTime = schoolTiming.openingTime || '08:00';
    const closingTime = schoolTiming.closingTime || '14:00';
    const weeklyHolidayDay = school.weeklyHolidayDay || 'Sunday';

    const [openHour, openMinute] = openingTime.split(':').map(Number);
    const [closeHour, closeMinute] = closingTime.split(':').map(Number);

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);

    const todayStr = istNow.toISOString().split('T')[0];
    if (date !== todayStr) {
      throw new APIError('Attendance can only be marked for today', 400);
    }

    // Check time window
    const currentHour = istNow.getHours();
    const currentMinute = istNow.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const openTimeInMinutes = openHour * 60 + openMinute;
    const closeTimeInMinutes = closeHour * 60 + closeMinute;

    if (currentTimeInMinutes < openTimeInMinutes || currentTimeInMinutes > closeTimeInMinutes) {
      throw new APIError(
        `Attendance can only be marked between ${openingTime} and ${closingTime} school hours`,
        403
      );
    }

    // === 4. Geofencing Check ===
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      school.latitude,
      school.longitude
    );

    if (distance > school.radius) {
      throw new APIError(
        `You are ${Math.round(distance)}m away from school. Must be within ${school.radius}m radius.`,
        403
      );
    }

    // === 5. Holiday & Weekly Off Check ===
    const attendanceDate = new Date(date);
    const startOfDay = new Date(attendanceDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(attendanceDate);
    endOfDay.setHours(23, 59, 59, 999);

    const holiday = await Holiday.findOne({ 
      schoolId, 
      date: { $gte: startOfDay, $lte: endOfDay } 
    });
    if (holiday) {
      throw new APIError(`Cannot mark attendance on holiday: ${holiday.title}`, 400);
    }

    // Safe weekly holiday check
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][startOfDay.getDay()];
    if (dayName === weeklyHolidayDay) {
      throw new APIError(`Today is weekly holiday: ${weeklyHolidayDay}`, 400);
    }

    // === 6. Prevent Duplicate ===
    const existing = await Attendance.findOne({
      schoolId,
      classId,
      subjectId,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (existing) {
      throw new APIError('Attendance already marked for this class & subject today', 400);
    }

    // === 7. Validate Students ===
    const validStudentIds = await Student.find({ classId, _id: { $in: students.map(s => s.studentId) } })
      .select('_id')
      .lean();

    if (validStudentIds.length !== students.length) {
      throw new APIError('Some students do not belong to this class', 400);
    }

    // === 8. Save Attendance ===
    const attendance = new Attendance({
      schoolId,
      classId,
      subjectId,
      teacherId,
      academicYearId,
      date: startOfDay,
      students: students.map(s => ({
        studentId: s.studentId,
        status: s.status || 'Present',
        remarks: s.remarks || ''
      }))
    });

    await attendance.save();

    res.status(201).json({
      message: 'Attendance marked successfully',
      attendance
    });

  } catch (error) {
    next(error);
  }
};

const editAttendance = async (req, res, next) => {
  try {
    const { attendanceId } = req.params;
    const { students, academicYearId: academicYearIdFromBody } = req.body;
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const academicYearId = req.user.activeAcademicYear || academicYearIdFromBody;

    if (!attendanceId || !students?.length || !academicYearId) {
      throw new APIError('Missing required fields: attendanceId, students, and academicYearId are required', 400);
    }

    const teacher = await Teacher.findOne({ userId }).select('_id');
    if (!teacher) throw new APIError('Teacher profile not found', 404);
    const teacherId = teacher._id.toString();

    const attendance = await Attendance.findById(attendanceId).lean();
    if (!attendance) throw new APIError('Attendance record not found', 404);

    const classData = await Class.findById(attendance.classId)
      .populate('attendanceTeacher', '_id')
      .populate('substituteAttendanceTeachers', '_id');
    if (!classData) throw new APIError('Class not found', 404);

    const isSubjectTeacher = await Subject.exists({
      _id: attendance.subjectId,
      'teacherAssignments.teacherId': teacherId,
      'teacherAssignments.academicYearId': academicYearId,
      classes: attendance.classId
    });
    const isAttendanceTeacher = classData.attendanceTeacher?._id.toString() === teacherId;
    const isSubstituteTeacher = classData.substituteAttendanceTeachers.some(t => t._id.toString() === teacherId);
    if (!isSubjectTeacher && !isAttendanceTeacher && !isSubstituteTeacher) {
      throw new APIError('Not authorized to edit attendance for this class/subject', 403);
    }

    const attendanceDate = new Date(attendance.date);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const today = new Date(new Date().getTime() + istOffset);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (attendanceDate.getTime() !== startOfToday.getTime()) {
      throw new APIError('Can only edit attendance for today\'s date', 400);
    }

    const classStudents = await Student.find({
      classId: attendance.classId,
      _id: { $in: students.map(s => s.studentId) }
    }).select('_id');
    if (classStudents.length !== students.length) {
      throw new APIError('Some students do not belong to this class', 400);
    }

    const updatedAttendance = await Attendance.findByIdAndUpdate(
      attendanceId,
      {
        $set: {
          students: students.map(student => ({
            studentId: student.studentId,
            status: student.status,
            remarks: student.remarks || ''
          })),
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (!updatedAttendance) throw new APIError('Failed to update attendance', 500);

    res.status(200).json(updatedAttendance);
  } catch (error) {
    next(error);
  }
};

const getAttendanceHistory = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { academicYearId, startDate, endDate } = req.query;
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log('Query params:', { classId, academicYearId, startDate, endDate, schoolId, userRole });

    // Validate required parameters
    if (!classId || !academicYearId) {
      throw new APIError('Class ID and Academic Year ID are required', 400);
    }

    // Convert IDs to ObjectId with validation
    const objectIdParams = { classId, academicYearId, schoolId };
    Object.keys(objectIdParams).forEach(key => {
      if (!mongoose.Types.ObjectId.isValid(objectIdParams[key])) {
        throw new APIError(`${key} is not a valid ObjectId`, 400);
      }
      objectIdParams[key] = new mongoose.Types.ObjectId(objectIdParams[key]);
    });

    let query = {
      schoolId: objectIdParams.schoolId,
      academicYearId: objectIdParams.academicYearId,
    };

    // Handle role-based access
    if (userRole === 'teacher') {
      const teacher = await Teacher.findOne({ userId }).select('_id');
      if (!teacher) throw new APIError('Teacher profile not found', 404);
      const teacherId = teacher._id.toString();

      // Fetch classes where the teacher is assigned via ClassSubjectAssignment
      const assignments = await classSubjectAssignment.find({
        schoolId: objectIdParams.schoolId,
        teacherId: teacherId,
        academicYearId: objectIdParams.academicYearId,
      })
        .select('classId')
        .lean();

      const classIds = assignments.map(assignment => assignment.classId.toString());
      console.log('Teacher authorized class IDs:', classIds);

      if (!classIds.includes(classId)) {
        throw new APIError('You are not authorized to view attendance history for this class', 403);
      }
      query.classId = objectIdParams.classId; // Restrict to the specific class
    } else if (userRole === 'admin') {
      // Admin can view all classes
      if (classId) query.classId = objectIdParams.classId; // Optional class filter for admin
    } else {
      throw new APIError('Unauthorized role', 403);
    }

    // Handle date range
    if (startDate && endDate) {
      const istOffset = 5.5 * 60 * 60 * 1000;
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new APIError('Invalid startDate or endDate format', 400);
      }
      query.date = {
        $gte: new Date(start.getTime() + istOffset),
        $lte: new Date(end.getTime() + istOffset + 86399999), // End of day
      };
    }

    const attendanceRecords = await Attendance.find(query)
      .populate({
        path: 'students.studentId',
        select: 'name rollNo',
        model: 'Student',
      })
      .populate('classId', 'name')
      .populate('subjectId', 'name')
      .lean();

    console.log('Fetched records:', attendanceRecords.length);

    res.status(200).json(attendanceRecords);
  } catch (error) {
    console.error('Error in getAttendanceHistory:', error);
    next(error instanceof APIError ? error : new APIError('Internal server error', 500, error));
  }
};

module.exports = { markAttendance, editAttendance, getAttendanceHistory };