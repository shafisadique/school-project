const Student = require('../../models/student');
const Subject = require('../../models/subject');
const AcademicYear = require('../../models/academicyear');
const APIError = require('../../utils/apiError');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads (if not already defined)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Example existing functions (ensure these are defined)
const createStudent = async (req, res, next) => {
  try {
    const studentData = req.body;
    studentData.schoolId = req.user.schoolId;
    studentData.createdBy = req.user.id;
    if (req.file) {
      studentData.profileImage = `/uploads/${req.file.filename}`;
    }

    // Ensure section is an array
    if (typeof studentData.section === 'string') {
      studentData.section = JSON.parse(studentData.section);
    }

    const student = await Student.create(studentData);
    res.status(201).json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
};

const bulkCreateStudents = async (req, res, next) => {
  try {
    const studentsData = req.body;
    const createdStudents = await Student.insertMany(studentsData.map(student => ({
      ...student,
      schoolId: req.user.schoolId,
      createdBy: req.user.id
    })));
    res.status(201).json({ success: true, data: createdStudents });
  } catch (error) {
    next(error);
  }
};


const getStudents = async (req, res, next) => {
  try {
    const students = await Student.find({ schoolId: req.user.schoolId });
    res.status(200).json(students);
  } catch (error) {
    next(error);
  }
};

const getStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      throw new APIError('Student not found', 404);
    }
    res.status(200).json(student);
  } catch (error) {
    next(error);
  }
};

const updateStudent = async (req, res, next) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!student) {
      throw new APIError('Student not found', 404);
    }
    res.status(200).json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
};

const uploadStudentPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new APIError('No file uploaded', 400);
    }
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { profileImage: `/uploads/${req.file.filename}` },
      { new: true }
    );
    if (!student) {
      throw new APIError('Student not found', 404);
    }
    res.status(200).json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
};

const searchStudents = async (req, res, next) => {
  try {
    const query = req.params.query;
    const students = await Student.find({
      schoolId: req.user.schoolId,
      $or: [
        { name: new RegExp(query, 'i') },
        { admissionNo: new RegExp(query, 'i') }
      ]
    });
    res.status(200).json(students);
  } catch (error) {
    next(error);
  }
};

const assignRollNumbers = async (req, res, next) => {
  try {
    const schoolId = req.user.schoolId;
    const classId = req.query.classId; // Changed from className to classId
    const { academicYearId: requestedAcademicYearId } = req.body;

    if (!classId) {
      throw new APIError('Class ID is required. Please provide a classId query parameter (e.g., ?classId=68262d46287e937cb18bd446)', 400);
    }

    if (req.user.role === 'teacher') {
      const subjects = await Subject.find({
        schoolId: req.user.schoolId,
        'teacherAssignments.teacherId': req.user.id
      }).populate('classes');

      const classIds = [...new Set(subjects.flatMap(subject => subject.classes.map(cls => cls._id.toString())))];
      if (!classIds.includes(classId)) {
        throw new APIError(`You are not authorized to assign roll numbers for class ${classId}`, 403);
      }
    }

    const academicYearId = requestedAcademicYearId || (await getActiveAcademicYearId(schoolId));

    const query = {
      schoolId,
      academicYearId,
      classId: new mongoose.Types.ObjectId(classId), // Use classId instead of className
    };

    const students = await Student.find(query).sort('createdAt');

    if (students.length === 0) {
      throw new APIError(`No students found for class ${classId}`, 404);
    }

    const groupedStudents = {};
    students.forEach(student => {
      const key = `${student.classId}-${student.section.join(',')}`; // Use classId
      if (!groupedStudents[key]) {
        groupedStudents[key] = [];
      }
      groupedStudents[key].push(student);
    });

    for (const key in groupedStudents) {
      const studentsInGroup = groupedStudents[key];
      for (let i = 0; i < studentsInGroup.length; i++) {
        const rollNo = (i + 1).toString().padStart(2, '0');
        await Student.updateOne(
          { _id: studentsInGroup[i]._id },
          { $set: { rollNo } }
        );
        console.log(`Assigned rollNo ${rollNo} to student ${studentsInGroup[i].name}`);
      }
    }

    res.status(200).json({
      success: true,
      message: `Roll numbers assigned successfully to students in class ${classId}`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Assign roll numbers to students in a class alphabetically by name
 * @route   POST /api/students/assign-roll-numbers-alphabetically?className=<className>
 * @access  Private/Admin or Teacher
 */
const assignRollNumbersAlphabetically = async (req, res, next) => {
  try {
    const schoolId = req.user.schoolId;
    const className = req.query.className;
    const { academicYearId: requestedAcademicYearId } = req.body;

    if (!className) {
      throw new APIError('Class name is required. Please provide a className query parameter (e.g., ?className=Class%2010A)', 400);
    }

    // Restrict teachers to their assigned classes
    if (req.user.role === 'teacher') {
      const subjects = await Subject.find({
        schoolId: req.user.schoolId,
        'teacherAssignments.teacherId': req.user.id
      }).populate('classes');

      const classNames = [...new Set(subjects.flatMap(subject => subject.classes.map(cls => cls.name)))];
      if (!classNames.includes(className)) {
        throw new APIError(`You are not authorized to assign roll numbers for class ${className}`, 403);
      }
    }

    const academicYearId = requestedAcademicYearId || (await getActiveAcademicYearId(schoolId));

    const query = {
      schoolId,
      academicYearId,
      className
    };

    // Fetch students and sort them alphabetically by name
    const students = await Student.find(query).sort({ name: 1 }); // Sort by name in ascending order

    if (students.length === 0) {
      throw new APIError(`No students found for class ${className}`, 404);
    }

    // Group students by className and section to ensure roll numbers are unique within each section
    const groupedStudents = {};
    students.forEach(student => {
      const key = `${student.className}-${student.section.join(',')}`;
      if (!groupedStudents[key]) {
        groupedStudents[key] = [];
      }
      groupedStudents[key].push(student);
    });

    // Assign roll numbers within each group
    for (const key in groupedStudents) {
      const studentsInGroup = groupedStudents[key];
      for (let i = 0; i < studentsInGroup.length; i++) {
        const rollNo = (i + 1).toString().padStart(2, '0'); // e.g., 01, 02, 03
        await Student.updateOne(
          { _id: studentsInGroup[i]._id },
          { $set: { rollNo } }
        );
        console.log(`Assigned rollNo ${rollNo} to student ${studentsInGroup[i].name}`);
      }
    }

    res.status(200).json({
      success: true,
      message: `Roll numbers assigned alphabetically to students in class ${className}`
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to get the active academic year
const getActiveAcademicYearId = async (schoolId) => {
  const academicYear = await AcademicYear.findOne({ schoolId, isActive: true });
  if (!academicYear) {
    throw new APIError('No active academic year found', 404);
  }
  return academicYear._id;
};

// Export all functions
module.exports = {
  upload,
  createStudent,
  bulkCreateStudents,
  getStudents,
  getStudent,
  updateStudent,
  uploadStudentPhoto,
  searchStudents,
  assignRollNumbers,
  assignRollNumbersAlphabetically // Ensure this is included
};