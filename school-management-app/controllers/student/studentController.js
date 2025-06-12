const Student = require('../../models/student');
const Subject = require('../../models/subject');
const AcademicYear = require('../../models/academicyear');
const APIError = require('../../utils/apiError');
const Class = require('../../models/class'); // Added for getStudentsByClass
const School = require('../../models/school'); // Added for getStudentsByClass
const Teacher = require('../../models/teacher'); // Added for getStudentsByClass
const mongoose = require('mongoose'); // Added for getStudentsByClass
const multer = require('multer');
const { paginate } = require('../../utils/paginationHelper'); // Adjust path as needed
const Result = require('../../models/result');
// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Moved getStudentsByClass from attendanceControllers.js
const getStudentsByClass = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { academicYearId } = req.query;
    console.log(classId,academicYearId)
    // Validate classId
    if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
      throw new APIError('Valid Class ID is required', 400);
    }

    // Validate academicYearId if provided
    let academicYearFilter;
    if (academicYearId) {
      if (!mongoose.Types.ObjectId.isValid(academicYearId)) {
        throw new APIError('Invalid academic year ID format', 400);
      }
      academicYearFilter = new mongoose.Types.ObjectId(academicYearId);
    } else {
      // Fetch the active academic year from the School model if not provided
      const school = await School.findById(req.user.schoolId).select('activeAcademicYear');
      if (!school || !school.activeAcademicYear) {
        throw new APIError('No active academic year set for this school', 400);
      }
      academicYearFilter = school.activeAcademicYear;
    }

    // Verify the class exists in this school
    const classExists = await Class.findOne({ _id: classId, schoolId: req.user.schoolId });
    if (!classExists) {
      throw new APIError('Class not found in this school', 404);
    }

    // Authorization check for teachers
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: req.user.id });
      if (!teacher) {
        throw new APIError('Teacher profile not found', 404);
      }
      const teacherId = teacher._id;

      const subjects = await Subject.find({
        schoolId: req.user.schoolId,
        'teacherAssignments.teacherId': teacherId,
        'teacherAssignments.academicYearId': academicYearFilter,
      }).populate('classes');

      const classIds = subjects.flatMap(subject => subject.classes.map(cls => cls._id.toString()));
      if (!classIds.includes(classId)) {
        throw new APIError('You are not authorized to view students in this class', 403);
      }
    }

    // Build the query
    const query = {
      schoolId: new mongoose.Types.ObjectId(req.user.schoolId),
      classId: new mongoose.Types.ObjectId(classId),
      academicYearId: academicYearFilter,
      status: true // Only fetch active students
    };

    // Use the pagination helper
    const result = await paginate(
      Student,
      query,
      req.query,
      [{ path: 'classId', select: 'name' }],
      { rollNo: 1 }
    );

    res.status(200).json({
      students: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    });
  } catch (error) {
    console.log('Error in getStudentsByClass:', error.message);
    next(error);
  }
};

// Existing functions
const generateAdmissionNo = async (schoolId, academicYearId) => {
  try {
    // Fetch the school to get the school code
    const school = await School.findById(schoolId);
    if (!school) {
      throw new Error('School not found');
    }
    const schoolCode = school.code || 'SCH'; // Fallback to 'SCH' if code is not set

    // Fetch the academic year to get the year
    const academicYear = await AcademicYear.findById(academicYearId);
    if (!academicYear) {
      throw new Error('Academic year not found');
    }
    // Assuming academicYear has a name like "2024-2025", extract the start year
    const year = academicYear.name.split('-')[0]; // e.g., "2024"

    // Count the number of students in the given school and academic year
    const studentCount = await Student.countDocuments({ schoolId, academicYearId });
    const sequentialNumber = (studentCount + 1).toString().padStart(3, '0'); // e.g., "001"

    // Generate the admission number in the format SCHOOLCODE-YYYY-NNN
    const admissionNo = `${schoolCode}-${year}-${sequentialNumber}`;
    return admissionNo;
  } catch (error) {
    throw new Error(`Error generating admission number: ${error.message}`);
  }
};

// Create a new student
const createStudent = async (req, res) => {
  try {
    if (!req.user || (!req.user._id && !req.user.id)) {
      return res.status(401).json({ message: 'User not authenticated, ID missing' });
    }

    const userId = req.user._id || req.user.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const {
      name,
      email,
      phone,
      dateOfBirth,
      city,
      state,
      country,
      classId,
      section,
      address,
      gender,
      usesTransport,
      usesHostel,
      parents,
      academicYearId,
    } = req.body;

    const parsedSection = typeof section === 'string' ? JSON.parse(section) : section;
    const parsedParents = typeof parents === 'string' ? JSON.parse(parents) : parents;

    const schoolId = req.user.schoolId;
    const admissionNo = await generateAdmissionNo(schoolId, academicYearId);

    const newStudent = new Student({
      admissionNo,
      name,
      email,
      phone,
      dateOfBirth,
      city,
      state,
      country,
      classId,
      section: parsedSection,
      address,
      gender,
      schoolId,
      academicYearId,
      usesTransport: usesTransport === 'true',
      usesHostel: usesHostel === 'true',
      parents: parsedParents,
      createdBy: userId,
      profileImage: req.file ? req.file.path : '',
      status: true // Explicitly set status to true (though the default already handles this)
    });

    await newStudent.save();

    res.status(201).json({ message: 'Student created successfully', student: newStudent });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(400).json({ message: 'Error creating student', error: error.message });
  }
};


const bulkCreateStudents = async (req, res, next) => {
  try {
    const studentsData = req.body;
    if (!Array.isArray(studentsData) || studentsData.length === 0) {
      throw new APIError('Students data must be a non-empty array', 400);
    }

    const schoolId = req.user.schoolId;
    const userId = req.user._id || req.user.id;

    // Get active academic year if not provided
    const academicYear = await AcademicYear.findOne({ schoolId, isActive: true });
    if (!academicYear) {
      throw new APIError('No active academic year found', 404);
    }
    const academicYearId = academicYear._id;

    // Fetch all valid classIds for this school to validate
    const classes = await Class.find({ schoolId });
    console.log('Classes found:', classes); // Debug log
    const validClassIds = new Set(classes.map(cls => cls._id.toString()));

    // Get the current student count once, before processing the batch
    const studentCount = await Student.countDocuments({ schoolId, academicYearId });
    let sequentialNumber = studentCount; // Start from the current count

    // Fetch school code once
    const school = await School.findById(schoolId);
    if (!school) {
      throw new APIError('School not found', 404);
    }
    const schoolCode = school.code || 'SCH';

    // Extract the year from the academic year name
    const year = academicYear.name.split('-')[0]; // e.g., "2025"

    // Prepare students data for insertion
    const studentsToInsert = await Promise.all(studentsData.map(async (student, index) => {
      // Validate classId
      if (!student.classId) {
        throw new APIError(`Class ID is required for student at index ${index}`, 400);
      }

      const classId = student.classId.trim();
      console.log(`Class ID for student at index ${index}: "${classId}"`); // Debug log

      if (!mongoose.Types.ObjectId.isValid(classId)) {
        throw new APIError(`Invalid class ID format for student at index ${index}: "${classId}"`, 400);
      }

      if (!validClassIds.has(classId)) {
        throw new APIError(`Class ID ${classId} not found or does not belong to this school for student at index ${index}`, 404);
      }

      // Increment the sequential number for each student
      sequentialNumber += 1;
      const formattedSequentialNumber = sequentialNumber.toString().padStart(3, '0');
      const admissionNo = `${schoolCode}-${year}-${formattedSequentialNumber}`;

      console.log(`Generated admissionNo for student at index ${index}: ${admissionNo}`); // Debug log

      // Parse address to extract city, state, country
      const addressParts = student.address.split(', ').map(part => part.trim());
      const city = addressParts[addressParts.length - 2] || '';
      const state = addressParts[addressParts.length - 1] || '';
      const country = 'India'; // Default, adjust as needed

      // Ensure parents data meets schema requirements
      const parents = student.parents || {
        fatherName: student.name.split(' ')[0] + ' Father',
        fatherPhone: student.phone,
        motherName: '',
        motherPhone: ''
      };

      return {
        admissionNo,
        name: student.name,
        phone: student.phone,
        email: student.email || '',
        dateOfBirth: new Date(student.dateOfBirth),
        city,
        state,
        country,
        classId: classId,
        section: student.section,
        address: student.address,
        gender: student.gender,
        schoolId,
        academicYearId,
        usesTransport: student.transport === 'YES',
        usesHostel: student.hostel === 'YES',
        parents,
        createdBy: userId,
        status: true
      };
    }));

    // Insert students
    const createdStudents = await Student.insertMany(studentsToInsert, { ordered: false });
    res.status(201).json({ success: true, data: createdStudents });
  } catch (error) {
    console.error('Error in bulkCreateStudents:', error);
    next(error);
  }
};

const getStudents = async (req, res, next) => {
  try {
    const { page = 1, limit = 25, classId, academicYearId, search } = req.query;
    const query = { schoolId: req.user.schoolId }; // Removed status: true in previous fix


    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { admissionNo: new RegExp(search, 'i') }
      ];
    }

    if (classId) {
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        throw new APIError('Invalid class ID format', 400);
      }
      query.classId = new mongoose.Types.ObjectId(classId);
    }

    if (academicYearId) {
      if (!mongoose.Types.ObjectId.isValid(academicYearId)) {
        throw new APIError('Invalid academic year ID format', 400);
      }
      query.academicYearId = new mongoose.Types.ObjectId(academicYearId);
    }


    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const students = await Student.find(query)
      .populate('classId', 'name')
      .populate('academicYearId', 'name')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Student.countDocuments(query);

    res.status(200).json({
      students,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error('Error in getStudents:', error);
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
    const studentId = req.params.id;
    const updateData = req.body;

    // Validate student ID
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new APIError('Invalid student ID format', 400);
    }

    // Ensure the student belongs to the user's school
    const student = await Student.findOne({ _id: studentId, schoolId: req.user.schoolId });
    if (!student) {
      throw new APIError('Student not found or you are not authorized to update this student', 404);
    }

    // Validate status if provided
    if (updateData.status !== undefined) {
      if (typeof updateData.status !== 'boolean') {
        throw new APIError('Status must be a boolean value (true/false)', 400);
      }
    }

    // Prevent updating immutable fields (e.g., admissionNo, schoolId, createdBy)
    delete updateData.admissionNo;
    delete updateData.schoolId;
    delete updateData.createdBy;

    // Update the student
    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedStudent) {
      throw new APIError('Failed to update student', 500);
    }

    res.status(200).json({ success: true, data: updatedStudent });
  } catch (error) {
    console.error('Error in updateStudent:', error);
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
    const classId = req.query.classId;
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
      classId: new mongoose.Types.ObjectId(classId),
    };

    const students = await Student.find(query).sort('createdAt');

    if (students.length === 0) {
      throw new APIError(`No students found for class ${classId}`, 404);
    }

    const groupedStudents = {};
    students.forEach(student => {
      const key = `${student.classId}-${student.section.join(',')}`;
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

const assignRollNumbersAlphabetically = async (req, res, next) => {
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
      classId: new mongoose.Types.ObjectId(classId), // Changed from className to classId
    };

    const students = await Student.find(query).sort({ name: 1 });

    if (students.length === 0) {
      throw new APIError(`No students found for class ${classId}`, 404);
    }

    const groupedStudents = {};
    students.forEach(student => {
      const key = `${student.classId}-${student.section.join(',')}`; // Updated to use classId
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
      message: `Roll numbers assigned alphabetically to students in class ${classId}`
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

const promoteStudents = async (req, res, next) => {
  try {
    const { classId, academicYearId, nextAcademicYearId, manualPromotions = [] } = req.body;
    const schoolId = req.user.schoolId;

    // Validate inputs
    if (!classId || !academicYearId || !nextAcademicYearId) {
      throw new APIError('Class ID, Current Academic Year ID, and Next Academic Year ID are required', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      throw new APIError('Invalid Class ID format', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(academicYearId)) {
      throw new APIError('Invalid Current Academic Year ID format', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(nextAcademicYearId)) {
      throw new APIError('Invalid Next Academic Year ID format', 400);
    }

    // Validate manualPromotions array
    if (!Array.isArray(manualPromotions)) {
      throw new APIError('manualPromotions must be an array of student IDs', 400);
    }

    for (const studentId of manualPromotions) {
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        throw new APIError(`Invalid student ID in manualPromotions: ${studentId}`, 400);
      }
    }

    // Fetch the current class and its next class
    const currentClass = await Class.findOne({ _id: classId, schoolId }).populate('nextClass');
    if (!currentClass) {
      throw new APIError('Class not found in this school', 404);
    }

    // Check if there's a next class to promote to
    if (!currentClass.nextClass) {
      throw new APIError(`No next class defined for ${currentClass.name}. Cannot promote students.`, 400);
    }

    // Verify the current academic year exists and belongs to the school
    const currentAcademicYear = await AcademicYear.findOne({ _id: academicYearId, schoolId });
    if (!currentAcademicYear) {
      throw new APIError('Current academic year not found or does not belong to this school', 404);
    }

    // Verify the next academic year exists and belongs to the school
    const nextAcademicYear = await AcademicYear.findOne({ _id: nextAcademicYearId, schoolId });
    if (!nextAcademicYear) {
      throw new APIError('Next academic year not found or does not belong to this school', 404);
    }

    // Validate that the next academic year is chronologically after the current one
    if (new Date(nextAcademicYear.startDate) <= new Date(currentAcademicYear.startDate)) {
      throw new APIError('Next academic year must be after the current academic year', 400);
    }

    // Fetch students in the class for the current academic year
    const students = await Student.find({ classId, schoolId, academicYearId });
    if (!students || students.length === 0) {
      throw new APIError('No students found in this class for the specified academic year', 404);
    }

    // Fetch results for the academic year
    const results = await Result.find({ classId, academicYearId, schoolId });
    const studentResults = new Map(results.map(r => [r.studentId.toString(), r]));

    // Track promotion outcomes
    const promotedStudents = [];
    const failedStudents = [];
    const manuallyPromotedStudents = [];

    // Promote students
    const promotionPromises = students.map(async (student) => {
      const studentIdStr = student._id.toString();
      const result = studentResults.get(studentIdStr);
      const shouldPromote = (result && result.status === 'Pass') || manualPromotions.includes(studentIdStr);

      if (shouldPromote) {
        // Update student to the next class and academic year
        await Student.findByIdAndUpdate(
          student._id,
          {
            $set: {
              classId: currentClass.nextClass._id,
              academicYearId: nextAcademicYear._id,
              rollNo: '', // Reset roll number for the new class
            },
          },
          { new: true }
        );

        // Track the promotion
        if (result && result.status === 'Pass') {
          promotedStudents.push({ studentId: student._id, name: student.name });
        } else {
          manuallyPromotedStudents.push({ studentId: student._id, name: student.name });
        }
      } else {
        // Student failed and wasn't manually promoted
        failedStudents.push({ studentId: student._id, name: student.name });
      }
    });

    await Promise.all(promotionPromises);

    res.status(200).json({
      success: true,
      message: 'Student promotion process completed successfully',
      data: {
        promotedStudents,
        failedStudents,
        manuallyPromotedStudents,
        nextClass: currentClass.nextClass.name,
        nextAcademicYear: nextAcademicYear.name,
      },
    });
  } catch (error) {
    console.log('Error in promoteStudents:', error.message);
    next(error);
  }
};

// Export all functions, including getStudentsByClass
module.exports = {
  upload,
  createStudent,
  promoteStudents,
  bulkCreateStudents,
  getStudents,
  getStudent,
  updateStudent,
  uploadStudentPhoto,
  searchStudents,
  assignRollNumbers,
  assignRollNumbersAlphabetically,
  getStudentsByClass // Added to exports
};