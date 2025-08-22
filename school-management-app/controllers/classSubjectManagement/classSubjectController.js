const Class = require('../../models/class');
const student = require('../../models/student');
const Subject = require('../../models/subject');
const Teacher = require('../../models/teacher');
const APIError = require('../../utils/apiError');
const { updateClassProgression } = require('../../utils/classProgression');

// ✅ Create Class
const createClass = async (req, res, next) => {
  try {
    const { name, sections, attendanceTeacher, substituteAttendanceTeachers } = req.body;
    const schoolId = req.user.schoolId;

    // Validate class name
    if (!name) {
      throw new APIError('Class name is required', 400);
    }

    // Check if class already exists in the school
    const existingClass = await Class.findOne({ name, schoolId });
    if (existingClass) {
      throw new APIError('Class already exists in this school', 409);
    }

    // Validate attendance teacher
    if (attendanceTeacher) {
      const teacher = await Teacher.findOne({ _id: attendanceTeacher, status: true });
      if (!teacher || teacher.schoolId.toString() !== schoolId.toString()) {
        throw new APIError('Invalid attendance teacher, teacher not active, or teacher not in this school', 400);
      }
    }

    // Validate substitute teachers
    if (substituteAttendanceTeachers && Array.isArray(substituteAttendanceTeachers)) {
      for (const teacherId of substituteAttendanceTeachers) {
        const teacher = await Teacher.findOne({ _id: teacherId, status: true });
        if (!teacher || teacher.schoolId.toString() !== schoolId.toString()) {
          throw new APIError('Invalid substitute teacher, teacher not active, or teacher not in this school', 400);
        }
      }
    }

    // Create the new class
    const newClass = await Class.create({
      name,
      sections,
      schoolId,
      attendanceTeacher,
      substituteAttendanceTeachers: substituteAttendanceTeachers || [],
      createdBy: req.user.id,
    });

    // Update the class progression for the school (sets nextClass for all classes)
    await updateClassProgression(schoolId);

    res.status(201).json({
      success: true,
      data: newClass,
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Get All Classes (For a Specific School)
const getClassesBySchool = async (req, res, next) => {
  try {
    let classes;
    if (req.user.role === 'admin') {
      console.log('Fetching all classes for admin');
      classes = await Class.find({ schoolId: req.user.schoolId })
        .populate({
          path: 'subjects',
        })
        .populate({
          path: 'attendanceTeacher',
          match: { status: true }, // Only populate active teachers
          select: 'name',
        })
        .populate({
          path: 'substituteAttendanceTeachers',
          match: { status: true }, // Only populate active teachers
          select: 'name',
        });
    } else if (req.user.role === 'teacher') {

      // Check both teacherAssignments and teachers array
      const subjects = await Subject.find({
        schoolId: req.user.schoolId,
        $or: [
          { 'teacherAssignments.teacherId': req.user.id },
          { teachers: req.user.id }
        ]
      }).populate('classes');
      console.log('Found subjects:', subjects);

      if (!subjects || subjects.length === 0) {
        console.log('No subjects found for teacher, returning empty classes');
        return res.status(200).json([]);
      }

      const classIds = [...new Set(subjects.flatMap(subject => subject.classes.map(classObj => classObj._id)))];
      console.log('Extracted class IDs:', classIds);

      classes = await Class.find({
        _id: { $in: classIds },
        schoolId: req.user.schoolId
      })
        .populate({
          path: 'subjects',
        })
        .populate({
          path: 'attendanceTeacher',
          match: { status: true }, // Only populate active teachers
          select: 'name',
        })
        .populate({
          path: 'substituteAttendanceTeachers',
          match: { status: true }, // Only populate active teachers
          select: 'name',
        });
    } else {
      throw new APIError('Access denied', 403);
    }

    console.log('Classes found:', classes);
    res.status(200).json(classes);
  } catch (err) {
    console.error('Error fetching classes:', err.message);
    next(new APIError('Error fetching classes: ' + err.message, 500));
  }
};

// ✅ Create Subject
const createSubject = async (req, res, next) => {
  try {
    const { name, classes, teachers } = req.body;
    const schoolId = req.user.schoolId;

    if (!name) {
      throw new APIError('Subject name is required', 400);
    }

    const existingSubject = await Subject.findOne({ name, schoolId });
    if (existingSubject) {
      throw new APIError('Subject already exists in this school', 409);
    }

    const newSubject = await Subject.create({
      name,
      classes,
      teachers,
      schoolId,
      createdBy: req.user.id // Use req.user.id instead of _id
    });

    res.status(201).json({
      success: true,
      data: newSubject
    });

  } catch (error) {
    next(error);
  }
};

// ✅ Get All Subjects (For a Specific School)
const getSubjectsBySchool = async (req, res) => {
  try {
    const subjects = await Subject.find({ schoolId: req.params.schoolId });
    res.status(200).json(subjects);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching subjects', error: err.message });
  }
};

// ✅ Get Combined Assignments
const getCombinedAssignments = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { academicYearId } = req.query;

    if (!academicYearId) {
      return res.status(400).json({ message: 'Academic year ID is required' });
    }

    // Fetch classes with populated subjects, attendanceTeacher, and substituteAttendanceTeachers
    const classes = await Class.find({ schoolId })
      .populate({
        path: 'subjects',
        populate: {
          path: 'teacherAssignments.teacherId',
          model: 'Teacher',
          match: { status: true }, // Only populate active teachers
          select: 'name email',
        },
      })
      .populate({
        path: 'attendanceTeacher',
        match: { status: true }, // Only populate active teachers
        select: 'name',
      })
      .populate({
        path: 'substituteAttendanceTeachers',
        match: { status: true }, // Only populate active teachers
        select: 'name',
      });

    const assignments = [];
    classes.forEach(cls => {
      cls.subjects.forEach(subject => {
        const relevantAssignments = subject.teacherAssignments.filter(ta => 
          ta.academicYearId.toString() === academicYearId
        );
        relevantAssignments.forEach(ta => {
          assignments.push({
            classId: cls._id,
            className: cls.name,
            subjectId: subject._id,
            subjectName: subject.name,
            teacherId: ta.teacherId?._id || null,
            teacherName: ta.teacherId?.name || 'N/A',
            teacherEmail: ta.teacherId?.email || 'N/A',
            attendanceTeacher: cls.attendanceTeacher || null,
            substituteAttendanceTeachers: cls.substituteAttendanceTeachers || [],
          });
        });
      });
    });

    res.status(200).json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Get Assignments by Teacher
const getAssignmentsByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { academicYearId, date } = req.query;

    if (!academicYearId) {
      return res.status(400).json({ message: 'Academic year ID is required' });
    }

    // Find subjects where the teacher is assigned for the given academic year
    const subjects = await Subject.find({
      'teacherAssignments.teacherId': teacherId,
      'teacherAssignments.academicYearId': academicYearId,
    }).populate({
      path: 'classes',
      populate: [
        {
          path: 'attendanceTeacher',
          match: { status: true }, // Only populate active teachers
          select: '_id',
        },
        {
          path: 'substituteAttendanceTeachers',
          match: { status: true }, // Only populate active teachers
          select: '_id',
        },
      ],
    });

    const assignments = [];
    for (const subject of subjects) {
      const relevantAssignments = subject.teacherAssignments.filter(
        (ta) => ta.teacherId.toString() === teacherId && ta.academicYearId.toString() === academicYearId
      );
      for (const ta of relevantAssignments) {
        for (const classData of subject.classes) {
          // Determine if the teacher can mark attendance
          const isAssignedTeacher = true; // Already confirmed by teacherAssignments filter
          const isAttendanceTeacher = classData.attendanceTeacher?._id.toString() === teacherId;
          const isSubstituteAttendanceTeacher = classData.substituteAttendanceTeachers?.some(
            (t) => t._id.toString() === teacherId
          );
          const canMarkAttendance = isAssignedTeacher || isAttendanceTeacher || isSubstituteAttendanceTeacher;

          assignments.push({
            classId: { _id: classData._id, name: classData.name },
            subjectId: { _id: subject._id, name: subject.name },
            day: ta.day || 'N/A',
            time: ta.time || 'N/A',
            canMarkAttendance,
            attendanceTeacher: classData.attendanceTeacher || null,
            substituteAttendanceTeachers: classData.substituteAttendanceTeachers || [],
          });
        }
      }
    }
    // If a date is provided, filter assignments (optional logic if timetable includes day/time)
    if (date) {
      const selectedDate = new Date(date);
      const dayOfWeek = selectedDate.toLocaleString('en-US', { weekday: 'long' });
      // Filter assignments based on day if applicable (requires day field in teacherAssignments)
    }

    res.status(200).json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Assign Subject to Class
const assignSubjectToClass = async (req, res) => {
  const { classId, subjectId, teacherId, academicYearId } = req.body;

  try {
    // Validate required fields
    if (!classId || !subjectId || !teacherId || !academicYearId) {
      return res.status(400).json({ message: 'Class ID, Subject ID, Teacher ID, and Academic Year ID are required' });
    }

    const classData = await Class.findById(classId);
    const subject = await Subject.findById(subjectId);
    const teacher = await Teacher.findById(teacherId);

    if (!classData || !subject || !teacher) {
      return res.status(404).json({ message: 'Class, Subject, or Teacher not found' });
    }

    // Ensure they belong to the same school
    if (classData.schoolId.toString() !== subject.schoolId.toString() ||
        subject.schoolId.toString() !== teacher.schoolId.toString()) {
      return res.status(400).json({ message: 'Class, Subject, and Teacher must belong to the same school' });
    }

    // Assign subject to class
    if (!classData.subjects.includes(subjectId)) {
      classData.subjects.push(subjectId);
    }
    subject.classes = subject.classes || [];
    if (!subject.classes.includes(classId)) {
      subject.classes.push(classId);
    }
    // Update subject's teacherAssignments with academicYearId
    subject.teacherAssignments = subject.teacherAssignments || [];
    const existingAssignment = subject.teacherAssignments.find(
      ta => ta.teacherId.toString() === teacherId && ta.academicYearId.toString() === academicYearId
    );

    if (!existingAssignment) {
      subject.teacherAssignments.push({
        teacherId,
        academicYearId
      });
    }

    // Optionally, update the subject's teachers array (if still needed)
    subject.teachers = subject.teachers || [];
    if (!subject.teachers.includes(teacherId)) {
      subject.teachers.push(teacherId);
    }

    await classData.save();
    await subject.save();

    res.status(200).json({ message: 'Subject assigned to class successfully with teacher' });

  } catch (err) {
    res.status(500).json({ message: 'Error assigning subject to class', error: err.message });
  }
};

// ✅ Update Attendance Teachers
const updateAttendanceTeachers = async (req, res, next) => {
  try {
    const { classId, attendanceTeacher, substituteAttendanceTeachers } = req.body;
    const schoolId = req.user.schoolId;

    if (req.user.role !== 'admin') {
      throw new APIError('Access denied: Only admins can update attendance teachers', 403);
    }

    const classData = await Class.findById(classId);
    if (!classData || classData.schoolId.toString() !== schoolId.toString()) {
      throw new APIError('Class not found or not in this school', 404);
    }

    if (attendanceTeacher) {
      const teacher = await Teacher.findOne({ _id: attendanceTeacher, status: true });
      if (!teacher || teacher.schoolId.toString() !== schoolId.toString()) {
        throw new APIError('Invalid attendance teacher, teacher not active, or teacher not in this school', 400);
      }
      classData.attendanceTeacher = attendanceTeacher;
    }

    if (substituteAttendanceTeachers && Array.isArray(substituteAttendanceTeachers)) {
      for (const teacherId of substituteAttendanceTeachers) {
        const teacher = await Teacher.findOne({ _id: teacherId, status: true });
        if (!teacher || teacher.schoolId.toString() !== schoolId.toString()) {
          throw new APIError('Invalid substitute teacher, teacher not active, or teacher not in this school', 400);
        }
      }
      classData.substituteAttendanceTeachers = substituteAttendanceTeachers;
    }

    await classData.save();

    res.status(200).json({
      success: true,
      message: 'Attendance teachers updated successfully',
      data: classData,
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Get Teachers by School ID
const getTeachersBySchoolId = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const teachers = await Teacher.find({ schoolId, status: true }).select('-__v');

    if (!teachers.length) {
      return res.status(404).json({ message: 'No active teachers found for this school' });
    }

    res.status(200).json(teachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createClass,
  getClassesBySchool,
  createSubject,
  getSubjectsBySchool,
  assignSubjectToClass,
  getCombinedAssignments,
  getTeachersBySchoolId,
  getAssignmentsByTeacher,
  updateAttendanceTeachers
};