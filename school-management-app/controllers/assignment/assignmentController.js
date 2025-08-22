const mongoose = require('mongoose');
const Assignment = require('../../models/assignment');
const User = require('../../models/user');
const Class = require('../../models/class');
const Subject = require('../../models/subject');
const Teacher = require('../../models/teacher');
const Student = require('../../models/student');
const { createUploadMiddleware } = require('../../utils/fileUploader');
const APIError = require('../../utils/apiError');

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg', 'application/doc', 'application/docx'];

exports.upload = createUploadMiddleware(
  'assignments',
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES
);

async function validateAssignmentInput(reqBody, isUpdate = false) {
  const { title, description, dueDate, classId, subjectId, assignedTo } = reqBody;
  if (!isUpdate && (!title || !description || !dueDate || !classId || !subjectId)) {
    throw new APIError('Title, description, due date, class ID, and subject ID are required', 400);
  }
  return { title, description, dueDate, classId, subjectId, assignedTo: assignedTo || [] };
}

async function validateAssignmentInput(reqBody, isUpdate = false) {
  const { title, description, dueDate, classId, subjectId, assignedTo } = reqBody;
  if (!isUpdate && (!title || !description || !dueDate || !classId || !subjectId)) {
    throw new APIError('Title, description, due date, class ID, and subject ID are required', 400);
  }
  return { title, description, dueDate, classId, subjectId, assignedTo: assignedTo || [] };
}

/**
 * @desc    Create a new assignment
 * @route   POST /api/assignments/add
 * @access  Private/Teacher
 */
exports.createAssignment = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      console.log('This is testing for teacher', req.user);
      const { schoolId, id: userId } = req.user;
      // Use teacherId from query parameter if provided, fallback to req.user.id
      const teacherId = req.query.teacherId || userId;

      const assignmentData = await validateAssignmentInput(req.body);

      const [classData, subjectData, teacher] = await Promise.all([
        Class.findById(assignmentData.classId).session(session),
        Subject.findById(assignmentData.subjectId).session(session),
        Teacher.findById(teacherId).session(session)
      ]);

      if (!classData || classData.schoolId.toString() !== schoolId) throw new APIError('Class not found or invalid', 404);
      if (!subjectData || subjectData.schoolId.toString() !== schoolId) throw new APIError('Subject not found or invalid', 404);
      if (!teacher || teacher.schoolId.toString() !== schoolId) throw new APIError('Teacher not found or invalid', 404);

      // Validate assignedTo students
      const assignedStudentIds = assignmentData.assignedTo;
      if (assignedStudentIds.length > 0) {
        const students = await Student.find({ _id: { $in: assignedStudentIds }, schoolId, classId: assignmentData.classId, status: true }).session(session);
        if (students.length !== assignedStudentIds.length) {
          throw new APIError('Some assigned students are invalid or not in the specified class', 400);
        }
      } else {
        // If no students specified, assign all active students in the class
        const studentQuery = { schoolId, classId: assignmentData.classId, status: true };
        const academicYearId = (await School.findById(schoolId).select('activeAcademicYear')).activeAcademicYear;
        studentQuery.academicYearId = academicYearId;
        const students = await Student.find(studentQuery).session(session);
        assignmentData.assignedTo = students.map(s => s._id);
      }

      const assignment = await Assignment.create([{
        ...assignmentData,
        attachments: req.files?.map(file => file.path.replace(/\\/g, '/').split('uploads/')[1]) || [],
        schoolId,
        teacherId, // Use the resolved teacherId
        createdBy: teacherId
      }], { session });

      res.status(201).json({
        success: true,
        message: 'Assignment created successfully. Notifications will be available via the parent/student portal when implemented.',
        data: assignment[0]
      });
    });
  } catch (error) {
    console.error('Error in createAssignment:', error);
    next(error);
  } finally {
    await session.endSession();
  }
};

/**
 * @desc    Get assignments for a teacher
 * @route   GET /api/assignments/teacher
 * @access  Private/Teacher
 */
exports.getTeacherAssignments = async (req, res, next) => {
  try {
    const { schoolId, id: teacherId } = req.user;
    const assignments = await Assignment.find({ schoolId, teacherId })
      .populate('classId', 'name')
      .populate('subjectId', 'name')
      .lean();

    res.json({
      success: true,
      count: assignments.length,
      data: assignments
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get assignments for a student
 * @route   GET /api/assignments/student
 * @access  Private/Student
 */
exports.getStudentAssignments = async (req, res, next) => {
  try {
    const { schoolId, id: studentId } = req.user;
    const assignments = await Assignment.find({ schoolId, assignedTo: studentId })
      .populate('classId', 'name')
      .populate('subjectId', 'name')
      .populate('teacherId', 'name')
      .lean();

    res.json({
      success: true,
      count: assignments.length,
      data: assignments
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit an assignment
 * @route   POST /api/assignments/:id/submit
 * @access  Private/Student
 */
exports.submitAssignment = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { id: studentId } = req.user;
      const assignment = await Assignment.findById(req.params.id).session(session)
        .orFail(new APIError('Assignment not found', 404));

      if (!assignment.assignedTo.includes(studentId)) throw new APIError('Not assigned to this student', 403);
      if (new Date() > assignment.dueDate) throw new APIError('Submission deadline passed', 400);

      const submissionIndex = assignment.submissions.findIndex(s => s.studentId.toString() === studentId);
      const submittedFiles = req.files?.map(file => file.path.replace(/\\/g, '/').split('uploads/')[1]) || [];
      const submissionData = {
        studentId,
        submittedFiles,
        submittedText: req.body.submittedText || null
      };

      if (submissionIndex >= 0) {
        assignment.submissions[submissionIndex] = { ...assignment.submissions[submissionIndex], ...submissionData, submittedAt: Date.now() };
      } else {
        assignment.submissions.push(submissionData);
      }

      await assignment.save({ session });

      res.json({
        success: true,
        message: 'Assignment submitted successfully',
        data: assignment
      });
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

/**
 * @desc    Grade an assignment
 * @route   PUT /api/assignments/:id/grade
 * @access  Private/Teacher
 */
exports.gradeAssignment = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { id: teacherId } = req.user;
      const { studentId, grade, comments } = req.body;
      const assignment = await Assignment.findOne({ _id: req.params.id, teacherId }).session(session)
        .orFail(new APIError('Assignment not found or unauthorized', 404));

      const submission = assignment.submissions.find(s => s.studentId.toString() === studentId);
      if (!submission) throw new APIError('Submission not found', 404);

      submission.grade = grade;
      submission.comments = comments;
      await assignment.save({ session });

      res.json({
        success: true,
        message: 'Assignment graded successfully',
        data: assignment
      });
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};