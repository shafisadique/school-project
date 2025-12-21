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

// Add this new controller function to your attendanceControllers.js file
const getStudentMonthlyAttendance = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { academicYearId, year: yearParam, month: monthParam } = req.query;
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate required parameters
    if (!studentId || !academicYearId) {
      throw new APIError('Student ID and Academic Year ID are required', 400);
    }

    // Convert IDs to ObjectId
    if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(academicYearId) || !mongoose.Types.ObjectId.isValid(schoolId)) {
      throw new APIError('Invalid Student ID, Academic Year ID, or School ID', 400);
    }
    const objectIds = {
      studentId: new mongoose.Types.ObjectId(studentId),
      academicYearId: new mongoose.Types.ObjectId(academicYearId),
      schoolId: new mongoose.Types.ObjectId(schoolId)
    };

    // Default to current month/year if not provided
    const now = new Date();
    const year = parseInt(yearParam) || now.getFullYear();
    const month = parseInt(monthParam) || now.getMonth();  // 0-based

    // Validate month/year
    if (month < 0 || month > 11 || year < 1900 || year > 2100) {
      throw new APIError('Invalid month or year', 400);
    }

    // Role-based access (e.g., teacher/admin can view any; student/parent only own)
    let isAuthorized = false;
    if (userRole === 'admin' || userRole === 'teacher') {
      isAuthorized = true;  // Full access
    } else if (userRole === 'student' || userRole === 'parent') {
      // For student: must be their own ID (from user._id, assuming student userId links to profile)
      // For parent: check if student is linked to parent's children (you'd need a Parent model with children array)
      // Placeholder: assume student role checks userId === studentId; extend for parent
      if (userRole === 'student' && userId === studentId) {
        isAuthorized = true;
      }
      // TODO: For parent, query Parent.findOne({ userId }).children includes studentId
    }
    if (!isAuthorized) {
      throw new APIError('Unauthorized to view this student\'s attendance', 403);
    }

    // Month range: Start of month to end of month (UTC midnight for consistency)
    const monthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));  // Exclusive

    // Aggregation for daily attendance list (unwind students, match, project date & status)
    const dailyAttendance = await Attendance.aggregate([
      { $match: { 
          schoolId: objectIds.schoolId,
          academicYearId: objectIds.academicYearId,
          date: { $gte: monthStart, $lt: monthEnd }
        }
      },
      { $unwind: '$students' },
      { $match: { 'students.studentId': objectIds.studentId } },
      {
        $project: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },  // YYYY-MM-DD string
          status: '$students.status',
          _id: 0
        }
      },
      { $sort: { date: 1 } }  // Chronological order
    ]);

    // Aggregation for summary counts
    const summary = await Attendance.aggregate([
      { $match: { 
          schoolId: objectIds.schoolId,
          academicYearId: objectIds.academicYearId,
          date: { $gte: monthStart, $lt: monthEnd }
        }
      },
      { $unwind: '$students' },
      { $match: { 'students.studentId': objectIds.studentId } },
      {
        $group: {
          _id: '$students.status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Process summary into object (default 0s)
    const statusCounts = {
      Present: 0,
      Absent: 0,
      Late: 0
    };
    summary.forEach(item => {
      statusCounts[item._id] = item.count;
    });

    const totalWorkingDays = dailyAttendance.length;  // Assuming marked days = working days; extend with holidays if needed
    const totalPresent = statusCounts.Present;
    const totalAbsent = statusCounts.Absent;
    const totalLate = statusCounts.Late;
    const attendancePercentage = totalWorkingDays > 0 
      ? Math.round((totalPresent / totalWorkingDays) * 100) 
      : 0;

    // Response
    res.status(200).json({
      success: true,
      data: {
        studentId,
        academicYearId,
        year,
        month: month + 1,  // 1-based for display
        monthlyReport: {
          dailyAttendance,  // Array of { date: '2025-12-05', status: 'Present' }
          summary: {
            totalWorkingDays,
            totalPresent,
            totalAbsent,
            totalLate,
            attendancePercentage
          }
        }
      }
    });

  } catch (error) {
    console.error('Error in getStudentMonthlyAttendance:', error);
    next(error instanceof APIError ? error : new APIError('Internal server error', 500, error));
  }
};

// controllers/attendance.controller.ts

const getStudentAttendanceReport = async (req, res) => {
  try {
    const studentId = req.user.additionalInfo?.studentId?.toString();
    const academicYearId = req.user.activeAcademicYear;

    if (!studentId || !academicYearId) {
      return res.status(400).json({ success: false, message: 'Missing student or year' });
    }

    const records = await Attendance.find({
      schoolId: req.user.schoolId,
      academicYearId,
      'students.studentId': new mongoose.Types.ObjectId(studentId)
    }).lean();

    console.log(`Found ${records.length} records for student ${studentId}`);

    const summary = { present: 0, absent: 0, late: 0, totalDays: 0 };
    const dailyData = {};

    records.forEach(record => {
      const entry = record.students.find(s => 
        s.studentId.toString() === studentId
      );

      if (entry) {
        const status = entry.status;
        const key = status.toLowerCase();
        if (['present', 'absent', 'late'].includes(key)) {
          summary[key]++;
        }
        summary.totalDays++;

        dailyData[new Date(record.date).toISOString().split('T')[0]] = status;
      }
    });

    const percentage = summary.totalDays > 0
      ? Math.round((summary.present / summary.totalDays) * 100)
      : 0;

    return res.json({
      success: true,
      data: {
        summary: { ...summary, percentage },
        dailyData,
        totalRecords: records.length
      }
    });

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


module.exports = { markAttendance, editAttendance, getAttendanceHistory,getStudentMonthlyAttendance,getStudentAttendanceReport };