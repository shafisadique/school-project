const Result = require('../../models/result');
const Exam = require('../../models/exam');
const Student = require('../../models/student');
const Subject = require('../../models/subject'); // Fixed typo: 'subject' to 'Subject'
const APIError = require('../../utils/apiError');
const mongoose = require('mongoose');
const Teacher = require('../../models/teacher');
const ClassSubjectAssignment = require('../../models/classSubjectAssignment')
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
    // FIXED: Allow 0 explicitly (non-negative includes 0); check for null/undefined separately
    if (marksObtained == null || marksObtained < 0 || !Number.isFinite(marksObtained)) {
      throw new APIError('Marks obtained must be a valid non-negative number (0 or higher)', 400);
    }
    // Coerce to number if string (e.g., from form)
    const marksNum = Number(marksObtained);
    if (isNaN(marksNum)) {
      throw new APIError('Marks obtained must be a valid number', 400);
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
    if (marksNum > examPaper.maxMarks) {
      throw new APIError(`Marks obtained (${marksNum}) exceed max marks (${examPaper.maxMarks})`, 400);
    }

    // Authorize teacher (ALSO FIXED: Use ClassSubjectAssignment for consistency with exam fetching)
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: req.user.id });
      if (!teacher) throw new APIError('Teacher profile not found', 404);
      
      // FIXED: Query ClassSubjectAssignment instead of legacy teacherAssignments/teachers
      const assignment = await ClassSubjectAssignment.findOne({
        teacherId: teacher._id,
        subjectId,
        classId,
        academicYearId: req.user.activeAcademicYear,
        schoolId: req.user.schoolId
      });
      if (!assignment) {
        throw new APIError('Not authorized for this subject and class', 403);
      }
    }

    // Create partial result (use marksNum for safety)
    const result = new Result({
      studentId, examId, classId, subjectId, marksObtained: marksNum,
      schoolId: req.user.schoolId, academicYearId: req.user.activeAcademicYear
    });
    await result.save();
    res.status(201).json(result);
  } catch (error) {
    console.log('Error in createPartialResult:', error.message);
    next(new APIError('Error creating partial result: ' + error.message, 500));
  }
};


const updatePartialResult = async (req, res, next) => {
  try {
    const { resultId } = req.params;
    const { marksObtained } = req.body;

    // Validate resultId
    if (!mongoose.Types.ObjectId.isValid(resultId)) {
      throw new APIError('Invalid result ID', 400);
    }

    // Validate marksObtained
    if (marksObtained == null || marksObtained < 0 || !Number.isFinite(marksObtained)) {
      throw new APIError('Marks obtained must be a valid non-negative number (0 or higher)', 400);
    }
    const marksNum = Number(marksObtained);
    if (isNaN(marksNum)) {
      throw new APIError('Marks obtained must be a valid number', 400);
    }

    // Fetch existing result
    const existingResult = await Result.findById(resultId);
    if (!existingResult || existingResult.schoolId.toString() !== req.user.schoolId) {
      throw new APIError('Result not found or not authorized', 404);
    }
    if (!existingResult.subjectId) {
      throw new APIError('This is not a partial result (no subjectId)', 400);
    }

    // Fetch and validate exam
    const exam = await Exam.findById(existingResult.examId).populate('examPapers.subjectId');
    if (!exam) {
      throw new APIError('Exam not found', 404);
    }
    const examPaper = exam.examPapers.find(p => p.subjectId._id.toString() === existingResult.subjectId.toString());
    if (!examPaper) {
      throw new APIError('Subject not found in exam papers', 400);
    }
    if (marksNum > examPaper.maxMarks) {
      throw new APIError(`Marks obtained (${marksNum}) exceed max marks (${examPaper.maxMarks})`, 400);
    }

    // Authorize teacher
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: req.user.id });
      if (!teacher) throw new APIError('Teacher profile not found', 404);

      const assignment = await ClassSubjectAssignment.findOne({
        teacherId: teacher._id,
        subjectId: existingResult.subjectId,
        classId: existingResult.classId,
        academicYearId: req.user.activeAcademicYear,
        schoolId: req.user.schoolId
      });
      if (!assignment) {
        throw new APIError('Not authorized for this subject and class', 403);
      }
    }

    // Update marksObtained
    existingResult.marksObtained = marksNum;
    await existingResult.save();

    // Populate response
    const updatedResult = await Result.findById(resultId)
      .populate('studentId', 'name rollNo')
      .populate('subjectId', 'name')
      .populate('examId', 'examTitle');
    res.status(200).json(updatedResult);
  } catch (error) {
    console.log('Error in updatePartialResult:', error.message);
    next(new APIError('Error updating partial result: ' + error.message, 500));
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
      subjectId: r.subjectId._id, subjectName: r.subjectId.name, // FIXED: Include name
      marksObtained: r.marksObtained, schoolId: r.schoolId,
      academicYearId: r.academicYearId, createdAt: r.createdAt, updatedAt: r.updatedAt
    }));
    res.status(200).json(transformedResults);
  } catch (error) {
    console.log('Error in getPartialResults:', error.message);
    next(new APIError('Error fetching partial results: ' + error.message, 500));
  }
};



const getExamsForResultEntry = async (req, res, next) => {
  try {
    const schoolId = req.user.schoolId;
    const academicYearId = req.user.activeAcademicYear;
    const userId = req.user.id;

    if (req.user.role !== 'teacher') {
      throw new APIError('Only teachers can access result entry exams', 403);
    }

    // Get teacher
    const teacher = await Teacher.findOne({ userId });
    if (!teacher) {
      throw new APIError('Teacher profile not found', 404);
    }

    // Get teacher's assigned subjects for ALL classes in this academic year
    const assignments = await ClassSubjectAssignment.find({
      teacherId: teacher._id,
      academicYearId,
      schoolId
    }).populate('classId', 'name').populate('subjectId', 'name');
    console.log('=== DEBUG: Teacher Assignments ===');
    console.log('Teacher ID:', teacher._id);
    console.log('Assignments:', assignments.map(a => ({ className: a.classId.name, subjectName: a.subjectId.name, subjectId: a.subjectId._id })));

    if (assignments.length === 0) {
      console.log('No assignments found for teacher');
      return res.status(200).json({ exams: [] });
    }

    // Get unique class IDs from assignments
    const teacherClassIds = [...new Set(assignments.map(a => a.classId._id.toString()))];
    console.log('Teacher Class IDs:', teacherClassIds);

    // Get exams for teacher's classes
    const exams = await Exam.find({
      schoolId,
      academicYearId,
      classId: { $in: teacherClassIds }
    }).populate({
      path: 'examPapers.subjectId',
      populate: { path: 'name' } // Ensure name populated
    }).populate('classId', 'name');

    console.log('Raw Exams Found:', exams.length);

    // Filter each exam's examPapers to only teacher's assigned subjects for that class
    const filteredExams = exams.map(exam => {
      const examClassId = exam.classId._id.toString();
      console.log(`Filtering exam for class ${examClassId} (${exam.classId.name}):`);
      // Get teacher's subjects for this specific class
      const classAssignments = assignments.filter(a => a.classId._id.toString() === examClassId);
      const teacherSubjectIds = classAssignments.map(a => a.subjectId._id.toString());
      console.log('Subject IDs for this class:', teacherSubjectIds);

      const filteredPapers = exam.examPapers.filter(paper => 
        teacherSubjectIds.includes(paper.subjectId._id.toString())
      ).map(paper => ({
        ...paper.toObject(),
        subjectId: paper.subjectId // Full populated object with name
      }));

      console.log('Filtered Papers for this exam:', filteredPapers.map(p => p.subjectId.name));

      return {
        ...exam.toObject(),
        examPapers: filteredPapers // Only teacher's subjects for this class
      };
    }).filter(exam => exam.examPapers.length > 0); // Only exams with assigned subjects

    console.log('Final Filtered Exams:', filteredExams.length);
    res.status(200).json({ exams: filteredExams });
  } catch (error) {
    console.error('Error in getExamsForResultEntry:', error);
    next(new APIError(error.message, error.status || 500));
  }
};




const getResultsByExam = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const schoolId = req.user.schoolId;

    // Validate exam
    const exam = await Exam.findById(examId);
    if (!exam || exam.schoolId.toString() !== schoolId) {
      throw new APIError('Exam not found or not authorized', 404);
    }

    let results;
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      // Admins get all results for the exam
      results = await Result.find({ examId: examId, schoolId: schoolId })
        .populate('studentId', 'name rollNo')
        .populate('subjects.subjectId', 'name')
        .populate('subjectId', 'name');
      console.log('Admin results:', results);
    } else if (req.user.role === 'teacher') {
      // Find teacher document
      const teacher = await Teacher.findOne({ userId: req.user.id });
      if (!teacher) throw new APIError('Teacher profile not found', 404);
      console.log('Found teacher:', teacher);

      // Get teacher's assigned subjects using ClassSubjectAssignment
      const teacherAssignments = await ClassSubjectAssignment.find({
        schoolId: schoolId,
        teacherId: teacher._id,
        academicYearId: req.user.activeAcademicYear,
      }).distinct('subjectId');
      console.log('Teacher subjects (raw):', teacherAssignments.map(s => s.toString()));

      // Fetch results for the exam
      results = await Result.find({ examId: examId, schoolId: schoolId })
        .populate('studentId', 'name rollNo')
        .populate('subjects.subjectId', 'name')
        .populate('subjectId', 'name');
      console.log('Raw results from DB:', results.map(r => ({
        _id: r._id,
        subjectId: r.subjectId ? r.subjectId._id.toString() : null,
        subjects: r.subjects.map(s => s.subjectId ? s.subjectId._id.toString() : null)
      })));

      // Filter results to include only teacher's assigned subjects
      results = results.map(result => {
        let filteredSubjects = [];
        // Handle partial results using subjectId
        if (result.subjectId && result.subjectId._id) {
          const subjectIdStr = result.subjectId._id.toString();
          console.log(`Checking subjectId: ${subjectIdStr} against ${teacherAssignments.map(s => s.toString()).join(', ')}`);
          if (teacherAssignments.some(s => s.toString() === subjectIdStr)) {
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
            teacherAssignments.some(s => s.toString() === subject.subjectId._id.toString())
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

    // Fetch all partial and compiled results (minimal change: add select for publish fields only)
    const partialResults = await Result.find({ 
      classId, 
      academicYearId, 
      schoolId,
      subjectId: { $exists: true } // Only partial results
    })
    .populate('studentId', 'name rollNo')
    .populate('examId', 'examTitle examPapers')
    .populate('subjectId', 'name')
    .select('+isPublished +publishedAt'); // Minimal: Include publish fields without excluding others

    const compiledResults = await Result.find({
      classId,
      academicYearId,
      schoolId,
      subjects: { $exists: true, $ne: [] } // Only compiled results
    })
    .populate('studentId', 'name rollNo')
    .populate('examId', 'examTitle examPapers')
    .populate('subjects.subjectId', 'name')
    .select('+isPublished +publishedAt'); // Minimal: Include publish fields without excluding others

    // Combine partial and compiled results
    const allResults = [...partialResults, ...compiledResults];

    // Group by studentId and examId to consolidate subjects (unchanged logic)
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
          totalMaxMarks: 0,
          isPublished: result.isPublished || false, // Preserve from model (default false if null)
          publishedAt: result.publishedAt || null
        };
      }

      // Handle compiled results (unchanged)
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
      // Handle partial results (unchanged)
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

    // Calculate percentage and status for each student's exam (unchanged)
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

    // Fetch exam details to ensure all subjects are included (unchanged)
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

const getResultById = async (req, res, next) => {
  try {
    const { resultId } = req.params;
    const schoolId = req.user.schoolId;

    if (!mongoose.Types.ObjectId.isValid(resultId)) {
      throw new APIError('Invalid result ID', 400);
    }

    const result = await Result.findById(resultId)
      .populate('studentId', 'name rollNo')
      .populate('subjects.subjectId', 'name')
      .populate('subjectId', 'name')
      .populate('examId', 'examTitle examPapers');

    if (!result || result.schoolId.toString() !== schoolId) {
      throw new APIError('Result not found or not authorized', 404);
    }

    // Authorization for teachers
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: req.user.id });
      if (!teacher) throw new APIError('Teacher profile not found', 404);

      const teacherAssignments = await ClassSubjectAssignment.find({
        schoolId,
        teacherId: teacher._id,
        academicYearId: req.user.activeAcademicYear,
      }).distinct('subjectId');
      const teacherSubjectIds = teacherAssignments.map(id => id.toString());

      if (result.subjectId) {
        // Partial result
        if (!teacherSubjectIds.includes(result.subjectId._id.toString())) {
          throw new APIError('Not authorized for this subject', 403);
        }
      } else if (result.subjects && result.subjects.length > 0) {
        // Compiled result
        const unauthorizedSubjects = result.subjects.filter(subject =>
          !teacherSubjectIds.includes(subject.subjectId._id.toString())
        );
        if (unauthorizedSubjects.length > 0) {
          throw new APIError('Not authorized for some subjects in this result', 403);
        }
      }
    }

    // Add maxMarks for partial result from examPapers
    if (result.subjectId && result.examId.examPapers) {
      const examPaper = result.examId.examPapers.find(p => p.subjectId._id.toString() === result.subjectId._id.toString());
      result.maxMarks = examPaper ? examPaper.maxMarks : 100; // Fallback to 100
    }

    res.status(200).json(result);
  } catch (error) {
    console.log('Error in getResultById:', error.message);
    next(new APIError('Error fetching result: ' + error.message, 500));
  }
};
// controllers/result.controller.js

const publishResult = async (req, res, next) => {
  try {
    const { resultId } = req.params;
    const userAcademicYearId = req.user.activeAcademicYear; // <-- from JWT / auth middleware
    const schoolId = req.user.schoolId;

    // 1. Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(resultId)) {
      throw new APIError('Invalid result ID', 400);
    }

    // 2. Fetch result with required fields
    const result = await Result.findById(resultId)
      .populate('studentId', 'name')
      .populate('examId', 'examTitle');

    if (!result) {
      throw new APIError('Result not found', 404);
    }

    // 3. Security: School + Academic Year Match
    if (result.schoolId.toString() !== schoolId) {
      throw new APIError('Result does not belong to your school', 403);
    }

    if (result.academicYearId.toString() !== userAcademicYearId) {
      throw new APIError('You can only publish results for the active academic year', 403);
    }

    // 4. Already published?
    if (result.isPublished) {
      throw new APIError('Result already published', 400);
    }

    // 5. Must be a compiled result (has subjects array)
    if (!result.subjects || result.subjects.length === 0) {
      throw new APIError('Cannot publish incomplete result – missing subjects', 400);
    }

    // 6. Publish
    result.isPublished = true;
    result.publishedAt = new Date();
    await result.save();

    // 7. Success response
    res.status(200).json({
      message: 'Result published successfully',
      result: {
        _id: result._id,
        studentName: result.studentId.name,
        examTitle: result.examId.examTitle,
        academicYearId: result.academicYearId,
        publishedAt: result.publishedAt,
        publishedBy: req.user.id
      }
    });
  } catch (error) {
    next(error);
  }
};

// controllers/studentResult.controller.js
const getMyResults = async (req, res, next) => {
  try {
    const studentId = req.user.studentId;
    const schoolId = req.user.schoolId;
    const academicYearId = req.user.activeAcademicYear; // from login/session

    const query = {
      studentId,
      schoolId,
      isPublished: true
    };

    // Optional: restrict to current academic year
    if (academicYearId) {
      query.academicYearId = academicYearId;
    }

    const results = await Result.find(query)
      .populate('studentId', '_id name rollNo') // Added: Send student ID + basics first
      .populate('examId', 'examTitle startDate')
      .populate('subjects.subjectId', 'name')
      .sort({ publishedAt: -1 })
      .lean(); // optional: faster

    if (!results || results.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Result not announced or Not Created yet.',
        data: []
      });
    }

    // Ensure each result has studentId object (for frontend interface)
    const formattedResults = results.map(r => ({
      ...r,
      studentId: r.studentId || { _id: studentId, name: 'Unknown', rollNo: 'N/A' } // Fallback if populate fails
    }));

    res.status(200).json({
      success: true,
      message: 'Results fetched successfully.',
      data: formattedResults
    });

  } catch (error) {
    console.error('getMyResults error:', error);
    // Never expose internal error to student
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      data: []
    });
  }
};

const publishExamResults = async (req, res) => {
  try {
    const { examId, classId, academicYearId, schoolId } = req.body;
    const updated = await Result.updateMany(
      { examId, classId, academicYearId, schoolId, isPublished: false },
      { $set: { isPublished: true, publishedAt: new Date() } }
    );
    res.json({ success: true, updated: updated.modifiedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


const publishSingleResult = async (req, res, next) => {
  try {
    const { studentId, examId } = req.body; // From frontend body
    const schoolId = req.user.schoolId;
    const academicYearId = req.user.activeAcademicYear;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(studentId) || !mongoose.Types.ObjectId.isValid(examId)) {
      throw new APIError('Invalid Student ID or Exam ID', 400);
    }

    // Security: Verify exam belongs to school/year/class
    const exam = await Exam.findOne({ _id: examId, schoolId, academicYearId });
    if (!exam) {
      throw new APIError('Exam not found or not authorized', 404);
    }

    console.log(`Publishing for Student: ${studentId}, Exam: ${examId}`);

    // Update ALL matching raw Results (partials + compiled) for this student-exam
    const updated = await Result.updateMany(
      { 
        studentId: new mongoose.Types.ObjectId(studentId),
        examId: new mongoose.Types.ObjectId(examId),
        schoolId,
        academicYearId,
        isPublished: false  // Only unpublished
      },
      { $set: { isPublished: true, publishedAt: new Date() } }
    );

    console.log('Updated raw docs:', updated.modifiedCount);

    if (updated.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'No unpublished result found for this student-exam' });
    }

    // Success: Return count (no need for full doc—frontend optimistically updates aggregated view)
    res.status(200).json({ 
      success: true, 
      updated: updated.modifiedCount, 
      message: `Published ${updated.modifiedCount} result(s) for the student-exam` 
    });
  } catch (error) {
    console.error('Publish single error:', error);
    next(error);
  }
};

module.exports = {
  createResult, getResultById,compileResult,publishResult,getMyResults, getResultsByExam, updatePartialResult,getStudentResults,getExamsForResultEntry,
  getResultsByClassAndAcademicYear, createPartialResult, getPartialResults,getAllResultsForClass,publishExamResults,publishSingleResult
};