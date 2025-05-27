// controllers/result/resultController.js
const Result = require('../../models/result');
const Exam = require('../../models/exam');
const Student = require('../../models/student');
const APIError = require('../../utils/apiError');

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
  
      // Validate subjects and calculate totals
      let totalMarksObtained = 0;
      let totalMaxMarks = 0;
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
        totalMarksObtained += subject.marksObtained;
        totalMaxMarks += examPaper.maxMarks;
        return {
          subjectId: subject.subjectId,
          marksObtained: subject.marksObtained,
          maxMarks: examPaper.maxMarks
        };
      });
  
      // Calculate percentage and grade
      const percentage = (totalMarksObtained / totalMaxMarks) * 100;
      const grade = calculateGrade(percentage);
      const status = percentage >= 40 ? 'Pass' : 'Fail'; // Example passing criteria
  
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
        percentage,
        grade,
        status
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


// controllers/result/resultController.js
const promoteStudents = async (req, res, next) => {
    try {
      const { classId, academicYearId } = req.body;
      const schoolId = req.user.schoolId;
  
      // Validate inputs
      if (!classId || !academicYearId) {
        throw new APIError('Class ID and Academic Year ID are required', 400);
      }
  
      // Fetch students in the class
      const students = await Student.find({ classId, schoolId });
      if (!students || students.length === 0) {
        throw new APIError('No students found in this class', 404);
      }
  
      // Fetch results for the academic year
      const results = await Result.find({ classId, academicYearId, schoolId });
      const studentResults = new Map(results.map(r => [r.studentId.toString(), r]));
  
      // Determine the next class (simplified logic: increment class name, e.g., Class I to Class II)
      const currentClass = await Class.findById(classId);
      if (!currentClass) {
        throw new APIError('Class not found', 404);
      }
  
      let nextClassName;
      if (currentClass.name === 'Class XII') {
        // If Class XII, students "graduate" (you can handle this differently)
        throw new APIError('Students in Class XII cannot be promoted further', 400);
      } else if (currentClass.name === 'Pre-Nursery') {
        nextClassName = 'Nursery';
      } else if (currentClass.name === 'Nursery') {
        nextClassName = 'KG';
      } else if (currentClass.name === 'KG') {
        nextClassName = 'Class I';
      } else {
        const currentClassNumber = parseInt(currentClass.name.split(' ')[1]);
        nextClassName = `Class ${romanize(currentClassNumber + 1)}`;
      }
  
      // Find or create the next class
      let nextClass = await Class.findOne({ name: nextClassName, schoolId });
      if (!nextClass) {
        nextClass = new Class({
          name: nextClassName,
          schoolId,
          sections: currentClass.sections // Copy sections for simplicity
        });
        await nextClass.save();
      }
  
      // Promote students who passed
      const promotionPromises = students.map(async (student) => {
        const result = studentResults.get(student._id.toString());
        if (result && result.status === 'Pass') {
          student.classId = nextClass._id;
          await student.save();
        }
      });
  
      await Promise.all(promotionPromises);
      res.status(200).json({ message: 'Students promoted successfully' });
    } catch (error) {
      console.log('Error in promoteStudents:', error.message);
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
  module.exports = { createResult, getResultsByExam, getStudentResults, promoteStudents };
