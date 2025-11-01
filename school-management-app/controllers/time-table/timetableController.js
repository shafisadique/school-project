const mongoose = require('mongoose');
const Timetable = require('../../models/timetable');
const Class = require('../../models/class');
const Subject = require('../../models/subject');
const Teacher = require('../../models/teacher');
const AcademicYear = require('../../models/academicyear');
const Student = require('../../models/student');
const classSubjectAssignment = require('../../models/classSubjectAssignment');

exports.createTimetable = async (req, res) => {
  const { schoolId, classId, subjectId, teacherId, academicYearId, day, startTime, endTime, room } = req.body;

  try {
    if (!schoolId || !classId || !subjectId || !teacherId || !academicYearId || !day || !startTime || !endTime || !room) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(classId) || 
        !mongoose.Types.ObjectId.isValid(subjectId) || !mongoose.Types.ObjectId.isValid(teacherId) || 
        !mongoose.Types.ObjectId.isValid(academicYearId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    // Optional: Add school authorization check (assuming req.user is admin)
    if (schoolId !== req.user.schoolId.toString()) {
      return res.status(403).json({ message: 'Unauthorized: You can only create timetable for your own school' });
    }

    const classData = await Class.findById(classId);
    const subject = await Subject.findById(subjectId);
    const teacher = await Teacher.findById(teacherId);
    const academicYear = await AcademicYear.findById(academicYearId);

    if (!classData || !subject || !teacher || !academicYear) {
      return res.status(404).json({ message: 'Class, Subject, Teacher, or Academic Year not found' });
    }

    // Optional: Check if subject is generally assigned to the class (via class.subjects array)
    if (!classData.subjects.some(sub => sub.toString() === subjectId)) {
      return res.status(400).json({ message: 'Subject is not assigned to this class' });
    }

    // Key change: Validate using the new ClassSubjectAssignment model instead of deprecated teacherAssignments
    const assignment = await classSubjectAssignment.findOne({
      schoolId,
      classId,
      subjectId,
      teacherId,
      academicYearId
    });

    if (!assignment) {
      return res.status(400).json({ 
        message: `No valid assignment found for teacher ${teacher.name} to subject ${subject.name} in class ${classData.name} for academic year ${academicYear.name}` 
      });
    }

    // Teacher conflict check (unchanged, but ensures no overlap for the teacher on that day)
    const teacherConflict = await Timetable.findOne({
      schoolId,
      teacherId,
      academicYearId,
      day,
      $or: [
        { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
      ],
    });

    if (teacherConflict) {
      return res.status(400).json({
        message: `Teacher ${teacher.name} is already scheduled for another class at this time (${teacherConflict.startTime} - ${teacherConflict.endTime} on ${day})`,
      });
    }

    // Class conflict check (unchanged, ensures no overlap for the class on that day)
    const classConflict = await Timetable.findOne({
      schoolId,
      classId,
      academicYearId,
      day,
      $or: [
        { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
      ],
    });

    if (classConflict) {
      return res.status(400).json({
        message: `Class ${classData.name} already has a period scheduled at this time (${classConflict.startTime} - ${classConflict.endTime} on ${day})`,
      });
    }

    const newEntry = new Timetable({
      schoolId,
      classId,
      subjectId,
      teacherId,
      academicYearId,
      day,
      startTime,
      endTime,
      room,
    });

    await newEntry.save();
    res.status(201).json({ message: 'Timetable entry created successfully', timetable: newEntry });
  } catch (err) {
    res.status(500).json({ message: 'Error creating timetable entry', error: err.message });
  }
};

exports.getTimetableBySchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { academicYearId } = req.query;

    if (!academicYearId) {
      return res.status(400).json({ message: 'Academic year ID is required' });
    }

    if (schoolId !== req.user.schoolId.toString()) {
      return res.status(403).json({ message: 'Unauthorized: You can only access your own school’s timetable' });
    }

    const timetable = await Timetable.find({ 
      schoolId, 
      academicYearId 
    })
      .populate('classId', 'name')
      .populate('subjectId', 'name')
      .populate('teacherId', 'name email')
      .populate('academicYearId', 'name');

    res.status(200).json(timetable);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getScheduleByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { academicYearId } = req.query;

    if (!academicYearId) {
      return res.status(400).json({ message: 'Academic year ID is required' });
    }

    // Ensure the teacherId matches the logged-in user (security check)
    const teacher = await Teacher.findById(teacherId);
    if (!teacher || teacher.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized: You can only access your own schedule' });
    }

    const schedule = await Timetable.find({ 
      teacherId,
      academicYearId,
      schoolId: req.user.schoolId // Add schoolId filter
    })
      .populate('classId', 'name')
      .populate('subjectId', 'name')
      .populate('academicYearId', 'name');

    if (!schedule.length) {
      return res.status(404).json({ message: 'No schedule found for this teacher in the specified academic year' });
    }
    res.status(200).json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteTimetableEntry = async (req, res) => {
  try {
    const { timetableId } = req.params;

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ message: 'Timetable entry not found' });
    }

    if (timetable.schoolId.toString() !== req.user.schoolId.toString()) {
      return res.status(403).json({ message: 'Unauthorized: You can only delete entries for your own school' });
    }

    await Timetable.findByIdAndDelete(timetableId);
    res.status(200).json({ message: 'Timetable entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// controllers/timetableController.js
exports.getTimetableByStudent = async (req, res) => {
  try {
    const { academicYearId } = req.query;

    // 1. Get logged-in user
    const user = req.user;
    if (user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can access this' });
    }

    // 2. Extract studentId from additionalInfo
    const studentId = user.additionalInfo?.studentId;
    if (!studentId) {
      return res.status(400).json({ message: 'Student profile not linked' });
    }

    // 3. Get Student → classId
    const student = await Student.findById(studentId)
      .select('classId schoolId')
      .populate('classId', 'name');

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    if (!student.classId) {
      return res.status(400).json({ message: 'No class assigned to this student' });
    }

    // 4. Get Timetable
    const Timetable = require('../../models/timetable');
    const timetable = await Timetable.find({
      schoolId: student.schoolId,
      classId: student.classId._id,
      academicYearId
    })
      .populate('subjectId', 'name')
      .populate('teacherId', 'name')
      .sort({ day: 1, startTime: 1 });

    res.json(timetable);

  } catch (error) {
    console.error('Error in getTimetableByStudent:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};