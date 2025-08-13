const mongoose = require('mongoose');
const Attendance = require('../../models/studentAttendance');
const Student = require('../../models/student');
const Subject = require('../../models/subject');
const APIError = require('../../utils/apiError');
const Class = require('../../models/class');
const School = require('../../models/school');
const Teacher = require('../../models/teacher');
const Holiday = require('../../models/holiday');

const markAttendance = async (req, res, next) => {
  try {
    const { classId, subjectId, date, students, academicYearId: academicYearIdFromBody } = req.body;
    const schoolId = req.user.schoolId;
    const userId = req.user.id;
    const academicYearId = req.user.activeAcademicYear || academicYearIdFromBody;

    if (!academicYearId || !classId || !subjectId || !date || !students?.length) {
      throw new APIError('Missing required fields: academicYearId, classId, subjectId, date, and students are required', 400);
    }

    const teacher = await Teacher.findOne({ userId }).select('_id');
    if (!teacher) throw new APIError('Teacher profile not found', 404);
    const teacherId = teacher._id.toString();

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

    const attendanceDate = new Date(date);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const today = new Date(new Date().getTime() + istOffset);
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfInput = new Date(attendanceDate.getFullYear(), attendanceDate.getMonth(), attendanceDate.getDate());

    if (startOfInput.getTime() !== startOfToday.getTime()) {
      throw new APIError('Attendance can only be marked for today\'s date', 400);
    }

    const startOfDay = new Date(startOfInput);
    const endOfDay = new Date(startOfInput);
    endOfDay.setHours(23, 59, 59, 999);

    const holiday = await Holiday.findOne({ schoolId, date: startOfDay }).lean();
    if (holiday) throw new APIError(`Cannot mark attendance on holiday: ${holiday.title}`, 400);

    const school = await School.findById(schoolId).select('weeklyHolidayDay');
    if (!school) throw new APIError('School not found', 404);
    const dayMap = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };
    const weeklyHolidayNum = dayMap[school.weeklyHolidayDay];
    if (startOfDay.getDay() === weeklyHolidayNum) {
      throw new APIError(`Cannot mark attendance on weekly holiday: ${school.weeklyHolidayDay}`, 400);
    }

    const existingAttendance = await Attendance.findOne({
      classId,
      subjectId,
      date: { $gte: startOfDay, $lte: endOfDay },
      schoolId
    }).lean();
    if (existingAttendance) {
      throw new APIError('Attendance already marked for this class, subject, and date', 400);
    }

    const classStudents = await Student.find({ classId, _id: { $in: students.map(s => s.studentId) } }).select('_id');
    if (classStudents.length !== students.length) {
      throw new APIError('Some students do not belong to this class', 400);
    }

    const attendance = new Attendance({
      classId,
      subjectId,
      teacherId,
      schoolId,
      academicYearId,
      date: startOfDay,
      students: students.map(student => ({
        studentId: student.studentId,
        status: student.status,
        remarks: student.remarks || ''
      }))
    });

    await attendance.save();
    res.status(201).json(attendance);
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

    console.log('Query params:', { classId, academicYearId, startDate, endDate, schoolId });

    if (!classId || !academicYearId) {
      throw new APIError('Class ID and Academic Year ID are required', 400);
    }

    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId }).select('_id');
      if (!teacher) {
        throw new APIError('Teacher profile not found', 404);
      }
      const teacherId = teacher._id.toString();
      const subjects = await Subject.find({
        schoolId,
        'teacherAssignments.teacherId': teacherId,
        'teacherAssignments.academicYearId': academicYearId,
      })
        .populate('classes', '_id')
        .lean();
      const classIds = subjects.flatMap(subject => subject.classes.map(cls => cls._id.toString()));
      console.log('Teacher class IDs:', classIds);
      if (!classIds.includes(classId)) {
        throw new APIError('You are not authorized to view attendance history for this class', 403);
      }
    }

    const query = {
      schoolId: new mongoose.Types.ObjectId(schoolId),
      classId: new mongoose.Types.ObjectId(classId),
      academicYearId: new mongoose.Types.ObjectId(academicYearId),
    };

    if (startDate && endDate) {
      const istOffset = 5.5 * 60 * 60 * 1000;
      query.date = {
        $gte: new Date(new Date(startDate).getTime() + istOffset),
        $lte: new Date(new Date(endDate).getTime() + istOffset)
      };
    }

    console.log('MongoDB query:', query);

    const attendanceRecords = await Attendance.find(query)
      .populate({
        path: 'students.studentId',
        select: 'name rollNo',
        model: 'Student'
      })
      .populate('classId', 'name')
      .populate('subjectId', 'name')
      .lean();

    console.log('Fetched records:', attendanceRecords.length);

    res.status(200).json(attendanceRecords);
  } catch (error) {
    console.error('Error in getAttendanceHistory:', error);
    next(error);
  }
};

module.exports = { markAttendance, editAttendance, getAttendanceHistory };