const Exam = require('../../models/exam');
const Class = require('../../models/class');
const School = require('../../models/school');
const Subject = require('../../models/subject');
const APIError = require('../../utils/apiError');
const mongoose = require('mongoose');
const AcademicYear = require('../../models/academicyear');

// Create an exam
const createExam = async (req, res, next) => {
  try {
    console.log('createExam called with:', { body: req.body, user: req.user });
    const { classId, academicYearId: academicYearIdFromBody, examTitle, examCenter, startDate, endDate, examStatus, examPapers } = req.body;
    const schoolId = req.user.schoolId;

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

// Fetch exam history for a class (unchanged)
const getExamHistory = async (req, res) => {
  try {
    const { classId } = req.params;
    const { academicYearId } = req.query;

    if (!classId || !academicYearId) {
      return res.status(400).json({ message: 'Class ID and Academic Year ID are required' });
    }

    const academicYear = await AcademicYear.findById(academicYearId);
    if (!academicYear) {
      return res.status(404).json({ message: 'Academic Year not found' });
    }

    const exams = await Exam.find({
      classId,
      academicYearId,
    })
      .populate('classId')
      .populate('subjects.subjectId');

    if (!exams || exams.length === 0) {
      return res.status(404).json({ message: 'No exams found' });
    }

    res.status(200).json(exams);
  } catch (error) {
    console.error('Error fetching exam history:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Fetch all exams for a school
const getExamsBySchool = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { academicYearId } = req.query;

    // Validate schoolId
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      throw new APIError('Invalid school ID', 400);
    }

    // Ensure the user has access to this school
    if (schoolId !== req.user.schoolId) {
      throw new APIError('Not authorized to access this school’s exams', 403);
    }

    // Build query
    const query = { schoolId };
    if (academicYearId) {
      if (!mongoose.Types.ObjectId.isValid(academicYearId)) {
        throw new APIError('Invalid academic year ID', 400);
      }
      query.academicYearId = academicYearId;

      // Verify academic year belongs to the school
      const academicYear = await AcademicYear.findById(academicYearId);
      if (!academicYear || academicYear.schoolId.toString() !== schoolId) {
        throw new APIError('Academic year not found or not authorized', 404);
      }
    }

    // Fetch exams
    const exams = await Exam.find(query)
      .populate('classId', 'name')
      .populate('examPapers.subjectId', 'name');

    if (!exams || exams.length === 0) {
      return res.status(200).json([]); // Return empty array instead of 404 for better UX
    }

    res.status(200).json(exams);
  } catch (error) {
    console.log('Error in getExamsBySchool:', error.message);
    next(error);
  }
};

// Export the new method

// Aggregate exam summary (unchanged)
const getExamSummary = async (req, res, next) => {
  try {
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

module.exports = { createExam, getExamHistory, getExamSummary, getExamsBySchool };
