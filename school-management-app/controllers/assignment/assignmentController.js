const mongoose = require('mongoose');
const Assignment = require('../../models/assignment');
const User = require('../../models/user');
const Class = require('../../models/class');
const Subject = require('../../models/subject');
const Teacher = require('../../models/teacher');
const Student = require('../../models/student');
const { createUploadMiddleware } = require('../../utils/fileUploader');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const APIError = require('../../utils/apiError');
const school = require('../../models/school');
const submission = require('../../models/submission');

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg', 'application/doc', 'application/docx'];

exports.upload = createUploadMiddleware('assignments', MAX_FILE_SIZE, ALLOWED_FILE_TYPES);

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
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

exports.createAssignment = async (req, res, next) => {
  try {
    if (!req.user || !req.user.schoolId) {
      return res.status(401).json({ message: 'User not authenticated or school ID missing' });
    }

    const { teacherId } = req.query;
    if (!teacherId) {
      return res.status(400).json({ message: 'teacherId is required' });
    }

    const { title, description, dueDate, classId, subjectId, assignedTo } = await validateAssignmentInput(req.body);
    const attachments = req.files || []; // Files from multer

    // Handle attachments
    const attachmentKeys = [];
    if (attachments.length > 0) {
      for (const file of attachments) {
        const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const params = {
          Bucket: process.env.R2_BUCKET_NAME,
          Key: `assignments/${fileName}`,
          Body: file.buffer,
          ContentType: file.mimetype,
        };
        const command = new PutObjectCommand(params);
        await s3Client.send(command);
        attachmentKeys.push(`assignments/${fileName}`);
      }
    }

    // Create assignment with schoolId from req.user, handle assignedTo as array
    const newAssignment = new Assignment({
      title,
      description,
      dueDate,
      classId,
      subjectId,
      assignedTo: Array.isArray(assignedTo) ? assignedTo : (assignedTo ? [assignedTo] : []), // Ensure it's an array
      teacherId,
      attachments: attachmentKeys,
      schoolId: req.user.schoolId,
      createdBy: req.user.id,
    });

    await newAssignment.save();
    res.status(201).json({ message: 'Assignment created', assignment: newAssignment });
  } catch (error) {
    console.error('Error creating assignment:', error);
    next(error);
  }
};

/**
 * @desc    Get assignments for a teacher
 * @route   GET /api/assignments/teacher
 * @access  Private/Teacher
 */
exports.getTeacherAssignments = async (req, res, next) => {
  try {
    const { schoolId, id: userId, role } = req.user;
    const { teacherId } = req.params; // Get teacherId from URL

    if (role !== 'teacher') {
      return res.status(403).json({ message: 'Access denied. Teacher role required.' });
    }

    const teacher = await Teacher.findOne({ userId, _id: teacherId });
    if (!teacher) {
      return res.status(400).json({ message: 'Invalid teacher ID or not authorized.' });
    }

    console.log('Querying with teacherId:', teacherId, 'schoolId:', schoolId); // Debug

    const assignments = await Assignment.find({ schoolId, teacherId, status: 'pending' }) // Filter for pending
      .populate('classId', 'name')
      .populate('subjectId', 'name')
      .lean();

    console.log('Pending assignments found:', assignments.length); // Debug

    res.json({
      success: true,
      count: assignments.length,
      data: assignments
    });
  } catch (error) {
    console.error('Error in getTeacherAssignments:', error);
    next(error);
  }
};


/**
 * @desc    Get assignment details including student submissions
 * @route   GET /api/assignments/:id/details
 * @access  Private/Teacher
 */

exports.getAssignmentDetails = async (req, res, next) => {
  try {
    const { id: assignmentId } = req.params;
    const assignment = await Assignment.findById(assignmentId)
      .populate('classId', 'name')
      .populate('subjectId', 'name')
      .lean();

    if (!assignment) {
      return next(new APIError('Assignment not found', 404));
    }

    const { schoolId, id: userId, role } = req.user;
    if (role !== 'teacher') {
      return next(new APIError('Unauthorized access', 403));
    }

    const teacher = await Teacher.findOne({ userId });
    if (!teacher || assignment.teacherId.toString() !== teacher._id.toString()) {
      return next(new APIError('Assignment not found or unauthorized', 404));
    }

    const students = await Student.find({ classId: assignment.classId, schoolId })
      .populate('_id', 'name')
      .lean();
    let studentSubmissions = [];
    try {
      studentSubmissions = await Submission.find({ assignmentId })
        .populate('studentId', 'name')
        .lean();
    } catch (submissionError) {
      console.warn('Submission model not found or error:', submissionError.message);
    }

    const studentData = students.map(student => {
      const submission = studentSubmissions.find(s => s.studentId.toString() === student._id.toString());
      return {
        _id: student._id,
        name: student.name || 'Unknown Student',
        submitted: !!submission,
        grade: submission?.grade || null,
        comments: submission?.comments || '',
        questionsSolved: submission?.questionsSolved || 0
      };
    });

    res.json({
      success: true,
      data: { assignment, students: studentData }
    });
  } catch (error) {
    console.error('Error in getAssignmentDetails:', error);
    next(error);
  }
};


// /**
//  * @desc    Log manual submission by teacher
//  * @route   POST /api/assignments/:id/log-submission
//  * @access  Private/Teacher
//  */
// exports.logManualSubmission = async (req, res, next) => {
//   const session = await mongoose.startSession();
//   try {
//     await session.withTransaction(async () => {
//       const { id: teacherId } = req.user;
//       const { studentId } = req.body;
//       const assignment = await Assignment.findOne({ _id: req.params.id, teacherId, schoolId: req.user.schoolId }).session(session)
//         .orFail(new APIError('Assignment not found or unauthorized', 404));

//       if (!assignment.assignedTo.includes(studentId)) throw new APIError('Student not assigned to this assignment', 403);

//       const submissionIndex = assignment.submissions.findIndex(s => s.studentId.toString() === studentId);
//       const submissionData = {
//         studentId,
//         manuallySubmitted: true
//       };

//       if (submissionIndex >= 0) {
//         assignment.submissions[submissionIndex] = { ...assignment.submissions[submissionIndex], ...submissionData };
//       } else {
//         assignment.submissions.push(submissionData);
//       }

//       await assignment.save({ session });
//       assignment.status = assignment.submissions.every(s => s.manuallySubmitted) ? 'submitted' : 'pending';
//       await assignment.save({ session });

//       res.json({
//         success: true,
//         message: 'Manual submission logged successfully',
//         data: assignment
//       });
//     });
//   } catch (error) {
//     next(error);
//   } finally {
//     await session.endSession();
//   }
// };

/**
 * @desc    Grade an assignment
 * @route   PUT /api/assignments/:id/grade
 * @access  Private/Teacher
 */
exports.gradeAssignment = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      
      const { id: userId } = req.user;
      const { studentId, grade, comments } = req.body;
      const teacherId = await Teacher.findOne({ userId}).populate('_id');
      const assignment = await Assignment.findOne({ _id: req.params.assignmentId, teacherId, schoolId: req.user.schoolId }).session(session)
        .orFail(new APIError('Assignment not found or unauthorized', 404));

      const submission = assignment.submissions.find(s => s.studentId.toString() === studentId);
      if (!submission) throw new APIError('Submission not found', 404);

      submission.grade = grade;
      submission.comments = comments;
      await assignment.save({ session });

      // Update status if all submissions are graded
      assignment.status = assignment.submissions.every(s => s.grade !== null) ? 'graded' : assignment.status;
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



/**
 * @desc    Get assignments for a student
 * @route   GET /api/assignments/student
 * @access  Private/Student
 * @description Fetches all assignments assigned to the logged-in student, sorted by dueDate.
 * Includes submission status for each assignment.
 */
exports.getStudentAssignments = async (req, res, next) => {
  try {
    const { id: userId, role, schoolId } = req.user;

    // 1. Role check
    if (role !== 'student') {
      return res.status(403).json({ message: 'Access denied. Student role required.' });
    }

    // 2. Extract studentId from additionalInfo (consistent with your timetable code)
    const studentId = req.user.additionalInfo?.studentId;
    if (!studentId) {
      return res.status(400).json({ message: 'Student profile not linked' });
    }
    console.log(studentId)
    // 3. Get Student details to fetch classId and verify school
    const student = await Student.findById(studentId)
      .select('classId schoolId name')
      .populate('classId', 'name');
      console.log(student)

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    if (student.schoolId.toString() !== schoolId) {
      return res.status(403).json({ message: 'School mismatch' });
    }

    if (!student.classId) {
      return res.status(400).json({ message: 'No class assigned to this student' });
    }

    // 4. Fetch assignments where classId matches AND studentId is in assignedTo
    // If assignedTo is empty, we'll assume it's for the whole class (optional logic; adjust if needed)
    const assignments = await Assignment.find({
      schoolId,
      classId: student.classId._id,
      $or: [
        { assignedTo: studentId }, // Specific to this student
        { assignedTo: { $size: 0 } } // Or if assignedTo is empty (whole class)
      ],
      dueDate: { $gte: new Date() } // Optional: Only upcoming/overdue assignments
    })
      .populate('classId', 'name')
      .populate('subjectId', 'name')
      .populate('teacherId', 'name')
      .sort({ dueDate: 1 }) // Sort by due date ascending
      .lean();

    // 5. Enhance each assignment with student's submission status
    const enhancedAssignments = assignments.map(assignment => {
      const studentSubmission = assignment.submissions?.find(
        s => s.studentId && s.studentId.toString() === studentId.toString()
      ) || null;

      return {
        ...assignment,
        hasSubmitted: !!studentSubmission,
        submittedAt: studentSubmission?.submittedAt || null,
        grade: studentSubmission?.grade || null,
        comments: studentSubmission?.comments || null,
        isOverdue:  new Date(assignment.dueDate) < new Date(),
        daysUntilDue: Math.ceil((new Date(assignment.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
      };
    });

    res.json({
      success: true,
      count: enhancedAssignments.length,
      data: enhancedAssignments
    });
  } catch (error) {
    console.error('Error in getStudentAssignments:', error);
    next(error);
  }
};

/**
 * @desc    Get details of a specific assignment for a student
 * @route   GET /api/assignments/my-assignment/:id
 * @access  Private/Student
 * @description Fetches a single assignment details if assigned to the student, including their submission status.
 */
exports.getStudentAssignmentDetails = async (req, res, next) => {
  try {
    const { id: userId, role, schoolId } = req.user;
    const { id: assignmentId } = req.params; // FIXED: Extract from :id param

    // 1. Role check  
    if (role !== 'student') {
      return res.status(403).json({ message: 'Access denied. Student role required.' });
    }

    // 2. Extract studentId
    const studentId = req.user.additionalInfo?.studentId;
    if (!studentId) {
      return res.status(400).json({ message: 'Student profile not linked' });
    }

    // 3. Get Student
    const student = await Student.findById(studentId)
      .select('classId schoolId')
      .populate('classId', 'name');

    if (!student || student.schoolId.toString() !== schoolId) {
      return res.status(403).json({ message: 'Student profile not found or school mismatch' });
    }

    // 4. Fetch and validate assignment
    const assignment = await Assignment.findOne({
      _id: assignmentId,
      schoolId,
      classId: student.classId._id,
      $or: [
        { assignedTo: studentId },
        { assignedTo: { $size: 0 } }
      ]
    })
      .populate('classId', 'name')
      .populate('subjectId', 'name')
      .populate('teacherId', 'name')
      .lean();

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found or not assigned to you' });
    }

    // 5. Get student's submission ONLY (filter full array for privacy)
    const studentSubmission = assignment.submissions?.find(
      s => s.studentId && s.studentId.toString() === studentId.toString()
    ) || null;

    // FIXED: Create enhanced assignment WITHOUT full submissions array (production privacy)
    const { submissions, ...assignmentWithoutSubmissions } = assignment; // Remove full submissions
    const enhancedAssignment = {
      ...assignmentWithoutSubmissions,
      mySubmission: studentSubmission || null, // Rename to mySubmission for clarity (optional; or just use fields below)
      hasSubmitted: !!studentSubmission,
      submittedAt: studentSubmission?.submittedAt || null,
      submittedFiles: studentSubmission?.submittedFiles || [],
      submittedText: studentSubmission?.submittedText || null,
      grade: studentSubmission?.grade || null,
      comments: studentSubmission?.comments || null,
      isOverdue: new Date(assignment.dueDate) < new Date(),
      daysUntilDue: Math.ceil((new Date(assignment.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
    };

    res.json({
      success: true,
      data: enhancedAssignment
    });
  } catch (error) {
    console.error('Error in getStudentAssignmentDetails:', error);
    next(error);
  }
};
/**
 * @desc    Bulk grade assignments
 * @route   PUT /api/assignments/:id/bulk-grade
 * @access  Private/Teacher
 */
exports.bulkGradeAssignment = async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const { grades } = req.body; // Array of {studentId, grade, comments, questionsSolved}
    
    // Find teacher
    const teacher = await Teacher.findOne({ userId });
    if (!teacher) {
      throw new APIError('Teacher not found', 404);
    }

    // Find assignment
    const assignment = await Assignment.findOne({ 
      _id: req.params.id, 
      teacherId: teacher._id, 
      schoolId: req.user.schoolId 
    });

    if (!assignment) {
      throw new APIError('Assignment not found or unauthorized', 404);
    }

    // Process each grade in bulk
    for (const gradeData of grades) {
      const { studentId, grade, comments, questionsSolved, submitted } = gradeData;
      
      // Find or create submission
      let submission = assignment.submissions.find(s => 
        s.studentId.toString() === studentId
      );

      if (!submission) {
        // Create new submission if doesn't exist
        submission = {
          studentId,
          grade: null,
          comments: '',
          questionsSolved: 0,
          submittedAt: new Date(),
          manuallySubmitted: true
        };
        assignment.submissions.push(submission);
      }

      // Update submission data
      if (grade !== undefined && grade !== null) {
        submission.grade = grade;
      }
      if (comments !== undefined) {
        submission.comments = comments;
      }
      if (questionsSolved !== undefined) {
        submission.questionsSolved = questionsSolved;
      }
      submission.manuallySubmitted = submitted !== undefined ? submitted : true;
    }

    await assignment.save();

    res.json({
      success: true,
      message: 'Bulk grading completed successfully',
      data: assignment
    });
  } catch (error) {
    next(error);
  }
};


exports.proxyFile = async (req, res) => {
  try {
    const { key } = req.params;
    if (!key) {
      return res.status(400).json({ message: 'File key is required' });
    }

    // Optional: Add auth check here if not already in middleware
    // e.g., if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    const { Body, ContentType, ContentLength, ContentDisposition } = await s3Client.send(command);

    // Set headers for streaming
    res.set({
      'Content-Type': ContentType || 'application/octet-stream',
      'Content-Length': ContentLength,
      'Content-Disposition': ContentDisposition || 'inline',
    });

    // Stream the body directly (efficient for large files)
    Body.pipe(res);
  } catch (error) {
    console.error('Error proxying file:', error);
    res.status(500).json({ message: 'Failed to load file' });
  }
};