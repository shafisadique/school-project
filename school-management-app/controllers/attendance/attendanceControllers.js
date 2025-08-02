  const Attendance = require('../../models/attendance');
  const Student = require('../../models/student');
  const Subject = require('../../models/subject');
  const APIError = require('../../utils/apiError');
  const Class = require('../../models/class');
  const School = require('../../models/school');
  const Teacher = require('../../models/teacher');
  const mongoose = require('mongoose'); // Add this import


  const markAttendance = async (req, res, next) => {
    try {
      const { classId, subjectId, date, students, academicYearId: academicYearIdFromBody } = req.body;
      const schoolId = req.user.schoolId;
      const userId = req.user.id;
      const academicYearId = req.user.activeAcademicYear || academicYearIdFromBody;
      if (!academicYearId) {
        throw new APIError('Academic Year ID is required', 400);
      }
      // Rest of the code remains the same
      const teacher = await Teacher.findOne({ userId: userId });
      if (!teacher) {
        throw new APIError('Teacher profile not found', 404);
      }
      const teacherId = teacher._id.toString();
      if (!classId || !subjectId || !date || !students?.length) {
        console.log('Missing fields:', { classId, subjectId, date, students });
        throw new APIError('Missing required fields', 400);
      }

      const classData = await Class.findById(classId)
        .populate('attendanceTeacher')
        .populate('substituteAttendanceTeachers');
      const isSubjectTeacher = await Subject.exists({
        _id: subjectId,
        'teacherAssignments.teacherId': teacherId,
        'teacherAssignments.academicYearId': academicYearId,
        classes: classId
      });
      console.log('this is 1',isSubjectTeacher)
      const isAttendanceTeacher = classData.attendanceTeacher?._id.toString() === teacherId;
      const isSubstituteTeacher = classData.substituteAttendanceTeachers.some(t => t._id.toString() === teacherId);
      if (!isSubjectTeacher && !isAttendanceTeacher && !isSubstituteTeacher) {
        throw new APIError('Not authorized to mark attendance', 403);
      }

      const attendanceDate = new Date(date);
      const startOfDay = new Date(attendanceDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(attendanceDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existingAttendance = await Attendance.findOne({
        classId,
        subjectId,
        date: { $gte: startOfDay, $lte: endOfDay },
        schoolId
      });
      console.log('this is 2',existingAttendance)
      if (existingAttendance) {
        throw new APIError('Attendance already marked', 400);
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
  console.log('this is 3',attendance)
      await attendance.save();
      res.status(201).json(attendance);
    } catch (error) {
      console.log('Error in markAttendance:', error);
      next(error);
    }
  };
// attendanceControllers.js
const getAttendanceHistory = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { academicYearId, startDate, endDate } = req.query;

    if (!classId || !academicYearId) {
      throw new APIError('Class ID and Academic Year ID are required', 400);
    }

    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: req.user.id });
      if (!teacher) {
        throw new APIError('Teacher profile not found', 404);
      }
      const teacherId = teacher._id.toString();

      const subjects = await Subject.find({
        schoolId: req.user.schoolId,
        'teacherAssignments.teacherId': teacherId,
        'teacherAssignments.academicYearId': academicYearId,
      }).populate('classes');
      const classIds = subjects.flatMap(subject => subject.classes.map(cls => cls._id.toString()));
      console.log('Authorized Class IDs:', classIds);
      if (!classIds.includes(classId)) {
        throw new APIError('You are not authorized to view attendance history for this class', 403);
      }
    }

    const query = {
      schoolId: req.user.schoolId,
      classId: new mongoose.Types.ObjectId(classId),
      academicYearId: new mongoose.Types.ObjectId(academicYearId),
    };
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
      console.log('Date Range Query:', query.date); // Debug date range
    }

    const attendanceRecords = await Attendance.find(query)
      .populate({
        path: 'students.studentId',
        select: 'name rollNo',
        model: 'Student'
      })
      .populate('classId', 'name')
      .populate('subjectId', 'name');
    console.log('Fetched Attendance Records:', attendanceRecords); // Debug records

    if (!attendanceRecords.length) {
      console.log('No records found for the given criteria');
    }

    res.status(200).json(attendanceRecords);
  } catch (error) {
    console.error('Error in getAttendanceHistory:', error.message, error.stack);
    next(error);
  }
};

  module.exports = { markAttendance, getAttendanceHistory };