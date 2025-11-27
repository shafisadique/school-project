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
const { calculateDistance } = require('../../utils/locationUtils');

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

    if (!academicYearId || !classId || !subjectId || !date || !students?.length) {
      throw new APIError('Missing required fields', 400);
    }
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      throw new APIError('Location required', 400);
    }

    const teacher = await Teacher.findOne({ userId }).select('_id');
    if (!teacher) throw new APIError('Teacher not found', 404);

    // GET SCHOOL
    const school = await School.findById(schoolId)
      .select('schoolTiming weeklyHolidayDay radius latitude longitude')
      .lean();

    if (!school) throw new APIError('School not found', 404);

    const allowedRadius = school.radius || 1000;

    // GEOFENCING — SMART
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      school.latitude,
      school.longitude
    );

    // If distance > 50km → fake WiFi/laptop GPS → ALLOW (teacher is in school)
    if (distance > 50000) {
      console.log(`Student Attendance: Fake GPS (${Math.round(distance/1000)}km) → allowed`);
    } else if (distance > allowedRadius) {
      return res.status(403).json({
        success: false,
        message: `Too far: ${Math.round(distance)}m from school (max ${allowedRadius}m)`,
        yourLocation: location,
        schoolLocation: { lat: school.latitude, lng: school.longitude }
      });
    }

    // TIMING CHECK — CORRECT IST
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotal = currentHour * 60 + currentMinute;

    const opening = (school.schoolTiming?.openingTime || '08:00').trim();
    const closing = (school.schoolTiming?.closingTime || '14:00').trim();

    const [openH, openM] = opening.split(':').map(Number);
    const [closeH, closeM] = closing.split(':').map(Number);

    const openTotal = openH * 60 + openM;
    const closeTotal = closeH * 60 + closeM;

    if (currentTotal < openTotal || currentTotal > closeTotal) {
      return res.status(400).json({
        success: false,
        message: `Attendance only allowed ${opening} - ${closing}`,
        currentTime: now.toLocaleTimeString('en-IN')
      });
    }

    // DATE PARSING
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // HOLIDAY CHECK
    const holiday = await Holiday.findOne({
      schoolId,
      date: { $gte: attendanceDate, $lt: new Date(attendanceDate.getTime() + 24*60*60*1000) }
    });
    if (holiday) throw new APIError('Holiday today', 400);

    // WEEKLY HOLIDAY
    const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][attendanceDate.getUTCDay()];
    if (dayName === (school.weeklyHolidayDay || 'Sunday')) {
      throw new APIError('Weekly holiday', 400);
    }

    // DUPLICATE CHECK
    const existing = await Attendance.findOne({
      schoolId, classId, subjectId,
      date: attendanceDate
    });
    if (existing) throw new APIError('Already marked today', 400);

    // SAVE
    const attendance = await Attendance.create({
      schoolId, classId, subjectId,
      teacherId: teacher._id,
      academicYearId, date: attendanceDate,
      students: students.map(s => ({
        studentId: s.studentId,
        status: s.status || 'Present'
      }))
    });

    res.status(201).json({
      success: true,
      message: 'Student attendance marked!',
      currentTime: now.toLocaleTimeString('en-IN'),
      distance: Math.round(distance) + 'm',
      usedSchoolLocation: distance > 50000
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