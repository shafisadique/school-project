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
const Route = require('../../models/route');
const User = require('../../models/user');
const bcrypt = require('bcrypt');
const subscriptionSchema = require('../../models/subscription');
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

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

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32); // 32 bytes for AES-256
const IV_LENGTH = 16; // Initialization vector length for AES

// Function to encrypt password
const encryptPassword = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted; // Store IV with encrypted data
};

// Function to decrypt password with validation
const decryptPassword = (encryptedText) => {
  if (!encryptedText || typeof encryptedText !== 'string') return '';
  const [ivHex, encrypted] = encryptedText.split(':');
  if (!ivHex || !encrypted || ivHex.length !== 32) { // 32 hex chars = 16 bytes
    console.error('Invalid encrypted text format:', encryptedText);
    return '';
  }
  try {
    const iv = Buffer.from(ivHex, 'hex');
    if (iv.length !== IV_LENGTH) {
      console.error('Invalid IV length:', iv.length);
      return '';
    }
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message, 'for encrypted text:', encryptedText);
    return '';
  }
};

// Moved getStudentsByClass from attendanceControllers.js
const getStudentsByClass = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { academicYearId } = req.query;
    // Validate classId
    if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
      throw new APIError('Valid Class ID is required', 400);
    }
    if (!req.user || !req.user.id) {
      throw new APIError('Authentication required', 401);
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
      throw new Error('Academic year must be set up');
    }
    // Assuming academicYear has a name like "2024-2024", extract the start year
    const year = academicYear.name.split('-')[0]; // e.g., "2024"

    // Find the highest existing admissionNo for this school and academic year
    const regex = new RegExp(`^${schoolCode}-${year}-\\d+$`); // e.g., matches "SCH-2025-029"
    const latestStudent = await Student.findOne({
      schoolId,
      academicYearId,
      admissionNo: { $regex: regex }
    }).sort({ admissionNo: -1 }).select('admissionNo');

    let sequentialNumber = 0;
    if (latestStudent) {
      // Extract the sequential number from the latest admissionNo (e.g., "029" from "SCH-2025-029")
      const match = latestStudent.admissionNo.match(/(\d+)$/);
      if (match) {
        sequentialNumber = parseInt(match[1], 10);
      }
    }

    // Increment to get the next sequential number
    sequentialNumber += 1;
    const formattedSequentialNumber = sequentialNumber.toString().padStart(3, '0'); // e.g., "030"

    // Generate the admission number
    const admissionNo = `${schoolCode}-${year}-${formattedSequentialNumber}`;

    // Double-check if the generated admissionNo already exists (edge case for concurrent inserts)
    const existingStudent = await Student.findOne({ admissionNo });
    if (existingStudent) {
      // Recursively call to try the next number
      return generateAdmissionNo(schoolId, academicYearId);
    }

    return admissionNo;
  } catch (error) {
    throw new Error(`Error generating admission number: ${error.message}`);
  }
};

const validateParent = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const userId = req.query.userId; // Extract userId from query params

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const student = await Student.findOne({ _id: studentId, parentId: userId });
    if (!student) {
      return res.status(404).json({ error: 'Student not found or parent not authorized' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Validation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const createStudent = async (req, res, next) => {
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
      usesLibrary,
      needsDress,
      usesLab,
      needsExamFee,
      parents,
      academicYearId,
      routeId,
    } = req.body;

    const parsedSection = typeof section === 'string' ? JSON.parse(section) : section;
    const parsedParents = typeof parents === 'string' ? JSON.parse(parents) : parents;

    const schoolId = req.user.schoolId;
    const admissionNo = await generateAdmissionNo(schoolId, academicYearId);

    const feePreferences = new Map();
    feePreferences.set('usesTransport', usesTransport === 'true');
    feePreferences.set('usesHostel', usesHostel === 'true');
    feePreferences.set('usesLibrary', usesLibrary === 'true');
    feePreferences.set('needsDress', needsDress === 'true');
    feePreferences.set('usesLab', usesLab === 'true');
    feePreferences.set('needsExamFee', needsExamFee === 'true');

    let finalRouteId = null;
    if (usesTransport === 'true' && routeId) {
      if (!mongoose.Types.ObjectId.isValid(routeId)) {
        throw new APIError('Invalid route ID format', 400);
      }
      const route = await Route.findOne({ _id: routeId, schoolId });
      if (!route) {
        throw new APIError('Route not found or does not belong to this school', 404);
      }
      finalRouteId = routeId;
    } else if (usesTransport === 'true' && !routeId) {
      throw new APIError('A route is required when transportation is enabled', 400);
    }

    let profileImageUrl = '';
    if (req.file) {
      const fileBuffer = req.file.buffer;
      const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const params = {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: `students/${fileName}`, // Add 'students/' prefix
        Body: fileBuffer,
        ContentType: req.file.mimetype,
      };

      const command = new PutObjectCommand(params);
      await s3Client.send(command);

      profileImageUrl = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/students/${fileName}`;
    }

    const newStudent = new Student({
      admissionNo,
      name,
      email,
      phone: phone || undefined,
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
      feePreferences,
      parents: parsedParents,
      createdBy: userId,
      profileImage: profileImageUrl,
      routeId: finalRouteId,
      status: true,
    });

    await newStudent.save();

    res.status(201).json({ message: 'Student created successfully', student: newStudent });
  } catch (error) {
    console.error('Error creating student:', error.message, error.stack);
    next(error);
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

// const getStudents = async (req, res, next) => {
//   try {
//     const { page = 1, limit = 25, classId, academicYearId, search } = req.query;
//     const query = { schoolId: req.user.schoolId }; // Removed status: true in previous fix


//     if (search) {
//       query.$or = [
//         { name: new RegExp(search, 'i') },
//         { admissionNo: new RegExp(search, 'i') }
//       ];
//     }

//     if (classId) {
//       if (!mongoose.Types.ObjectId.isValid(classId)) {
//         throw new APIError('Invalid class ID format', 400);
//       }
//       query.classId = new mongoose.Types.ObjectId(classId);
//     }

//     if (academicYearId) {
//       if (!mongoose.Types.ObjectId.isValid(academicYearId)) {
//         throw new APIError('Invalid academic year ID format', 400);
//       }
//       query.academicYearId = new mongoose.Types.ObjectId(academicYearId);
//     }


//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);
//     const skip = (pageNum - 1) * limitNum;

//     const students = await Student.find(query)
//       .populate('classId', 'name')
//       .populate('academicYearId', 'name')
//       .sort({ name: 1 })
//       .skip(skip)
//       .limit(limitNum);

//     const total = await Student.countDocuments(query);

//     res.status(200).json({
//       students,
//       total,
//       page: pageNum,
//       limit: limitNum,
//       totalPages: Math.ceil(total / limitNum)
//     });
//   } catch (error) {
//     console.error('Error in getStudents:', error);
//     next(error);
//   }
// };

const getStudents = async (req, res, next) => {
  try {
    const { page = 1, limit = 25, classId, academicYearId, search } = req.query;
    const query = { schoolId: req.user.schoolId };

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

    // Fetch portal details for admin users
    let studentsWithPortals = students;
    if (req.user && req.user.role === 'admin') {
      studentsWithPortals = await Promise.all(students.map(async (student) => {
        const portalUser = await User.findOne({ 
          'additionalInfo.studentId': student._id, 
          role: 'student' 
        });
        return {
          ...student.toObject(),
          portalUsername: portalUser ? portalUser.username : '',
          portalPassword: portalUser ? decryptPassword(portalUser.password) : ''
        };
      }));
    }

    res.status(200).json({
      students: studentsWithPortals,
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

    // Validate and handle routeId
    if (updateData.usesTransport !== undefined && updateData.usesTransport === 'true') {
      if (!updateData.routeId) {
        throw new APIError('A route is required when transportation is enabled', 400);
      }
      if (!mongoose.Types.ObjectId.isValid(updateData.routeId)) {
        throw new APIError('Invalid route ID format', 400);
      }
      const route = await Route.findOne({ _id: updateData.routeId, schoolId: req.user.schoolId });
      if (!route) {
        throw new APIError('Route not found or does not belong to this school', 404);
      }
    } else if (updateData.usesTransport !== undefined && updateData.usesTransport === 'false') {
      updateData.routeId = null; // Clear routeId if transportation is disabled
    }

    // Prevent updating immutable fields
    delete updateData.admissionNo;
    delete updateData.schoolId;
    delete updateData.createdBy;

    // Handle phone field separately to bypass validation
    let updatedData = { ...updateData }; // Create a copy to modify
    if (updatedData.phone !== undefined) {
      updatedData.phone = updatedData.phone || null; // Allow any value or null
    } else {
      delete updatedData.phone; // Remove phone from update if not provided
    }

    // Perform update without validation to avoid phone validation error
    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      { $set: updatedData },
      { new: true, runValidators: false } // Disable all validators to bypass phone validation
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

    const fileBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const params = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: `students/${fileName}`, // Add 'students/' prefix
      Body: fileBuffer,
      ContentType: req.file.mimetype,
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    const imageUrl = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/students/${fileName}`;

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { profileImage: imageUrl },
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
    const { classId, academicYearId, nextAcademicYearId, nextClassId, studentIds, isPromotedManually = false } = req.body;
    const schoolId = req.user.schoolId;

    // Validate required inputs
    if (!classId || !academicYearId || !nextAcademicYearId || !nextClassId) {
      throw new APIError('Class ID, academic year ID, next academic year ID, and next class ID are required', 400);
    }
    if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(nextClassId) ||
        !mongoose.Types.ObjectId.isValid(academicYearId) || !mongoose.Types.ObjectId.isValid(nextAcademicYearId)) {
      throw new APIError('Invalid ID format for class or academic year', 400);
    }

    // Validate studentIds if provided
    if (studentIds) {
      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        throw new APIError('Student IDs must be a non-empty array', 400);
      }
      if (!studentIds.every(id => mongoose.Types.ObjectId.isValid(id))) {
        throw new APIError('All student IDs must be valid ObjectIds', 400);
      }
    }

    // Validate class and academic years
    const currentClass = await Class.findOne({ _id: classId, schoolId });
    if (!currentClass) {
      throw new APIError('Current class not found or does not belong to this school', 404);
    }

    const nextClass = await Class.findOne({ _id: nextClassId, schoolId });
    if (!nextClass) {
      throw new APIError('Next class not found or does not belong to this school', 404);
    }

    const currentAcademicYear = await AcademicYear.findOne({ _id: academicYearId, schoolId });
    if (!currentAcademicYear) {
      throw new APIError('Current academic year not found or does not belong to this school', 404);
    }

    const nextAcademicYear = await AcademicYear.findOne({ _id: nextAcademicYearId, schoolId });
    if (!nextAcademicYear) {
      throw new APIError('Next academic year not found or does not belong to this school', 404);
    }

    // Build query for students
    const query = {
      classId,
      academicYearId,
      schoolId,
      status: true
    };
    if (studentIds) {
      query._id = { $in: studentIds };
    }

    // Find students to promote
    const students = await Student.find(query);
    if (studentIds && students.length !== studentIds.length) {
      const foundIds = new Set(students.map(student => student._id.toString()));
      const invalidIds = studentIds.filter(id => !foundIds.has(id));
      throw new APIError(`Some student IDs are invalid or do not belong to the specified class/academic year: ${invalidIds.join(', ')}`, 400);
    }
    if (students.length === 0) {
      throw new APIError('No students found to promote', 404);
    }

    // Promote students
    const promotedStudents = [];
    const failedStudents = [];

    const updatePromises = students.map(async (student) => {
      try {
        await Student.updateOne(
          { _id: student._id },
          {
            $set: {
              classId: nextClassId,
              academicYearId: nextAcademicYearId,
              rollNo: '', // Clear roll number
              isPromotedManually
            }
          }
        );
        promotedStudents.push({ studentId: student._id, name: student.name });
        console.log(`Promoted ${student.name} to ${nextClass.name}`);
      } catch (error) {
        failedStudents.push({ studentId: student._id, name: student.name, error: error.message });
      }
    });

    await Promise.all(updatePromises);

    if (failedStudents.length > 0) {
      throw new APIError(`Some students failed to promote: ${JSON.stringify(failedStudents)}`, 500);
    }

    res.status(200).json({
      success: true,
      data: {
        promotedStudents,
        failedStudents,
        nextClass: nextClass.name,
        nextAcademicYear: nextAcademicYear.name
      }
    });
  } catch (error) {
    next(error);
  }
};

const createStudentPortal = async (req, res) => {
  try {
    // Check if the logged-in user is an admin
    if (!req.user || req.user.role !== 'admin') {
      throw new APIError('Only admins can create portals', 403);
    }

    // Check if the admin's school has an active subscription
    const currentDate = new Date();
    const subscription = await subscriptionSchema.findOne({
      schoolId: req.user.schoolId,
      status: 'active'
    }).select('expiresAt status');

    if (!subscription || new Date(subscription.expiresAt) < currentDate) {
      throw new APIError('Admin subscription has expired or is not active. Cannot create portals.', 403);
    }

    const { studentId, role } = req.body; // role: 'student' or 'parent'
    const schoolId = req.user.schoolId;

    // Verify student exists and belongs to the admin's school
    const student = await Student.findOne({ _id: studentId, schoolId });
    if (!student) {
      throw new APIError('Student not found or does not belong to your school', 404);
    }

    let username;
    let name;
    let email;
    let phoneNumber;
    let additionalInfo;

    if (role === 'student') {
      username = `${student.admissionNo}-student`;
      name = student.name;
      email = student.email || null;
      phoneNumber = student.phone || null;
      additionalInfo = { studentId: student._id };
    } else if (role === 'parent') {
      username = `${student.admissionNo}-parent`;
      name = student.parents.fatherName || student.parents.motherName || 'Parent';
      email = null;
      phoneNumber = (student.parents.fatherPhone || student.parents.motherPhone) || null;
      additionalInfo = { parentOfStudentId: student._id };
    } else {
      throw new APIError('Invalid role. Must be "student" or "parent"', 400);
    }

    // Check for existing user with the same username
    let baseUsername = username;
    let suffix = 0;
    while (true) {
      const existingUser = await User.findOne({ username });
      if (!existingUser) {
        break;
      }
      suffix++;
      username = `${baseUsername}-${suffix}`;
    }

    // Use fixed password and encrypt it
    const plainPassword = '112233';
    const encryptedPassword = encryptPassword(plainPassword);

    // Create User with schoolId from admin
    const newUser = new User({
      username,
      password: encryptedPassword, // Store encrypted password
      role,
      name,
      email,
      schoolId,
      status: true,
      additionalInfo
    });

    await newUser.save();

    // Return decrypted password to admin in response
    const decryptedPassword = decryptPassword(encryptedPassword);

    res.status(201).json({
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} portal created successfully`,
      user: {
        username,
        role,
        name,
        email,
        schoolId,
        additionalInfo,
        password: decryptedPassword // Return decrypted password for admin
      }
    });
  } catch (error) {
    console.error('Error creating portal:', error);
    res.status(error.status || 400).json({ message: 'Error creating portal', error: error.message });
  }
};

// Export all functions, including getStudentsByClass
module.exports = {
  upload,
  createStudent,
  promoteStudents,
  createStudentPortal,
  bulkCreateStudents,
  getStudents,
  getStudent,
  updateStudent,
  uploadStudentPhoto,
  searchStudents,
  assignRollNumbers,
  assignRollNumbersAlphabetically,
  validateParent,
  getStudentsByClass // Added to exports
};