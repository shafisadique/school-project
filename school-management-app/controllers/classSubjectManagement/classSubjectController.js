// const Class = require('../../models/class');
// const Subject = require('../../models/subject');
// const Teacher = require('../../models/teacher');
// const APIError = require('../../utils/apiError');
// const { updateClassProgression } = require('../../utils/classProgression');
// const mongoose = require('mongoose');

// // ✅ Create Class
// const createClass = async (req, res, next) => {
//   try {
//     const { name, sections, attendanceTeacher, substituteAttendanceTeachers } = req.body;
//     const schoolId = req.user.schoolId;

//     // Validate class name
//     if (!name) {
//       throw new APIError('Class name is required', 400);
//     }

//     // Check if class already exists in the school
//     const existingClass = await Class.findOne({ name, schoolId });
//     if (existingClass) {
//       throw new APIError('Class already exists in this school', 409);
//     }

//     // Validate attendance teacher
//     if (attendanceTeacher) {
//       const teacher = await Teacher.findOne({ _id: attendanceTeacher, status: true });
//       if (!teacher || teacher.schoolId.toString() !== schoolId.toString()) {
//         throw new APIError('Invalid attendance teacher, teacher not active, or teacher not in this school', 400);
//       }
//     }

//     // Validate substitute teachers
//     if (substituteAttendanceTeachers && Array.isArray(substituteAttendanceTeachers)) {
//       for (const teacherId of substituteAttendanceTeachers) {
//         const teacher = await Teacher.findOne({ _id: teacherId, status: true });
//         if (!teacher || teacher.schoolId.toString() !== schoolId.toString()) {
//           throw new APIError('Invalid substitute teacher, teacher not active, or teacher not in this school', 400);
//         }
//       }
//     }

//     // Create the new class
//     const newClass = await Class.create({
//       name,
//       sections,
//       schoolId,
//       attendanceTeacher,
//       substituteAttendanceTeachers: substituteAttendanceTeachers || [],
//       createdBy: req.user.id,
//     });

//     // Update the class progression for the school (sets nextClass for all classes)
//     await updateClassProgression(schoolId);

//     res.status(201).json({
//       success: true,
//       data: newClass,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ✅ Get All Classes (For a Specific School)
// const getClassesBySchool = async (req, res, next) => {
//   try {
//     let classes;
//     if (req.user.role === 'admin') {
//       classes = await Class.find({ schoolId: req.user.schoolId })
//         .populate({
//           path: 'subjects',
//         })
//         .populate({
//           path: 'attendanceTeacher',
//           match: { status: true }, // Only populate active teachers
//           select: 'name',
//         })
//         .populate({
//           path: 'substituteAttendanceTeachers',
//           match: { status: true }, // Only populate active teachers
//           select: 'name',
//         });
//     } else if (req.user.role === 'teacher') {

//       // Check both teacherAssignments and teachers array
//       const subjects = await Subject.find({
//         schoolId: req.user.schoolId,
//         $or: [
//           { 'teacherAssignments.teacherId': req.user.id },
//           { teachers: req.user.id }
//         ]
//       }).populate('classes');
//       console.log('Found subjects:', subjects);

//       if (!subjects || subjects.length === 0) {
//         console.log('No subjects found for teacher, returning empty classes');
//         return res.status(200).json([]);
//       }

//       const classIds = [...new Set(subjects.flatMap(subject => subject.classes.map(classObj => classObj._id)))];
//       console.log('Extracted class IDs:', classIds);

//       classes = await Class.find({
//         _id: { $in: classIds },
//         schoolId: req.user.schoolId
//       })
//         .populate({
//           path: 'subjects',
//         })
//         .populate({
//           path: 'attendanceTeacher',
//           match: { status: true }, // Only populate active teachers
//           select: 'name',
//         })
//         .populate({
//           path: 'substituteAttendanceTeachers',
//           match: { status: true }, // Only populate active teachers
//           select: 'name',
//         });
//     } else {
//       throw new APIError('Access denied', 403);
//     }

//     res.status(200).json(classes);
//   } catch (err) {
//     console.error('Error fetching classes:', err.message);
//     next(new APIError('Error fetching classes: ' + err.message, 500));
//   }
// };

// // ✅ Create Subject
// const createSubject = async (req, res, next) => {
//   try {
//     const { name, classes, teachers } = req.body;
//     const schoolId = req.user.schoolId;

//     if (!name) {
//       throw new APIError('Subject name is required', 400);
//     }

//     const existingSubject = await Subject.findOne({ name, schoolId });
//     if (existingSubject) {
//       throw new APIError('Subject already exists in this school', 409);
//     }

//     const newSubject = await Subject.create({
//       name,
//       classes,
//       teachers,
//       schoolId,
//       createdBy: req.user.id // Use req.user.id instead of _id
//     });

//     res.status(201).json({
//       success: true,
//       data: newSubject
//     });

//   } catch (error) {
//     next(error);
//   }
// };


// const assignSubjectToClassUpdate = async (req, res, next) => {
//   try {
//     const { classId, subjectId, teacherId, academicYearId } = req.body;

//     // Validate required fields
//     if (!classId || !subjectId || !teacherId || !academicYearId) {
//       throw new APIError('Class ID, Subject ID, Teacher ID, and Academic Year ID are required', 400);
//     }

//     // Validate IDs
//     if (
//       !mongoose.Types.ObjectId.isValid(classId) ||
//       !mongoose.Types.ObjectId.isValid(subjectId) ||
//       !mongoose.Types.ObjectId.isValid(teacherId) ||
//       !mongoose.Types.ObjectId.isValid(academicYearId)
//     ) {
//       throw new APIError('Invalid ID format', 400);
//     }

//     // Fetch subject, class, and teacher
//     const subject = await Subject.findOne({ _id: subjectId, schoolId: req.user.schoolId });
//     const classData = await Class.findOne({ _id: classId, schoolId: req.user.schoolId });
//     const teacher = await Teacher.findById(teacherId);

//     if (!subject || !classData || !teacher) {
//       throw new APIError('Subject, Class, or Teacher not found or not in this school', 404);
//     }

//     // Ensure subject is associated with the class
//     if (!subject.classes.includes(classId)) {
//       subject.classes.push(classId);
//       if (!classData.subjects.includes(subjectId)) {
//         classData.subjects.push(subjectId);
//       }
//     }

//     // Find the existing assignment
//     const assignmentIndex = subject.teacherAssignments.findIndex(
//       (ta) => ta.academicYearId.toString() === academicYearId && subject.classes.includes(classId)
//     );

//     if (assignmentIndex === -1) {
//       throw new APIError('No assignment found for the given class and academic year. Use the assign endpoint to create a new assignment.', 404);
//     }

//     // Update the teacher for the existing assignment
//     subject.teacherAssignments[assignmentIndex].teacherId = teacherId;

//     // Ensure the teacher is in the teachers array
//     if (!subject.teachers.includes(teacherId)) {
//       subject.teachers.push(teacherId);
//     }

//     // Save both documents in a transaction
//     const session = await mongoose.startSession();
//     session.startTransaction();
//     try {
//       await classData.save({ session });
//       await subject.save({ session });
//       await session.commitTransaction();
//     } catch (error) {
//       await session.abortTransaction();
//       throw error;
//     } finally {
//       session.endSession();
//     }

//     res.status(200).json({
//       success: true,
//       message: 'Assignment updated successfully',
//       data: { classId, subjectId, teacherId, academicYearId },
//     });
//   } catch (error) {
//     next(error);
//   }
// };


// // ✅ Get All Subjects (For a Specific School)
// const getSubjectsBySchool = async (req, res) => {
//   try {
//     const subjects = await Subject.find({ schoolId: req.params.schoolId });
//     res.status(200).json(subjects);
//   } catch (err) {
//     res.status(500).json({ message: 'Error fetching subjects', error: err.message });
//   }
// };

// // ✅ Get Combined Assignments
// const getCombinedAssignments = async (req, res) => {
//   try {
//     const { schoolId } = req.params;
//     const { academicYearId } = req.query;

//     if (!academicYearId) {
//       return res.status(400).json({ message: 'Academic year ID is required' });
//     }

//     // Fetch classes with populated subjects, attendanceTeacher, and substituteAttendanceTeachers
//     const classes = await Class.find({ schoolId })
//       .populate({
//         path: 'subjects',
//         populate: {
//           path: 'teacherAssignments.teacherId',
//           model: 'Teacher',
//           match: { status: true }, // Only populate active teachers
//           select: 'name email',
//         },
//       })
//       .populate({
//         path: 'attendanceTeacher',
//         match: { status: true }, // Only populate active teachers
//         select: 'name',
//       })
//       .populate({
//         path: 'substituteAttendanceTeachers',
//         match: { status: true }, // Only populate active teachers
//         select: 'name',
//       });

//     const assignments = [];
//     classes.forEach(cls => {
//       cls.subjects.forEach(subject => {
//         const relevantAssignments = subject.teacherAssignments.filter(ta => 
//           ta.academicYearId.toString() === academicYearId
//         );
//         relevantAssignments.forEach(ta => {
//           assignments.push({
//             classId: cls._id,
//             className: cls.name,
//             subjectId: subject._id,
//             subjectName: subject.name,
//             teacherId: ta.teacherId?._id || null,
//             teacherName: ta.teacherId?.name || 'N/A',
//             teacherEmail: ta.teacherId?.email || 'N/A',
//             attendanceTeacher: cls.attendanceTeacher || null,
//             substituteAttendanceTeachers: cls.substituteAttendanceTeachers || [],
//           });
//         });
//       });
//     });

//     res.status(200).json(assignments);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// // ✅ Get Assignments by Teacher
// const getAssignmentsByTeacher = async (req, res) => {
//   try {
//     const { teacherId } = req.params;
//     const { academicYearId, date } = req.query;

//     if (!academicYearId) {
//       return res.status(400).json({ message: 'Academic year ID is required' });
//     }

//     // Find subjects where the teacher is assigned for the given academic year
//     const subjects = await Subject.find({
//       'teacherAssignments.teacherId': teacherId,
//       'teacherAssignments.academicYearId': academicYearId,
//     }).populate({
//       path: 'classes',
//       populate: [
//         {
//           path: 'attendanceTeacher',
//           match: { status: true }, // Only populate active teachers
//           select: '_id',
//         },
//         {
//           path: 'substituteAttendanceTeachers',
//           match: { status: true }, // Only populate active teachers
//           select: '_id',
//         },
//       ],
//     });

//     const assignments = [];
//     for (const subject of subjects) {
//       const relevantAssignments = subject.teacherAssignments.filter(
//         (ta) => ta.teacherId.toString() === teacherId && ta.academicYearId.toString() === academicYearId
//       );
//       for (const ta of relevantAssignments) {
//         for (const classData of subject.classes) {
//           // Determine if the teacher can mark attendance
//           const isAssignedTeacher = true; // Already confirmed by teacherAssignments filter
//           const isAttendanceTeacher = classData.attendanceTeacher?._id.toString() === teacherId;
//           const isSubstituteAttendanceTeacher = classData.substituteAttendanceTeachers?.some(
//             (t) => t._id.toString() === teacherId
//           );
//           const canMarkAttendance = isAssignedTeacher || isAttendanceTeacher || isSubstituteAttendanceTeacher;

//           assignments.push({
//             classId: { _id: classData._id, name: classData.name },
//             subjectId: { _id: subject._id, name: subject.name },
//             day: ta.day || 'N/A',
//             time: ta.time || 'N/A',
//             canMarkAttendance,
//             attendanceTeacher: classData.attendanceTeacher || null,
//             substituteAttendanceTeachers: classData.substituteAttendanceTeachers || [],
//           });
//         }
//       }
//     }
//     // If a date is provided, filter assignments (optional logic if timetable includes day/time)
//     if (date) {
//       const selectedDate = new Date(date);
//       const dayOfWeek = selectedDate.toLocaleString('en-US', { weekday: 'long' });
//       // Filter assignments based on day if applicable (requires day field in teacherAssignments)
//     }

//     res.status(200).json(assignments);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// const assignSubjectToClass = async (req, res) => {
//   const { classId, subjectId, teacherId, academicYearId } = req.body;

//   try {
//     // Step 1: Validate required fields (like checking if the timetable form is complete)
//     if (!classId || !subjectId || !teacherId || !academicYearId) {
//       return res.status(400).json({ message: 'Class ID, Subject ID, Teacher ID, and Academic Year ID are required' });
//     }

//     // Step 2: Validate IDs (like ensuring the form has valid teacher and class IDs)
//     if (
//       !mongoose.Types.ObjectId.isValid(classId) ||
//       !mongoose.Types.ObjectId.isValid(subjectId) ||
//       !mongoose.Types.ObjectId.isValid(teacherId) ||
//       !mongoose.Types.ObjectId.isValid(academicYearId)
//     ) {
//       return res.status(400).json({ message: 'Invalid ID format' });
//     }

//     // Step 3: Fetch class, subject, and teacher (like looking up records in the school office)
//     const classData = await Class.findById(classId);
//     const subject = await Subject.findById(subjectId);
//     const teacher = await Teacher.findById(teacherId);

//     if (!classData || !subject || !teacher) {
//       return res.status(404).json({ message: 'Class, Subject, or Teacher not found' });
//     }

//     // Step 4: Ensure they belong to the same school
//     if (
//       classData.schoolId.toString() !== subject.schoolId.toString() ||
//       subject.schoolId.toString() !== teacher.schoolId.toString()
//     ) {
//       return res.status(400).json({ message: 'Class, Subject, and Teacher must belong to the same school' });
//     }

//     // Step 5: Check for existing assignment (like checking if English is already in the Pre-Nursery timetable for 2025-26)
//     const existingAssignment = subject.teacherAssignments?.find(
//       (ta) => ta.academicYearId.toString() === academicYearId && subject.classes.includes(classId)
//     );
//     if (existingAssignment) {
//       return res.status(409).json({
//         message: `Subject ${subject.name} is already assigned to class ${classData.name} for this academic year. Use the update endpoint to change the teacher.`,
//       });
//     }

//     // Step 6: Link subject to class and class to subject (like updating the timetable)
//     if (!classData.subjects.includes(subjectId)) {
//       classData.subjects.push(subjectId);
//     }
//     if (!subject.classes.includes(classId)) {
//       subject.classes.push(classId);
//     }

//     // Step 7: Add new teacher assignment (like assigning Afifa Shamim to teach English)
//     subject.teacherAssignments = subject.teacherAssignments || [];
//     subject.teacherAssignments.push({
//       _id: new mongoose.Types.ObjectId(),
//       teacherId,
//       academicYearId,
//     });

//     // Step 8: Add teacher to subject’s teachers array (optional, for tracking)
//     if (!subject.teachers.includes(teacherId)) {
//       subject.teachers.push(teacherId);
//     }

//     // Step 9: Save changes securely (like saving the timetable)
//     const session = await mongoose.startSession();
//     session.startTransaction();
//     try {
//       await classData.save({ session });
//       await subject.save({ session });
//       await session.commitTransaction();
//     } catch (error) {
//       await session.abortTransaction();
//       throw error;
//     } finally {
//       session.endSession();
//     }

//     // Step 10: Confirm success
//     res.status(200).json({ message: `Subject ${subject.name} assigned to class ${classData.name} with teacher ${teacher.name}` });
//   } catch (err) {
//     res.status(500).json({ message: 'Error assigning subject to class', error: err.message });
//   }
// };

// // ✅ Assign Subject to Class
// // const assignSubjectToClass = async (req, res) => {
// //   const { classId, subjectId, teacherId, academicYearId } = req.body;

// //   try {
// //     // Validate required fields
// //     if (!classId || !subjectId || !teacherId || !academicYearId) {
// //       return res.status(400).json({ message: 'Class ID, Subject ID, Teacher ID, and Academic Year ID are required' });
// //     }

// //     const classData = await Class.findById(classId);
// //     const subject = await Subject.findById(subjectId);
// //     const teacher = await Teacher.findById(teacherId);

// //     if (!classData || !subject || !teacher) {
// //       return res.status(404).json({ message: 'Class, Subject, or Teacher not found' });
// //     }

// //     // Ensure they belong to the same school
// //     if (classData.schoolId.toString() !== subject.schoolId.toString() ||
// //         subject.schoolId.toString() !== teacher.schoolId.toString()) {
// //       return res.status(400).json({ message: 'Class, Subject, and Teacher must belong to the same school' });
// //     }

// //     // Assign subject to class
// //     if (!classData.subjects.includes(subjectId)) {
// //       classData.subjects.push(subjectId);
// //     }
// //     subject.classes = subject.classes || [];
// //     if (!subject.classes.includes(classId)) {
// //       subject.classes.push(classId);
// //     }
// //     // Update subject's teacherAssignments with academicYearId
// //     subject.teacherAssignments = subject.teacherAssignments || [];
// //     const existingAssignment = subject.teacherAssignments.find(
// //       ta => ta.teacherId.toString() === teacherId && ta.academicYearId.toString() === academicYearId
// //     );

// //     if (!existingAssignment) {
// //       subject.teacherAssignments.push({
// //         teacherId,
// //         academicYearId
// //       });
// //     }

// //     // Optionally, update the subject's teachers array (if still needed)
// //     subject.teachers = subject.teachers || [];
// //     if (!subject.teachers.includes(teacherId)) {
// //       subject.teachers.push(teacherId);
// //     }

// //     await classData.save();
// //     await subject.save();

// //     res.status(200).json({ message: 'Subject assigned to class successfully with teacher' });

// //   } catch (err) {
// //     res.status(500).json({ message: 'Error assigning subject to class', error: err.message });
// //   }
// // };


// // ✅ Update Attendance Teachers
// const updateAttendanceTeachers = async (req, res, next) => {
//   try {
//     const { classId, attendanceTeacher, substituteAttendanceTeachers } = req.body;
//     const schoolId = req.user.schoolId;

//     if (req.user.role !== 'admin') {
//       throw new APIError('Access denied: Only admins can update attendance teachers', 403);
//     }

//     const classData = await Class.findById(classId);
//     if (!classData || classData.schoolId.toString() !== schoolId.toString()) {
//       throw new APIError('Class not found or not in this school', 404);
//     }

//     if (attendanceTeacher) {
//       const teacher = await Teacher.findOne({ _id: attendanceTeacher, status: true });
//       if (!teacher || teacher.schoolId.toString() !== schoolId.toString()) {
//         throw new APIError('Invalid attendance teacher, teacher not active, or teacher not in this school', 400);
//       }
//       classData.attendanceTeacher = attendanceTeacher;
//     }

//     if (substituteAttendanceTeachers && Array.isArray(substituteAttendanceTeachers)) {
//       for (const teacherId of substituteAttendanceTeachers) {
//         const teacher = await Teacher.findOne({ _id: teacherId, status: true });
//         if (!teacher || teacher.schoolId.toString() !== schoolId.toString()) {
//           throw new APIError('Invalid substitute teacher, teacher not active, or teacher not in this school', 400);
//         }
//       }
//       classData.substituteAttendanceTeachers = substituteAttendanceTeachers;
//     }

//     await classData.save();

//     res.status(200).json({
//       success: true,
//       message: 'Attendance teachers updated successfully',
//       data: classData,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ✅ Get Teachers by School ID
// const getTeachersBySchoolId = async (req, res) => {
//   try {
//     const { schoolId } = req.params;

//     const teachers = await Teacher.find({ schoolId, status: true }).select('-__v');

//     if (!teachers.length) {
//       return res.status(404).json({ message: 'No active teachers found for this school' });
//     }

//     res.status(200).json(teachers);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// module.exports = {
//   createClass,
//   getClassesBySchool,
//   createSubject,
//   getSubjectsBySchool,
//   assignSubjectToClass,
//   getCombinedAssignments,
//   assignSubjectToClassUpdate,
//   getTeachersBySchoolId,
//   getAssignmentsByTeacher,
//   updateAttendanceTeachers
// };


const Class = require('../../models/class');
const Student = require('../../models/student'); // Note: Fixed 'student' to 'Student'
const Subject = require('../../models/subject');
const Teacher = require('../../models/teacher');
const ClassSubjectAssignment = require('../../models/classSubjectAssignment'); // New import
const APIError = require('../../utils/apiError');
const { updateClassProgression } = require('../../utils/classProgression');
const mongoose = require('mongoose');

// ✅ Create Class (unchanged)
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

// ✅ Get All Classes (For a Specific School) - Updated for teacher role to use new model
const getClassesBySchool = async (req, res, next) => {
  try {
    let classes;
    if (req.user.role === 'admin') {
      classes = await Class.find({ schoolId: req.user.schoolId })
        .populate({
          path: 'subjects',
        })
        .populate({
          path: 'attendanceTeacher',
          match: { status: true },
          select: 'name',
        })
        .populate({
          path: 'substituteAttendanceTeachers',
          match: { status: true },
          select: 'name',
        });
    } else if (req.user.role === 'teacher') {
      // Find classes where the teacher is the attendanceTeacher or substitute
      classes = await Class.find({
        schoolId: req.user.schoolId,
        $or: [
          { attendanceTeacher: req.user.id },
          { substituteAttendanceTeachers: req.user.id },
        ],
      })
        .populate({
          path: 'subjects',
        })
        .populate({
          path: 'attendanceTeacher',
          match: { status: true },
          select: 'name',
        })
        .populate({
          path: 'substituteAttendanceTeachers',
          match: { status: true },
          select: 'name',
        });
    } else {
      throw new APIError('Access denied', 403);
    }

    res.status(200).json(classes);
  } catch (err) {
    console.error('Error fetching classes:', err.message);
    next(new APIError('Error fetching classes: ' + err.message, 500));
  }
};

// ✅ Create Subject - Updated to remove classes/teachers
const createSubject = async (req, res, next) => {
  try {
    const { name } = req.body; // Removed classes, teachers
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
      schoolId,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: newSubject
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Assign Subject to Class (Create) - Updated to use new model
const assignSubjectToClass = async (req, res, next) => {
  try {
    const { classId, subjectId, teacherId, academicYearId } = req.body;
    const schoolId = req.user.schoolId;

    if (!classId || !subjectId || !teacherId || !academicYearId) {
      throw new APIError('Class ID, Subject ID, Teacher ID, and Academic Year ID are required', 400);
    }

    if (
      !mongoose.Types.ObjectId.isValid(classId) ||
      !mongoose.Types.ObjectId.isValid(subjectId) ||
      !mongoose.Types.ObjectId.isValid(teacherId) ||
      !mongoose.Types.ObjectId.isValid(academicYearId)
    ) {
      throw new APIError('Invalid ID format', 400);
    }

    const classData = await Class.findOne({ _id: classId, schoolId });
    const subject = await Subject.findOne({ _id: subjectId, schoolId });
    const teacher = await Teacher.findOne({ _id: teacherId, schoolId, status: true });

    if (!classData || !subject || !teacher) {
      throw new APIError('Class, Subject, or Teacher not found or not in this school', 404);
    }

    const newAssignment = new ClassSubjectAssignment({
      schoolId,
      classId,
      subjectId,
      teacherId,
      academicYearId
    });

    await newAssignment.save();

    // Optional: Link for compatibility
    if (!classData.subjects.includes(subjectId)) {
      classData.subjects.push(subjectId);
      await classData.save();
    }
    if (!subject.classes.includes(classId)) {
      subject.classes.push(classId);
      await subject.save();
    }

    res.status(201).json({
      success: true,
      message: 'Subject assigned to class successfully',
      data: newAssignment
    });
  } catch (error) {
    if (error.code === 11000) {
      next(new APIError('Subject already assigned to this class for this year. Use update to change teacher.', 409));
    } else {
      next(error);
    }
  }
};

// ✅ Update Assignment (Change Teacher) - Updated to use new model
const assignSubjectToClassUpdate = async (req, res, next) => {
  try {
    const { classId, subjectId, teacherId, academicYearId } = req.body;
    const schoolId = req.user.schoolId;

    if (!classId || !subjectId || !teacherId || !academicYearId) {
      throw new APIError('Class ID, Subject ID, Teacher ID, and Academic Year ID are required', 400);
    }

    if (
      !mongoose.Types.ObjectId.isValid(classId) ||
      !mongoose.Types.ObjectId.isValid(subjectId) ||
      !mongoose.Types.ObjectId.isValid(teacherId) ||
      !mongoose.Types.ObjectId.isValid(academicYearId)
    ) {
      throw new APIError('Invalid ID format', 400);
    }

    const teacher = await Teacher.findOne({ _id: teacherId, schoolId, status: true });
    if (!teacher) {
      throw new APIError('Teacher not found or not active in this school', 404);
    }

    const updated = await ClassSubjectAssignment.findOneAndUpdate(
      { schoolId, classId, subjectId, academicYearId },
      { teacherId },
      { new: true, runValidators: true }
    );

    if (!updated) {
      throw new APIError('No assignment found for the given class, subject, and academic year.', 404);
    }

    res.status(200).json({
      success: true,
      message: 'Assignment updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

// ✅ New: Delete Assignment
const deleteAssignment = async (req, res, next) => {
  try {
    const { classId, subjectId, academicYearId } = req.body;
    const schoolId = req.user.schoolId;

    if (!classId || !subjectId || !academicYearId) {
      throw new APIError('Class ID, Subject ID, and Academic Year ID are required', 400);
    }

    const deleted = await ClassSubjectAssignment.findOneAndDelete({
      schoolId, classId, subjectId, academicYearId
    });

    if (!deleted) {
      throw new APIError('No assignment found to delete', 404);
    }

    // Optional: Clean up links
    await Class.updateOne({ _id: classId }, { $pull: { subjects: subjectId } });
    await Subject.updateOne({ _id: subjectId }, { $pull: { classes: classId } });

    res.status(200).json({
      success: true,
      message: 'Assignment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Get All Subjects (unchanged)
const getSubjectsBySchool = async (req, res) => {
  try {
    const subjects = await Subject.find({ schoolId: req.params.schoolId });
    res.status(200).json(subjects);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching subjects', error: err.message });
  }
};

// ✅ Get Combined Assignments - Updated to use new model (simpler, no duplicates)
const getCombinedAssignments = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { academicYearId } = req.query;

    if (!academicYearId) {
      return res.status(400).json({ message: 'Academic year ID is required' });
    }

    const assignments = await ClassSubjectAssignment.find({ schoolId, academicYearId })
      .populate({
        path: 'classId',
        select: 'name attendanceTeacher substituteAttendanceTeachers',
        populate: [
          { path: 'attendanceTeacher', match: { status: true }, select: 'name' },
          { path: 'substituteAttendanceTeachers', match: { status: true }, select: 'name' }
        ]
      })
      .populate('subjectId', 'name')
      .populate('teacherId', 'name email');

    const formatted = assignments.map(a => ({
      classId: a.classId._id,
      className: a.classId.name,
      subjectId: a.subjectId._id,
      subjectName: a.subjectId.name,
      teacherId: a.teacherId._id,
      teacherName: a.teacherId.name,
      teacherEmail: a.teacherId.email,
      attendanceTeacher: a.classId.attendanceTeacher || null,
      substituteAttendanceTeachers: a.classId.substituteAttendanceTeachers || [],
    }));

    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Get Assignments by Teacher - Updated to use new model
const getAssignmentsByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { academicYearId, date } = req.query;

    if (!academicYearId) {
      return res.status(400).json({ message: 'Academic year ID is required' });
    }

    const assignments = await ClassSubjectAssignment.find({
      teacherId,
      academicYearId
    }).populate({
      path: 'classId',
      select: 'name attendanceTeacher substituteAttendanceTeachers',
      populate: [
        { path: 'attendanceTeacher', match: { status: true }, select: '_id name' },
        { path: 'substituteAttendanceTeachers', match: { status: true }, select: '_id name' }
      ]
    }).populate('subjectId', 'name');

    const formatted = assignments.map(a => {
      const classData = a.classId;
      const isAttendanceTeacher = classData.attendanceTeacher?._id.toString() === teacherId;
      const isSubstituteAttendanceTeacher = classData.substituteAttendanceTeachers?.some(t => t._id.toString() === teacherId);
      const canMarkAttendance = true || isAttendanceTeacher || isSubstituteAttendanceTeacher; // 'true' since assigned teacher

      return {
        classId: { _id: classData._id, name: classData.name },
        subjectId: { _id: a.subjectId._id, name: a.subjectId.name },
        day: 'N/A', // Add if you have timetable data
        time: 'N/A',
        canMarkAttendance,
        attendanceTeacher: classData.attendanceTeacher || null,
        substituteAttendanceTeachers: classData.substituteAttendanceTeachers || [],
      };
    });

    // If date provided, filter (add logic if timetable has day/time)
    if (date) {
      // Example: Filter by dayOfWeek if you add day to model
    }

    res.status(200).json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Update Attendance Teachers (unchanged)
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

// ✅ Get Teachers by School ID (unchanged)
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
  assignSubjectToClassUpdate,
  getTeachersBySchoolId,
  getAssignmentsByTeacher,
  updateAttendanceTeachers,
  deleteAssignment // New export
};