const Result = require('../../models/result');
const Exam = require('../../models/exam');
const Student = require('../../models/student');
const Subject = require('../../models/subject'); // Fixed typo: 'subject' to 'Subject'
const APIError = require('../../utils/apiError');
const mongoose = require('mongoose');
const Teacher = require('../../models/teacher');

const MINIMUM_PASSING_PERCENTAGE_PER_SUBJECT = 33;

// Helper Functions
const calculateGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  if (percentage >= 40) return 'E';
  return 'F';
};

// Create a Partial Result (Teacher)
const createPartialResult = async (req, res, next) => {
  try {
    const { studentId, examId, classId, subjectId, marksObtained } = req.body;

    // Validate IDs and data
    if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(examId) ||
        !mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(subjectId)) {
      throw new APIError('Invalid ID provided', 400);
    }
    if (!marksObtained || marksObtained < 0) {
      throw new APIError('Marks obtained must be a non-negative number', 400);
    }

    // Check if the result already exists
    const existingResult = await Result.findOne({ studentId, examId, subjectId });
    if (existingResult) {
      throw new APIError('Result already exists for this student, exam, and subject', 400);
    }

    // Fetch and validate exam
    const exam = await Exam.findById(examId).populate('examPapers.subjectId');
    if (!exam) {
      throw new APIError('Exam not found', 404);
    }
    const examPaper = exam.examPapers.find(p => p.subjectId._id.toString() === subjectId);
    if (!examPaper) {
      throw new APIError('Subject not found in exam papers', 400);
    }
    if (marksObtained > examPaper.maxMarks) {
      throw new APIError(`Marks obtained (${marksObtained}) exceed max marks (${examPaper.maxMarks})`, 400);
    }

    // Authorize teacher
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: req.user.id });
      if (!teacher) throw new APIError('Teacher profile not found', 404);
      const authorizedSubjects = await Subject.find({
        schoolId: req.user.schoolId,
        $or: [
          { 'teacherAssignments.teacherId': teacher._id, 'teacherAssignments.academicYearId': req.user.activeAcademicYear },
          { teachers: teacher._id }
        ]
      });
      const teacherSubjectIds = authorizedSubjects.map(s => s._id.toString());
      if (!teacherSubjectIds.includes(subjectId)) {
        throw new APIError('Not authorized for this subject', 403);
      }
    }

    // Create partial result
    const result = new Result({
      studentId, examId, classId, subjectId, marksObtained,
      schoolId: req.user.schoolId, academicYearId: req.user.activeAcademicYear
    });
    await result.save();
    res.status(201).json(result);
  } catch (error) {
    console.log('Error in createPartialResult:', error.message);
    next(new APIError('Error creating partial result: ' + error.message, 500));
  }
};

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

    // Verify exam and student
    const exam = await Exam.findById(examId).populate('examPapers.subjectId');
    if (!exam || exam.schoolId.toString() !== schoolId) {
      throw new APIError('Exam not found or not authorized', 404);
    }
    const student = await Student.findById(studentId);
    if (!student || student.schoolId.toString() !== schoolId) {
      throw new APIError('Student not found or not authorized', 404);
    }
    if (exam.classId.toString() !== classId || exam.classId.toString() !== student.classId.toString()) {
      throw new APIError('Student or class does not match the exam class', 400);
    }

    // Authorize teacher
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: req.user.id });
      if (!teacher) throw new APIError('Teacher profile not found', 404);
      const teacherId = teacher._id.toString();
      const authorizedSubjects = await Subject.find({
        schoolId, $or: [
          { 'teacherAssignments.teacherId': teacherId, 'teacherAssignments.academicYearId': academicYearId },
          { teachers: teacherId }
        ]
      }).populate('classes');
      const classIds = authorizedSubjects.flatMap(s => s.classes.map(c => c._id.toString()));
      if (!classIds.includes(classId)) throw new APIError('Not authorized for this class', 403);
      const teacherSubjectIds = authorizedSubjects.map(s => s._id.toString());
      const unauthorizedSubjects = subjects.filter(s => !teacherSubjectIds.includes(s.subjectId._id.toString()));
      if (unauthorizedSubjects.length > 0) {
        throw new APIError(`Not authorized to enter results for subject(s): ${unauthorizedSubjects.map(s => s.subjectId.name).join(', ')}`, 403);
      }
    }

    // Validate subjects and calculate totals
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

// Compile Result (Admin Only)
const compileResult = async (req, res, next) => {
  try {
    const { studentId, examId } = req.body;
    if (!['superadmin', 'admin'].includes(req.user.role)) {
      throw new APIError('Only admins can compile results', 403);
    }

    // Note: PartialResult model is undefined; assume it's a typo and use Result for partials
    const partialResults = await Result.find({ studentId, examId, subjectId: { $exists: true } }); // Fetch partial results
    const exam = await Exam.findById(examId);
    const examSubjectIds = exam.examPapers.map(p => p.subjectId.toString());

    const markedSubjectIds = partialResults.map(pr => pr.subjectId.toString());
    if (examSubjectIds.length !== markedSubjectIds.length || examSubjectIds.some(id => !markedSubjectIds.includes(id))) {
      throw new APIError('Not all subjects have marks entered', 400);
    }

    let totalMarksObtained = 0;
    let totalMaxMarks = 0;
    let hasFailedSubject = false;

    const resultSubjects = partialResults.map(pr => {
      const examPaper = exam.examPapers.find(p => p.subjectId.toString() === pr.subjectId.toString());
      const percentage = (pr.marksObtained / examPaper.maxMarks) * 100;
      if (percentage < MINIMUM_PASSING_PERCENTAGE_PER_SUBJECT) hasFailedSubject = true;
      totalMarksObtained += pr.marksObtained;
      totalMaxMarks += examPaper.maxMarks;
      return {
        subjectId: pr.subjectId,
        marksObtained: pr.marksObtained,
        maxMarks: examPaper.maxMarks,
        percentage,
        passed: percentage >= MINIMUM_PASSING_PERCENTAGE_PER_SUBJECT
      };
    });

    const percentage = (totalMarksObtained / totalMaxMarks) * 100;
    const grade = calculateGrade(percentage);
    const status = hasFailedSubject ? 'Fail' : 'Pass';

    const result = new Result({
      studentId, examId, schoolId: exam.schoolId, classId: exam.classId, academicYearId: exam.academicYearId,
      subjects: resultSubjects, totalMarksObtained, totalMaxMarks, percentage, grade, status
    });
    await result.save();
    res.status(201).json(result);
  } catch (error) {
    console.log('Error in compileResult:', error.message);
    next(error);
  }
};

// Get Partial Results (Teacher)
const getPartialResults = async (req, res, next) => {
  try {
    const { studentId, examId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(examId)) {
      throw new APIError('Invalid student ID or exam ID', 400);
    }

    const results = await Result.find({
      studentId, examId, schoolId: req.user.schoolId, academicYearId: req.user.activeAcademicYear,
      subjectId: { $exists: true } // Filter for partial results
    }).populate('subjectId', 'name');

    if (!results || results.length === 0) {
      return res.status(200).json([]);
    }

    const transformedResults = results.map(r => ({
      _id: r._id, studentId: r.studentId, examId: r.examId, classId: r.classId,
      subjectId: r.subjectId, marksObtained: r.marksObtained, schoolId: r.schoolId,
      academicYearId: r.academicYearId, createdAt: r.createdAt, updatedAt: r.updatedAt
    }));
    res.status(200).json(transformedResults);
  } catch (error) {
    console.log('Error in getPartialResults:', error.message);
    next(new APIError('Error fetching partial results: ' + error.message, 500));
  }
};

const getResultsByExam = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const schoolId = req.user.schoolId;

    const exam = await Exam.findById(examId);
    if (!exam || exam.schoolId.toString() !== schoolId) {
      throw new APIError('Exam not found or not authorized', 404);
    }

    let results;
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      results = await Result.find({ examId: examId, schoolId: schoolId })
        .populate('studentId', 'name rollNo')
        .populate('subjects.subjectId', 'name')
        .populate('subjectId', 'name');
      console.log('Admin results:', results);
    } else if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: req.user.id });
      if (!teacher) throw new APIError('Teacher profile not found', 404);
      console.log('Found teacher:', teacher);

      const teacherSubjects = await Subject.find({
        schoolId: schoolId,
        $or: [
          { 'teacherAssignments.teacherId': teacher._id, 'teacherAssignments.academicYearId': req.user.activeAcademicYear },
          { teachers: teacher._id }
        ]
      }).distinct('_id');
      console.log('Teacher subjects (raw):', teacherSubjects.map(s => s.toString()));

      results = await Result.find({ examId: examId, schoolId: schoolId })
        .populate('studentId', 'name rollNo')
        .populate('subjects.subjectId', 'name')
        .populate('subjectId', 'name');
      console.log('Raw results from DB:', results.map(r => ({
        _id: r._id,
        subjectId: r.subjectId ? r.subjectId._id.toString() : null,
        subjects: r.subjects.map(s => s.subjectId ? s.subjectId._id.toString() : null)
      })));

      results = results.map(result => {
        let filteredSubjects = [];
        // Handle partial results using subjectId
        if (result.subjectId && result.subjectId._id) {
          const subjectIdStr = result.subjectId._id.toString();
          console.log(`Checking subjectId: ${subjectIdStr} against ${teacherSubjects.map(s => s.toString()).join(', ')}`);
          if (teacherSubjects.some(s => s.toString() === subjectIdStr)) {
            filteredSubjects.push({
              subjectId: result.subjectId,
              marksObtained: result.marksObtained,
              maxMarks: 100
            });
          }
        }
        // Handle compiled results using subjects array
        else if (result.subjects && result.subjects.length > 0) {
          filteredSubjects = result.subjects.filter(subject =>
            teacherSubjects.some(s => s.toString() === subject.subjectId._id.toString())
          );
        }
        if (filteredSubjects.length === 0) return null;
        return {
          ...result.toObject(),
          subjects: filteredSubjects,
          totalMarksObtained: filteredSubjects.reduce((sum, s) => sum + (s.marksObtained || 0), 0),
          totalMaxMarks: filteredSubjects.reduce((sum, s) => sum + (s.maxMarks || 0), 0),
          percentage: filteredSubjects.length ? (filteredSubjects.reduce((sum, s) => sum + (s.marksObtained || 0), 0) / filteredSubjects.reduce((sum, s) => sum + (s.maxMarks || 0), 0)) * 100 : 0,
          status: filteredSubjects.some(s => (s.marksObtained / s.maxMarks) * 100 < 40) ? 'Fail' : 'Pass'
        };
      }).filter(result => result !== null);
      console.log('Filtered results:', results);
    }

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

    // Skip teacher authorization check if user is admin
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: req.user.id });
      if (!teacher) throw new APIError('Teacher profile not found', 404);
      
      const subjects = await Subject.find({
        schoolId, 
        'teacherAssignments.teacherId': teacher._id, 
        'teacherAssignments.academicYearId': academicYearId
      }).populate('classes');
      
      const classIds = subjects.flatMap(s => s.classes.map(c => c._id.toString()));
      if (!classIds.includes(classId)) {
        throw new APIError('Not authorized for this class', 403);
      }
    }

    // For admin, show all results; for teacher, show only their subjects
    let results;
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      console.log('working 1')
      results = await Result.find({ classId, academicYearId, schoolId })
        .populate('studentId', 'name rollNo')
        .populate('subjects.subjectId', 'name')
        .populate('examId', 'examTitle');
    } else {
      // Teacher view - only their subjects
      const teacher = await Teacher.findOne({ userId: req.user.id });
      const teacherSubjects = await Subject.find({
        'teacherAssignments.teacherId': teacher._id,
        'teacherAssignments.academicYearId': academicYearId
      });
      
      results = await Result.find({ classId, academicYearId, schoolId })
        .populate('studentId', 'name rollNo')
        .populate('subjects.subjectId', 'name')
        .populate('examId', 'examTitle');
      
      // Filter to only show teacher's subjects
      results = results.map(result => {
        const filteredSubjects = result.subjects.filter(subject => 
          teacherSubjects.some(ts => ts._id.toString() === subject.subjectId._id.toString())
        );
        return {
          ...result.toObject(),
          subjects: filteredSubjects
        };
      });
    }

    res.status(200).json(results || []);
  } catch (error) {
    console.log('Error in getResultsByClassAndAcademicYear:', error.message);
    next(error);
  }
};


const getAllResultsForClass = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { academicYearId } = req.query;
    const schoolId = req.user.schoolId;

    if (!classId || !academicYearId) {
      throw new APIError('Class ID and Academic Year ID are required', 400);
    }

    // Fetch all partial and compiled results
    const partialResults = await Result.find({ 
      classId, 
      academicYearId, 
      schoolId,
      subjectId: { $exists: true } // Only partial results
    })
    .populate('studentId', 'name rollNo')
    .populate('examId', 'examTitle examPapers')
    .populate('subjectId', 'name');

    const compiledResults = await Result.find({
      classId,
      academicYearId,
      schoolId,
      subjects: { $exists: true, $ne: [] } // Only compiled results
    })
    .populate('studentId', 'name rollNo')
    .populate('examId', 'examTitle examPapers')
    .populate('subjects.subjectId', 'name');

    // Combine partial and compiled results
    const allResults = [...partialResults, ...compiledResults];

    // Group by studentId and examId to consolidate subjects
    const resultsByStudentExam = {};
    allResults.forEach(result => {
      const key = `${result.studentId._id}-${result.examId._id}`;
      
      if (!resultsByStudentExam[key]) {
        resultsByStudentExam[key] = {
          studentId: result.studentId,
          examId: result.examId,
          classId: result.classId,
          schoolId: result.schoolId,
          academicYearId: result.academicYearId,
          subjects: [],
          totalMarksObtained: 0,
          totalMaxMarks: 0
        };
      }

      // Handle compiled results
      if (result.subjects && result.subjects.length > 0) {
        result.subjects.forEach(subject => {
          if (!resultsByStudentExam[key].subjects.some(s => 
            s.subjectId._id.toString() === subject.subjectId._id.toString()
          )) {
            // Fetch minMarks from the exam paper for this subject
            const examPaper = result.examId.examPapers.find(p => 
              p.subjectId._id.toString() === subject.subjectId._id.toString()
            );
            const minMarks = examPaper ? examPaper.minMarks : 0;

            resultsByStudentExam[key].subjects.push({
              ...subject,
              passingMarks: minMarks // Add passing marks
            });
            resultsByStudentExam[key].totalMarksObtained += subject.marksObtained;
            resultsByStudentExam[key].totalMaxMarks += subject.maxMarks;
          }
        });
      }
      // Handle partial results
      else if (result.subjectId) {
        const examPaper = result.examId.examPapers.find(p => 
          p.subjectId._id.toString() === result.subjectId._id.toString()
        );
        const minMarks = examPaper ? examPaper.minMarks : 100; // Default to 100 if not found

        const existingSubjectIndex = resultsByStudentExam[key].subjects.findIndex(
          s => s.subjectId._id.toString() === result.subjectId._id.toString()
        );
        
        if (existingSubjectIndex === -1) {
          resultsByStudentExam[key].subjects.push({
            subjectId: result.subjectId,
            marksObtained: result.marksObtained,
            maxMarks: 100, // Assuming max marks is 100 for partial results
            passingMarks: minMarks // Add passing marks
          });
          resultsByStudentExam[key].totalMarksObtained += result.marksObtained;
          resultsByStudentExam[key].totalMaxMarks += 100;
        }
      }
    });

    // Calculate percentage and status for each student's exam
    const finalResults = Object.values(resultsByStudentExam).map(result => {
      const percentage = result.totalMaxMarks > 0 
        ? (result.totalMarksObtained / result.totalMaxMarks) * 100 
        : 0;
      
      // Determine status based on individual subject passing marks
      const hasFailedSubject = result.subjects.some(subject => 
        subject.marksObtained < (subject.passingMarks || 0)
      );
      const status = hasFailedSubject ? 'Fail' : 'Pass';

      return {
        ...result,
        percentage,
        status,
        grade: calculateGrade(percentage)
      };
    });

    // Fetch exam details to ensure all subjects are included
    const exam = await Exam.findOne({ _id: finalResults[0]?.examId._id, classId, academicYearId })
      .populate('examPapers.subjectId', 'name');
    
    if (exam) {
      finalResults.forEach(result => {
        // Ensure all subjects from the exam are included, filling missing ones with 0 marks
        exam.examPapers.forEach(paper => {
          if (!result.subjects.some(s => s.subjectId._id.toString() === paper.subjectId._id.toString())) {
            result.subjects.push({
              subjectId: paper.subjectId,
              marksObtained: 0,
              maxMarks: paper.maxMarks,
              passingMarks: paper.minMarks // Add passing marks
            });
            result.totalMarksObtained += 0;
            result.totalMaxMarks += paper.maxMarks;
          }
        });
        const percentage = result.totalMaxMarks > 0 
          ? (result.totalMarksObtained / result.totalMaxMarks) * 100 
          : 0;
        const hasFailedSubject = result.subjects.some(subject => 
          subject.marksObtained < (subject.passingMarks || 0)
        );
        result.percentage = percentage;
        result.status = hasFailedSubject ? 'Fail' : 'Pass';
      });
    }

    res.status(200).json(finalResults);
  } catch (error) {
    console.log('Error in getAllResultsForClass:', error.message);
    next(error);
  }
};

// Get Student Results (Teacher)
const getStudentResults = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const schoolId = req.user.schoolId;
    const academicYearId = req.user.activeAcademicYear;

    const student = await Student.findById(studentId);
    if (!student || student.schoolId.toString() !== schoolId) {
      throw new APIError('Student not found or not authorized', 404);
    }

    if (req.user.role === 'teacher') {
      await require('../middleware/roleMiddleware').externalRoleMiddleware(['teacher'])(req, res, () => {
        return new Promise(async (resolve, reject) => {
          const teacher = await Teacher.findOne({ userId: req.user.id });
          if (!teacher) return reject(new APIError('Teacher profile not found', 404));
          const subjects = await Subject.find({
            schoolId, 'teacherAssignments.teacherId': teacher._id, 'teacherAssignments.academicYearId': academicYearId
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

module.exports = {
  createResult, compileResult, getResultsByExam, getStudentResults,
  getResultsByClassAndAcademicYear, createPartialResult, getPartialResults,getAllResultsForClass
};