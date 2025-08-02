const Exam = require('../../models/exam');
const Class = require('../../models/class');
const School = require('../../models/school');
const Subject = require('../../models/subject');
const APIError = require('../../utils/apiError');
const mongoose = require('mongoose');
const AcademicYear = require('../../models/academicyear');
const Teacher = require('../../models/teacher'); // Note: Capital T for model
// Create an exam (Super Admin or Admin only)
const createExam = async (req, res, next) => {
  try {
    console.log('createExam called with:', { body: req.body, user: req.user });
    const { classId, academicYearId: academicYearIdFromBody, examTitle, examCenter, startDate, endDate, examStatus, examPapers } = req.body;
    const schoolId = req.user.schoolId;

    // Restrict to superadmin or admin
    if (!['superadmin', 'admin'].includes(req.user.role)) {
      throw new APIError('Only Super Admins or Admins can create exams', 403);
    }

    // Validate inputs
    if (!classId || !examTitle || !examCenter || !startDate || !endDate || !examStatus || !examPapers?.length) {
      console.log('Missing fields:', { classId, examTitle, examCenter, startDate, endDate, examStatus, examPapers });
      throw new APIError('Missing required fields', 400);
    }

    // Convert exam dates to Date objects
    const examStartDate = new Date(startDate);
    const examEndDate = new Date(endDate);

    // Fetch the active academic year if not provided
    const school = await School.findById(schoolId).select('activeAcademicYear');
    if (!school || !school.activeAcademicYear) {
      throw new APIError('No active academic year set for this school', 400);
    }
    const academicYearId = academicYearIdFromBody || school.activeAcademicYear.toString();
    console.log('Fetched activeAcademicYearId:', academicYearId);

    // Verify academic year
    const academicYear = await AcademicYear.findById(academicYearId);
    if (!academicYear || academicYear.schoolId.toString() !== schoolId) {
      throw new APIError('Academic year not found or not authorized', 404);
    }

    // Ensure the academic year is active
    if (!academicYear.isActive) {
      throw new APIError('Cannot create exams for an inactive academic year', 400);
    }

    // Ensure exam dates are within the academic year
    if (examStartDate < academicYear.startDate || examEndDate > academicYear.endDate) {
      throw new APIError('Exam dates must be within the academic year', 400);
    }

    // Verify the class exists in this school
    const classExists = await Class.findOne({ _id: classId, schoolId });
    if (!classExists) {
      throw new APIError('Class not found in this school', 404);
    }

    // Validate exam papers
    const validatedExamPapers = await Promise.all(examPapers.map(async (paper) => {
      // Verify subject exists
      const subject = await Subject.findById(paper.subjectId);
      if (!subject || subject.schoolId.toString() !== schoolId) {
        throw new APIError(`Subject with ID ${paper.subjectId} not found or not authorized`, 404);
      }

      // Convert paper date-times to Date objects
      const paperStartDateTime = new Date(paper.paperStartDateTime);
      const paperEndDateTime = new Date(paper.paperEndDateTime);

      // Validate maxMarks and minMarks
      if (paper.maxMarks <= 0 || paper.minMarks < 0 || paper.minMarks > paper.maxMarks) {
        throw new APIError(`Invalid marks for subject ${subject.name}: maxMarks must be positive, and minMarks must be between 0 and maxMarks`, 400);
      }

      return {
        subjectId: paper.subjectId,
        subjectType: paper.subjectType,
        maxMarks: paper.maxMarks,
        minMarks: paper.minMarks,
        paperCode: paper.paperCode,
        paperStartDateTime,
        paperEndDateTime,
        roomNo: paper.roomNo,
        gradeCriteria: paper.gradeCriteria
      };
    }));

    // Create the exam
    const exam = new Exam({
      schoolId,
      classId,
      academicYearId,
      examTitle,
      examCenter,
      startDate: examStartDate,
      endDate: examEndDate,
      examStatus,
      examPapers: validatedExamPapers
    });

    await exam.save();
    res.status(201).json(exam);
  } catch (error) {
    console.log('Error in createExam:', error.message);
    next(error);
  }
};

const updateExam = async (req, res, next) => {
  try {
    const examId = req.params.examId;
    const updateData = req.body;
    
    // Validate examId
    if (!mongoose.Types.ObjectId.isValid(examId)) {
      throw new APIError('Invalid exam ID', 400);
    }

    // Ensure required fields are present
    if (!updateData.examTitle || !updateData.examCenter || !updateData.startDate || !updateData.endDate || !updateData.examStatus) {
      throw new APIError('Missing required fields', 400);
    }
   
    const updatedExam = await Exam.findByIdAndUpdate(
      examId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('classId examPapers.subjectId');

    if (!updatedExam) {
      throw new APIError('Exam not found', 404);
    }

    res.status(200).json(updatedExam);
  } catch (error) {
    console.log('Error in updateExam:', error.message);
    next(error);
  }
};

const getExamById = async (req, res, next) => {
  try {
    const examId = req.params.examId;

    if (!mongoose.Types.ObjectId.isValid(examId)) {
      throw new APIError('Invalid exam ID', 400);
    }

    const exam = await Exam.findById(examId).populate('classId examPapers.subjectId');

    if (!exam) {
      throw new APIError('Exam not found', 404);
    }

    res.status(200).json(exam);
  } catch (error) {
    console.log('Error in getExamById:', error.message);
    next(error);
  }
};

// controllers/exam/examController.js
const getExamsByTeacher = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const schoolId = req.user.schoolId;
    const academicYearId = req.query.academicYearId || req.user.activeAcademicYear;
    const classId = req.query.classId;

    console.log('Current userId:', userId);

    // Find teacher document
    const teacherDoc = await Teacher.findOne({ userId });
    if (!teacherDoc) {
      console.log('No teacher profile found');
      return res.status(200).json([]);
    }

    console.log('Found teacher:', {
      _id: teacherDoc._id,
      name: teacherDoc.name
    });

    const subjects = await Subject.find({
      schoolId,
      $or: [
        { 
          'teacherAssignments.teacherId': teacherDoc._id, 
          'teacherAssignments.academicYearId': academicYearId 
        },
        { teachers: teacherDoc._id }
      ]
    }).populate('classes');
    console.log('Subjects found:', subjects.length ? subjects.map(s => ({
      _id: s._id,
      name: s.name,
      teacherAssignments: s.teacherAssignments,
      teachers: s.teachers
    })) : 'None');

    const classIds = subjects.flatMap(s => 
      s.classes.map(c => c._id.toString())
    );
    console.log('Authorized classIds:', classIds);

    if (!classIds.length) {
      console.log('No authorized classes found');
      return res.status(200).json([]);
    }

    const query = {
      schoolId,
      academicYearId,
      classId: classId ? classId : { $in: classIds }
    };
    console.log('Final exam query:', query);

    const exams = await Exam.find(query)
      .populate('classId')
      .populate('examPapers.subjectId');

    console.log('Exams found:', exams.length);
    res.status(200).json(exams);
  } catch (error) {
    console.error('Error in getExamsByTeacher:', error.message, error.stack);
    next(new APIError('Error fetching exams: ' + error.message, 500));
  }
};

// Fetch exam history for a class (Teacher with class access)
const getExamHistory = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { academicYearId } = req.query;

    if (!classId || !academicYearId) {
      return res.status(400).json({ message: 'Class ID and Academic Year ID are required' });
    }

    // Use externalRoleMiddleware to allow teachers with class authorization
    await require('../../middleware/roleMiddleware').externalRoleMiddleware('teacher')(req, res, () => {
      const Teacher = require('../../models/teacher');
      const Subject = require('../../models/subject');
      return new Promise(async (resolve, reject) => {
        const teacher = await Teacher.findOne({ userId: req.user.id });
        if (!teacher) return reject(new APIError('Teacher profile not found', 404));

        const subjects = await Subject.find({
          schoolId: req.user.schoolId,
          'teacherAssignments.teacherId': teacher._id,
          'teacherAssignments.academicYearId': academicYearId,
        }).populate('classes');

        const classIds = subjects.flatMap(subject => subject.classes.map(cls => cls._id.toString()));
        if (!classIds.includes(classId)) {
          return reject(new APIError('Not authorized for this class', 403));
        }
        resolve();
      });
    });

    const exams = await Exam.find({
      classId,
      academicYearId,
    })
      .populate('classId')
      .populate('examPapers.subjectId');

    res.status(200).json(exams || []);
  } catch (error) {
    console.error('Error fetching exam history:', error);
    next(error);
  }
};

// Fetch all exams for a school (Super Admin or Admin only)
const getExamsBySchool = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { academicYearId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      throw new APIError('Invalid school ID', 400);
    }

    if (schoolId !== req.user.schoolId) {
      throw new APIError('Not authorized to access this school’s exams', 403);
    }

    if (!['superadmin', 'admin'].includes(req.user.role)) {
      throw new APIError('Only Super Admins or Admins can view all school exams', 403);
    }

    const query = { schoolId };
    if (academicYearId) {
      if (!mongoose.Types.ObjectId.isValid(academicYearId)) {
        throw new APIError('Invalid academic year ID', 400);
      }
      query.academicYearId = academicYearId;

      const academicYear = await AcademicYear.findById(academicYearId);
      if (!academicYear || academicYear.schoolId.toString() !== schoolId) {
        throw new APIError('Academic year not found or not authorized', 404);
      }
    } else {
      // Default to active academic year if not provided
      const school = await School.findById(schoolId).select('activeAcademicYear');
      if (school && school.activeAcademicYear) {
        query.academicYearId = school.activeAcademicYear.toString();
      } else {
        throw new APIError('No active academic year set for this school', 400);
      }
    }

    const exams = await Exam.find(query)
      .populate('classId', 'name')
      .populate('examPapers.subjectId', 'name');

    if (!exams || exams.length === 0) {
      return res.status(200).json([]);
    }

    res.status(200).json(exams);
  } catch (error) {
    console.log('Error in getExamsBySchool:', error.message);
    next(error);
  }
};

// Aggregate exam summary (Super Admin or Admin only)
const getExamSummary = async (req, res, next) => {
  try {
    if (!['superadmin', 'admin'].includes(req.user.role)) {
      throw new APIError('Only Super Admins or Admins can view exam summary', 403);
    }

    const { academicYearId, startDate, endDate } = req.query;
    const schoolId = req.user.schoolId;

    if (!academicYearId) {
      throw new APIError('Academic Year ID is required', 400);
    }

    const academicYear = await AcademicYear.findById(academicYearId);
    if (!academicYear || academicYear.schoolId.toString() !== schoolId) {
      throw new APIError('Academic year not found or not authorized', 404);
    }

    const matchCriteria = {
      schoolId: new mongoose.Types.ObjectId(schoolId),
      academicYearId: new mongoose.Types.ObjectId(academicYearId)
    };

    if (startDate || endDate) {
      matchCriteria.startDate = {};
      if (startDate) matchCriteria.startDate.$gte = new Date(startDate);
      if (endDate) matchCriteria.startDate.$lte = new Date(endDate);
    }

    const summary = await Exam.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: '$classId',
          totalExams: { $sum: 1 },
          examNames: { $push: '$examTitle' }
        }
      },
      {
        $lookup: {
          from: 'classes',
          localField: '_id',
          foreignField: '_id',
          as: 'classInfo'
        }
      },
      { $unwind: '$classInfo' },
      {
        $project: {
          classId: '$_id',
          className: '$classInfo.name',
          totalExams: 1,
          examNames: 1,
          _id: 0
        }
      }
    ]);

    res.status(200).json(summary);
  } catch (error) {
    console.log('Error in getExamSummary:', error.message);
    next(error);
  }
};

const getExamsForResultEntry = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const schoolId = req.user.schoolId;
    const academicYearId = req.user.activeAcademicYear;

    // Find teacher document
    const teacherDoc = await Teacher.findOne({ userId });
    if (!teacherDoc) {
      return res.status(200).json({
        success: false,
        message: "Teacher profile not found",
        exams: []
      });
    }

    // Get assigned subjects
    const subjects = await Subject.find({
      schoolId,
      $or: [
        { 
          'teacherAssignments.teacherId': teacherDoc._id,
          'teacherAssignments.academicYearId': academicYearId 
        },
        { teachers: teacherDoc._id }
      ]
    }).populate('classes');

    const classIds = [...new Set(subjects.flatMap(s => 
      s.classes.map(c => c._id.toString())
    ))];
    
    const subjectIds = subjects.map(s => s._id.toString());

    // Get exams for these classes
    const exams = await Exam.find({
      classId: { $in: classIds },
      schoolId,
      academicYearId
    })
    .populate({
      path: 'examPapers.subjectId',
      select: '_id name'
    })
    .populate('classId');

    const filteredExams = exams.map(exam => ({
      ...exam.toObject(),
      examPapers: exam.examPapers.filter(paper => 
        subjectIds.includes(paper.subjectId?._id?.toString())
      )
    })).filter(exam => exam.examPapers.length > 0);

    if (filteredExams.length === 0) {
      return res.status(200).json({
        success: false,
        message: "No exams available for your assigned subjects and classes",
        exams: []
      });
    }

    res.status(200).json({
      success: true,
      message: "Exams retrieved successfully",
      exams: filteredExams
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: "Error fetching exams",
      error: error.message
    });
  }
};


module.exports = { createExam, getExamHistory, getExamSummary, getExamsBySchool, getExamsByTeacher,updateExam,getExamById ,getExamsForResultEntry};