// controllers/exam/examControllers.js
const Exam = require('../../models/exam');
const Class = require('../../models/class');
const School = require('../../models/school');
const APIError = require('../../utils/apiError');
const mongoose = require('mongoose');
const academicyear = require('../../models/academicyear');

// Create an exam
const createExam = async (req, res, next) => {
  try {
    console.log('createExam called with:', { body: req.body, user: req.user });
    const { classId, academicYearId: academicYearIdFromBody, examName, startDate, endDate, subjects } = req.body;
    const schoolId = req.user.schoolId;

    // Validate inputs
    if (!classId || !examName || !startDate || !endDate || !subjects?.length) {
      console.log('Missing fields:', { classId, examName, startDate, endDate, subjects });
      throw new APIError('Missing required fields', 400);
    }

    // Validate date range
    const examStartDate = new Date(startDate);
    const examEndDate = new Date(endDate);
    if (examStartDate > examEndDate) {
      throw new APIError('Start date cannot be after end date', 400);
    }

    // Fetch the active academic year if not provided
    const school = await School.findById(schoolId).select('activeAcademicYear');
    if (!school || !school.activeAcademicYear) {
      throw new APIError('No active academic year set for this school', 400);
    }
    const academicYearId = academicYearIdFromBody || school.activeAcademicYear.toString();
    console.log('Fetched activeAcademicYearId:', academicYearId);

    // Verify academic year
    const academicYear = await academicyear.findById(academicYearId);
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

    // Validate subject dates (if provided) are within exam startDate and endDate
    const examSubjects = subjects.map(subject => {
      const subjectDate = subject.date ? new Date(subject.date) : null;
      if (subjectDate && (subjectDate < examStartDate || subjectDate > examEndDate)) {
        throw new APIError(`Subject date ${subject.date} must be within exam date range`, 400);
      }
      return {
        subjectId: subject.subjectId,
        maxMarks: subject.maxMarks,
        date: subjectDate
      };
    });

    // Create the exam (uniqueness is enforced by the index)
    const exam = new Exam({
      schoolId,
      classId,
      academicYearId,
      examName,
      startDate: examStartDate,
      endDate: examEndDate,
      subjects: examSubjects
    });

    await exam.save();
    res.status(201).json(exam);
  } catch (error) {
    console.log('Error in createExam:', error.message);
    next(error);
  }
};

// Fetch exam history for a class (unchanged, but updated response will include startDate and endDate)
const getExamHistory = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { academicYearId } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId || !academicYearId) {
      throw new APIError('Class ID and Academic Year ID are required', 400);
    }

    // Verify the academic year
    const academicYear = await AcademicYear.findById(academicYearId);
    if (!academicYear || academicYear.schoolId.toString() !== schoolId) {
      throw new APIError('Academic year not found or not authorized', 404);
    }

    // Verify the class exists in this school
    const classExists = await Class.findOne({ _id: classId, schoolId });
    if (!classExists) {
      throw new APIError('Class not found in this school', 404);
    }

    // Fetch exams
    const exams = await Exam.find({
      schoolId,
      classId,
      academicYearId
    })
      .populate('classId', 'name')
      .populate('subjects.subjectId', 'name');

    res.status(200).json(exams);
  } catch (error) {
    console.log('Error in getExamHistory:', error.message);
    next(error);
  }
};

// Aggregate exam summary (updated to include date range filtering)
const getExamSummary = async (req, res, next) => {
  try {
    const { academicYearId, startDate, endDate } = req.query;
    const schoolId = req.user.schoolId;

    if (!academicYearId) {
      throw new APIError('Academic Year ID is required', 400);
    }

    // Verify the academic year
    const academicYear = await AcademicYear.findById(academicYearId);
    if (!academicYear || academicYear.schoolId.toString() !== schoolId) {
      throw new APIError('Academic year not found or not authorized', 404);
    }

    // Build match criteria
    const matchCriteria = {
      schoolId: new mongoose.Types.ObjectId(schoolId),
      academicYearId: new mongoose.Types.ObjectId(academicYearId)
    };

    // Add date range filtering if provided
    if (startDate || endDate) {
      matchCriteria.startDate = {};
      if (startDate) matchCriteria.startDate.$gte = new Date(startDate);
      if (endDate) matchCriteria.startDate.$lte = new Date(endDate);
    }

    // Aggregate to count exams per class
    const summary = await Exam.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: '$classId',
          totalExams: { $sum: 1 },
          examNames: { $push: '$examName' }
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

module.exports = { createExam, getExamHistory, getExamSummary };