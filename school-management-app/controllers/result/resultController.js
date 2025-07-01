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

    console.log('Request body:', { studentId, examId, classId, subjects });

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

    // Authorize teacher for the subjects
    if (req.user.role === 'teacher') {
      const Teacher = require('../../models/teacher');
      const teacher = await Teacher.findOne({ userId: req.user.id });
      if (!teacher) throw new APIError('Teacher profile not found', 404);
      const teacherId = teacher._id.toString();

      const authorizedSubjects = await require('../../models/subject').find({
        schoolId,
        $or: [
          { 'teacherAssignments.teacherId': teacherId, 'teacherAssignments.academicYearId': academicYearId },
          { teachers: teacherId }
        ]
      }).populate('classes');

      console.log('Authorized subjects with details:', authorizedSubjects);
      const classIds = authorizedSubjects.flatMap(s => s.classes.map(c => c._id.toString()));
      if (!classIds.includes(classId)) throw new APIError('Not authorized for this class', 403);

      const teacherSubjectIds = authorizedSubjects.map(s => s._id.toString());
      const examSubjectIds = exam.examPapers.map(p => p.subjectId._id.toString());
      console.log('Teacher subject IDs:', teacherSubjectIds);
      console.log('Exam subject IDs:', examSubjectIds);
      const unauthorizedSubjects = subjects.filter(s => {
        const subjectIdStr = s.subjectId._id.toString();
        // Only check if teacher is assigned to subject, not if it's in exam
        return !teacherSubjectIds.includes(subjectIdStr);
      });
      if (unauthorizedSubjects.length > 0) {
          console.log('Unauthorized subjects:', unauthorizedSubjects.map(s => ({ 
            _id: s.subjectId._id, 
            name: s.subjectId.name 
          })));
          throw new APIError(`Not authorized to enter results for subject(s): ${
            unauthorizedSubjects.map(s => s.subjectId.name).join(', ')
          }`, 403);
        }
    }

    // Validate subjects, calculate totals, and check per-subject passing
    let totalMarksObtained = 0;
    let totalMaxMarks = 0;
    let hasFailedSubject = false;

    const resultSubjects = subjects.map(subject => {
      const examPaper = exam.examPapers.find(p => p.subjectId._id.toString() === subject.subjectId._id.toString());
      if (!examPaper) throw new APIError(`Subject ${subject.subjectId._id} not found in exam`, 400);
      if (subject.marksObtained < 0 || subject.marksObtained > examPaper.maxMarks) {
        throw new APIError(`Marks for ${examPaper.subjectId.name} must be 0 to ${examPaper.maxMarks}`, 400);
      }

      const subjectPercentage = (subject.marksObtained / examPaper.maxMarks) * 100;
      if (subjectPercentage < MINIMUM_PASSING_PERCENTAGE_PER_SUBJECT) hasFailedSubject = true;

      totalMarksObtained += subject.marksObtained;
      totalMaxMarks += examPaper.maxMarks;

      return {
        subjectId: subject.subjectId._id,
        marksObtained: subject.marksObtained,
        maxMarks: examPaper.maxMarks,
        percentage: subjectPercentage,
        passed: subjectPercentage >= MINIMUM_PASSING_PERCENTAGE_PER_SUBJECT
      };
    });

    const percentage = totalMaxMarks > 0 ? (totalMarksObtained / totalMaxMarks) * 100 : 0;
    const grade = calculateGrade(percentage);
    const status = hasFailedSubject ? 'Fail' : 'Pass';

    const result = new Result({
      studentId, examId, schoolId, classId, academicYearId, subjects: resultSubjects,
      totalMarksObtained, totalMaxMarks, percentage, grade, status
    });

    await result.save();
    res.status(201).json(result);
  } catch (error) {
    console.log('Error in createResult:', error.message);
    next(error);
  }
};

// Helper function to calculate grade
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

    const exam = await Exam.findById(examId);
    if (!exam || exam.schoolId.toString() !== schoolId) {
      throw new APIError('Exam not found or not authorized', 404);
    }

    // Authorize teacher for the exam's class
    if (req.user.role === 'teacher') {
      await require('../middleware/roleMiddleware').externalRoleMiddleware(['teacher'])(req, res, () => {
        return new Promise(async (resolve, reject) => {
          const Teacher = require('../../models/teacher');
          const teacher = await Teacher.findOne({ userId: req.user.id });
          if (!teacher) return reject(new APIError('Teacher profile not found', 404));

          const subjects = await require('../../models/subject').find({
            schoolId,
            'teacherAssignments.teacherId': teacher._id,
            'teacherAssignments.academicYearId': req.user.activeAcademicYear,
          }).populate('classes');

          const classIds = subjects.flatMap(s => s.classes.map(c => c._id.toString()));
          if (!classIds.includes(exam.classId.toString())) {
            return reject(new APIError('Not authorized for this class', 403));
          }
          resolve();
        });
      });
    }

    const results = await Result.find({ examId, schoolId })
      .populate('studentId', 'name rollNo')
      .populate('subjects.subjectId', 'name');

    res.status(200).json(results || []);
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

    // Authorize teacher for the class
    if (req.user.role === 'teacher') {
      await require('../middleware/roleMiddleware').externalRoleMiddleware(['teacher'])(req, res, () => {
        return new Promise(async (resolve, reject) => {
          const Teacher = require('../../models/teacher');
          const teacher = await Teacher.findOne({ userId: req.user.id });
          if (!teacher) return reject(new APIError('Teacher profile not found', 404));

          const subjects = await require('../../models/subject').find({
            schoolId,
            'teacherAssignments.teacherId': teacher._id,
            'teacherAssignments.academicYearId': academicYearId,
          }).populate('classes');

          const classIds = subjects.flatMap(s => s.classes.map(c => c._id.toString()));
          if (!classIds.includes(classId)) {
            return reject(new APIError('Not authorized for this class', 403));
          }
          resolve();
        });
      });
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

    const student = await Student.findById(studentId);
    if (!student || student.schoolId.toString() !== schoolId) {
      throw new APIError('Student not found or not authorized', 404);
    }

    // Authorize teacher for the student's class
    if (req.user.role === 'teacher') {
      await require('../middleware/roleMiddleware').externalRoleMiddleware(['teacher'])(req, res, () => {
        return new Promise(async (resolve, reject) => {
          const Teacher = require('../../models/teacher');
          const teacher = await Teacher.findOne({ userId: req.user.id });
          if (!teacher) return reject(new APIError('Teacher profile not found', 404));

          const subjects = await require('../../models/subject').find({
            schoolId,
            'teacherAssignments.teacherId': teacher._id,
            'teacherAssignments.academicYearId': academicYearId,
          }).populate('classes');

          const classIds = subjects.flatMap(s => s.classes.map(c => c._id.toString()));
          if (!classIds.includes(student.classId.toString())) {
            return reject(new APIError('Not authorized for this class', 403));
          }
          resolve();
        });
      });
    }

    const results = await Result.find({ studentId, schoolId, academicYearId })
      .populate('examId', 'examTitle startDate endDate')
      .populate('subjects.subjectId', 'name');

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

module.exports = { createResult, getResultsByExam, getStudentResults, getResultsByClassAndAcademicYear };