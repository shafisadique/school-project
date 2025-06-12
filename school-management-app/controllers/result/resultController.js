// controllers/result/resultController.js
const Result = require('../../models/result');
const Exam = require('../../models/exam');
const Student = require('../../models/student');
const APIError = require('../../utils/apiError');

const MINIMUM_PASSING_PERCENTAGE_PER_SUBJECT = 33;

const createResult = async (req, res, next) => {
  try {
    const { studentId, examId, classId, subjects } = req.body;
    const schoolId = req.user.schoolId;
    const academicYearId = req.user.activeAcademicYear;

    // Validate inputs
    if (!studentId || !examId || !classId || !subjects || !subjects.length) {
      throw new APIError('Missing required fields: studentId, examId, classId, and subjects are required', 400);
    }

    // Verify the exam and populate examPapers.subjectId
    const exam = await Exam.findById(examId).populate('examPapers.subjectId');
    if (!exam || exam.schoolId.toString() !== schoolId) {
      throw new APIError('Exam not found or not authorized', 404);
    }

    // Verify the student
    const student = await Student.findById(studentId);
    if (!student || student.schoolId.toString() !== schoolId) {
      throw new APIError('Student not found or not authorized', 404);
    }

    // Ensure the class matches
    if (exam.classId.toString() !== classId || exam.classId.toString() !== student.classId.toString()) {
      throw new APIError('Student or class does not match the exam class', 400);
    }

    // Validate academic year
    if (exam.academicYearId.toString() !== academicYearId) {
      throw new APIError('Exam does not belong to the current academic year', 400);
    }

    // Validate subjects, calculate totals, and check per-subject passing
    let totalMarksObtained = 0;
    let totalMaxMarks = 0;
    let hasFailedSubject = false; // Track if the student failed any subject

    const resultSubjects = subjects.map(subject => {
      // Find the corresponding exam paper
      const examPaper = exam.examPapers.find(p => p.subjectId._id.toString() === subject.subjectId);
      if (!examPaper) {
        throw new APIError(`Subject ${subject.subjectId} not found in exam`, 400);
      }
      if (subject.marksObtained < 0 || subject.marksObtained > examPaper.maxMarks) {
        throw new APIError(
          `Marks obtained for subject ${examPaper.subjectId.name} must be between 0 and ${examPaper.maxMarks}`,
          400
        );
      }

      // Calculate per-subject percentage
      const subjectPercentage = (subject.marksObtained / examPaper.maxMarks) * 100;

      // Check if the student failed this subject
      if (subjectPercentage < MINIMUM_PASSING_PERCENTAGE_PER_SUBJECT) {
        hasFailedSubject = true;
      }

      // Add to totals for overall percentage (for reporting purposes)
      totalMarksObtained += subject.marksObtained;
      totalMaxMarks += examPaper.maxMarks;

      return {
        subjectId: subject.subjectId,
        marksObtained: subject.marksObtained,
        maxMarks: examPaper.maxMarks,
        percentage: subjectPercentage, // Store per-subject percentage
        passed: subjectPercentage >= MINIMUM_PASSING_PERCENTAGE_PER_SUBJECT, // Store pass/fail status for this subject
      };
    });

    // Calculate overall percentage (for reporting, not for pass/fail decision)
    const percentage = totalMaxMarks > 0 ? (totalMarksObtained / totalMaxMarks) * 100 : 0;
    const grade = calculateGrade(percentage);
    const status = hasFailedSubject ? 'Fail' : 'Pass'; // Pass only if all subjects are passed

    // Create the result
    const result = new Result({
      studentId,
      examId,
      schoolId,
      classId,
      academicYearId,
      subjects: resultSubjects,
      totalMarksObtained,
      totalMaxMarks,
      percentage, // Overall percentage
      grade,
      status,
    });

    await result.save();
    res.status(201).json(result);
  } catch (error) {
    console.log('Error in createResult:', error.message);
    next(error);
  }
};
  
  // Helper function to calculate grade (unchanged)
  const calculateGrade = (percentage) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    if (percentage >= 40) return 'E';
    return 'F';
  };

const getResultsByExam = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const schoolId = req.user.schoolId;

    const results = await Result.find({ examId, schoolId })
      .populate('studentId', 'name rollNo')
      .populate('subjects.subjectId', 'name');

    res.status(200).json(results || []); // Return results or an empty array
  } catch (error) {
    console.log('Error in getResultsByExam:', error.message);
    next(error);
  }
};

const getResultsByClassAndAcademicYear = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { academicYearId } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId || !academicYearId) {
      throw new APIError('Class ID and Academic Year ID are required', 400);
    }

    const results = await Result.find({ classId, academicYearId, schoolId })
      .populate('studentId', 'name rollNo')
      .populate('subjects.subjectId', 'name')
      .populate('examId', 'examTitle');

    res.status(200).json(results || []);
  } catch (error) {
    console.log('Error in getResultsByClassAndAcademicYear:', error.message);
    next(error);
  }
};


const getStudentResults = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const schoolId = req.user.schoolId;
    const academicYearId = req.user.activeAcademicYear;

    const results = await Result.find({ studentId, schoolId, academicYearId })
      .populate('examId', 'examName startDate endDate')
      .populate('subjects.subjectId', 'name');

    if (!results || results.length === 0) {
      throw new APIError('No results found for this student', 404);
    }

    res.status(200).json(results);
  } catch (error) {
    console.log('Error in getStudentResults:', error.message);
    next(error);
  }
};


  
  // Helper function to convert number to Roman numeral (e.g., 1 to I, 2 to II)
  const romanize = (num) => {
    const romanNumerals = [
      { value: 10, numeral: 'X' },
      { value: 9, numeral: 'IX' },
      { value: 5, numeral: 'V' },
      { value: 4, numeral: 'IV' },
      { value: 1, numeral: 'I' }
    ];
    let result = '';
    for (const { value, numeral } of romanNumerals) {
      while (num >= value) {
        result += numeral;
        num -= value;
      }
    }
    return result;
  };
  
  // Add to exports
  module.exports = { createResult, getResultsByExam, getStudentResults,getResultsByClassAndAcademicYear };
