const Student = require('../../models/student');
const Subject = require('../../models/subject');
const AcademicYear = require('../../models/academicyear');
const APIError = require('../../utils/apiError');
const Class = require('../../models/class');
const School = require('../../models/school');
const Teacher = require('../../models/teacher');
const mongoose = require('mongoose');
const multer = require('multer');
const { paginate } = require('../../utils/paginationHelper');
const Route = require('../../models/route');
const User = require('../../models/user');
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { toR2Key } = require('../../utils/image');
const path = require('path');
const classSubjectAssignment = require('../../models/classSubjectAssignment');
const AuditLog = require('../../models/auditLogs');
const subscription = require('../../models/subscription');
const logger = require('../../config/logger');

let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY?.trim();
const IV_LENGTH = 16;

// ── VALIDATE KEY IMMEDIATELY ──
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('Invalid ENCRYPTION_KEY → using fallback');
    ENCRYPTION_KEY = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f123';
  } else {
    throw new Error('ENCRYPTION_KEY must be 64-char hex string');
  }
}

try {
  if (Buffer.from(ENCRYPTION_KEY, 'hex').length !== 32) throw new Error();
} catch {
  if (process.env.NODE_ENV === 'development') {
    ENCRYPTION_KEY = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f123';
  } else {
    throw new Error('ENCRYPTION_KEY must be valid 32-byte hex');
  }
}

// ---------- Multer (memory) ----------
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new APIError('Only PNG/JPG/JPEG allowed', 400));
  },
});

// ---------- R2 client ----------
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

// ── Function to encrypt password ──
const encryptPassword = (text) => {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error('Encryption error:', error.message);
    throw new APIError('Failed to encrypt password', 500);
  }
};

// ── Function to decrypt password ──
const decryptPassword = (encryptedText) => {
  try {
    if (!encryptedText || typeof encryptedText !== 'string') {
      throw new Error('Invalid encrypted text');
    }
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted || ivHex.length !== 32) {
      throw new Error('Invalid encrypted text format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    logger.error('Decryption error:', error.message);
    return null; // Return null for invalid decryption
  }
};

// ---------- Helper: generate admissionNo ----------
const generateAdmissionNo = async (schoolId, academicYearId) => {
  try {
    // Fetch the school to verify existence
    const school = await School.findById(schoolId);
    if (!school) {
      throw new Error('School not found');
    }

    // Fetch the academic year to verify
    const academicYear = await AcademicYear.findById(academicYearId);
    if (!academicYear) {
      throw new Error('Academic year must be set up');
    }

    // Fetch the school code from AuditLog (create_school action for this school)
    const auditEntry = await AuditLog.findOne({
      action: 'create_school',
      'details.schoolId': new mongoose.Types.ObjectId(schoolId)  // Convert to ObjectId
    }).sort({ createdAt: -1 });
    console.log(auditEntry,schoolId)
    if (!auditEntry || !auditEntry.details?.code) {
      throw new Error('School code not found in audit log. Ensure school was created via registered process.');
    }

    const schoolCode = auditEntry.details.code;  // e.g., "NEWI70"

    // Get current count of students for this school and academic year (simple non-atomic seq)
    const studentCount = await Student.countDocuments({ schoolId, academicYearId, status: true });
    const sequentialNumber = studentCount + 1;
    const formattedSequentialNumber = sequentialNumber.toString().padStart(3, '0');
    
    const admissionNo = `${schoolCode}-${formattedSequentialNumber}`;  // e.g., "NEWI70-001"

    console.log('Generated admissionNo:', admissionNo, 'for school:', schoolId);
    return admissionNo;
  } catch (error) {
    throw new Error(`Error generating admission number: ${error.message}`);
  }
};


// ---------- CREATE STUDENT (POST /api/students/add) ----------
const createStudent = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ---- auth & school ----
    const userId = req.user._id || req.user.id;
    const schoolId = req.user.schoolId;
    if (!userId || !schoolId) throw new APIError('Unauthenticated', 401);

    // ---- parse FormData (multer already gave us req.body & req.file) ----
    const body = { ...req.body };

    // Convert stringified fields
    if (body.section) body.section = Array.isArray(body.section) ? body.section : [body.section];
    if (body.parents) body.parents = JSON.parse(body.parents);
    // Phone: Optional, but 10 digits if provided
    if (body.phone) {
      const cleanedPhone = body.phone.toString().replace(/\D/g, '').slice(-10);
      if (cleanedPhone.length !== 10) {
        return next(new APIError('Phone number must be 10 digits', 400));
      }
      body.phone = cleanedPhone;
    }

    // Parents
    if (body.parents) {
      if (body.parents.fatherName && !body.parents.fatherPhone) {
        return next(new APIError("Father's phone number is required", 400));
      }
      if (body.parents.motherName && !body.parents.motherPhone) {
        return next(new APIError("Mother's phone number is required", 400));
      }
      if (body.parents.fatherPhone && !/^\d{10}$/.test(body.parents.fatherPhone)) {
        return next(new APIError("Father's phone number must be 10 digits", 400));
      }
      if (body.parents.motherPhone && !/^\d{10}$/.test(body.parents.motherPhone)) {
        return next(new APIError("Mother's phone number must be 10 digits", 400));
      }
    }
    body.usesTransport = body.usesTransport === 'true';
    body.usesHostel = body.usesHostel === 'true';

    // ---- required file ----
    if (!req.file) throw new APIError('Profile picture is required', 400);

    // ---- upload to R2 ----
    const ext = req.file.originalname.split('.').pop().toLowerCase();
    const key = `students/${Date.now()}-${userId}.${ext}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    // ---- active academic year ----
    const activeYearResp = await fetch(
      `${req.protocol}://${req.get('host')}/api/academicyear/active/${schoolId}`,
      { headers: { Authorization: req.headers.authorization } }
    );
    const activeYear = await activeYearResp.json();
    if (!activeYear?._id) throw new APIError('No active academic year', 400);
    body.academicYearId = activeYear._id;

    // ---- generate admissionNo ----
    body.admissionNo = await generateAdmissionNo(schoolId, body.academicYearId);

    // ---- final object for Mongoose (only fields that exist in schema) ----
    const studentData = {
      admissionNo: body.admissionNo,
      name: body.name?.trim(),
      email: body.email?.trim() || '',
      phone: body.phone?.trim() || '',
      dateOfBirth: body.dateOfBirth,
      city: body.city?.trim(),
      state: body.state?.trim(),
      country: body.country?.trim(),
      address: body.address?.trim(),
      classId: body.classId,
      section: body.section,
      gender: body.gender,
      schoolId,
      academicYearId: body.academicYearId,
      profileImage: key,
      routeId: body.usesTransport ? body.routeId : null,
      feePreferences: new Map([
        ['usesTransport', body.usesTransport],
        ['usesHostel', body.usesHostel],
        ['usesLibrary', false],
        ['needsDress', false],
        ['usesLab', false],
        ['needsExamFee', true],
        ['needsMiscFee', false],
      ]),
      parents: body.parents || {},
      createdBy: userId,
      status: true,
    };

    // ---- Mongoose will run ALL schema validators (including pre-validate) ----
    const student = new Student(studentData);
    await student.validate();               // throws if invalid
    await student.save({ session });

    // ───────────────────── SEND WELCOME TO PARENT ─────────────────────
    try {
      const [school, subscription] = await Promise.all([
        School.findById(schoolId).select('name preferredChannel'),
        Subscription.findOne({
          schoolId,
          status: { $in: ['active', 'grace_period'] },
          expiresAt: { $gt: new Date() }
        }).sort({ priority: -1 })
      ]);

      if (!school || !subscription) {
        console.log('No school or subscription → skip welcome');
      } else {
        // Reset monthly usage if new month
        const now = new Date();
        const lastReset = subscription.usageStats.lastResetDate;
        const isNewMonth = lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear();

        if (isNewMonth) {
          subscription.usageStats.smsUsedThisMonth = 0;
          subscription.usageStats.whatsappUsedThisMonth = 0;
          subscription.usageStats.lastResetDate = now;
        }

        const parentPhone = student.parents.fatherPhone || student.parents.motherPhone;
        if (!parentPhone) {
          console.log('No parent phone → skip welcome');
        } else {
          const cleanPhone = parentPhone.replace(/\D/g, '').slice(-10);
          const fullPhone = `+91${cleanPhone}`;

          const className = await Class.findById(student.classId).select('name').lean();
          const message = `Welcome to ${school.name}! Your child ${student.name} is enrolled in ${className.name}, Section ${student.section.join(', ')}. Admission No: ${student.admissionNo}.`;

          let smsSent = false, waSent = false;

          // SEND SMS
          if ((school.preferredChannel === 'sms' || school.preferredChannel === 'both') &&
              subscription.usageStats.smsUsedThisMonth < subscription.messageLimits.smsMonthly) {
            await sendSMS(fullPhone, { type: 'welcome-student', message }, school.name);
            subscription.usageStats.smsUsedThisMonth++;
            smsSent = true;
          }

          // SEND WHATSAPP
          if ((school.preferredChannel === 'whatsapp' || school.preferredChannel === 'both') &&
              subscription.usageStats.whatsappUsedThisMonth < subscription.messageLimits.whatsappMonthly) {
            await sendWhatsApp(fullPhone, { type: 'welcome-student', message }, school.name);
            subscription.usageStats.whatsappUsedThisMonth++;
            waSent = true;
          }

          await subscription.save();

          console.log(`Welcome → SMS: ${smsSent}, WhatsApp: ${waSent}`);
        }
      }
    } catch (err) {
      console.error('Welcome failed:', err.message);
      // Don't fail student creation
    }

    await session.commitTransaction();
    res.status(201).json({ message: 'Student created successfully', student });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

// ---------- GET STUDENTS BY CLASS ──
const getStudentsByClass = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const { academicYearId } = req.query;

    if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
      throw new APIError('Valid Class ID required', 400);
    }
    if (!req.user || !req.user.id) {
      throw new APIError('Authentication required', 401);
    }

    let academicYearFilter;
    if (academicYearId) {
      if (!mongoose.Types.ObjectId.isValid(academicYearId)) {
        throw new APIError('Invalid academic year ID', 400);
      }
      academicYearFilter = new mongoose.Types.ObjectId(academicYearId);
    } else {
      const school = await School.findById(req.user.schoolId).select('activeAcademicYear');
      if (!school || !school.activeAcademicYear) {
        throw new APIError('No active academic year', 400);
      }
      academicYearFilter = school.activeAcademicYear;
    }

    const classExists = await Class.findOne({ _id: classId, schoolId: req.user.schoolId });
    if (!classExists) throw new APIError('Class not found in school', 404);

    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: req.user.id });
      if (!teacher) throw new APIError('Teacher profile not found', 404);
      const teacherId = teacher._id;

      const assignment = await classSubjectAssignment.findOne({
        schoolId: req.user.schoolId,
        classId: new mongoose.Types.ObjectId(classId),
        teacherId: teacherId,
        academicYearId: academicYearFilter,
      });

      const isAttendanceTeacher = classExists.attendanceTeacher && classExists.attendanceTeacher.toString() === teacherId.toString();
      const isSubstituteTeacher = classExists.substituteAttendanceTeachers.some(sub => sub.toString() === teacherId.toString());

      if (!assignment && !isAttendanceTeacher && !isSubstituteTeacher) {
        throw new APIError('Unauthorized for this class', 403);
      }
    }

    const query = {
      schoolId: new mongoose.Types.ObjectId(req.user.schoolId),
      classId: new mongoose.Types.ObjectId(classId),
      academicYearId: academicYearFilter,
      status: true,
    };

    const result = await paginate(Student, query, req.query, [{ path: 'classId', select: 'name' }], { rollNo: 1 });

    res.json({
      students: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (error) {
    logger.error('getStudentsByClass error:', error);
    next(error);
  }
};

// ---------- VALIDATE PARENT ──
const validateParent = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const userId = req.query.userId;

    if (!userId) return res.status(400).json({ error: 'userId required' });

    const student = await Student.findOne({ _id: studentId, parentId: userId });
    if (!student) return res.status(404).json({ error: 'Student not found or parent not authorized' });

    res.json({ success: true });
  } catch (err) {
    logger.error('validateParent error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ---------- BULK CREATE STUDENTS ──
const bulkCreateStudents = async (req, res, next) => {
  try {
    const studentsData = req.body;
    if (!Array.isArray(studentsData) || !studentsData.length) {
      throw new APIError('Students data must be non-empty array', 400);
    }

    const schoolId = req.user.schoolId;
    const userId = req.user._id || req.user.id;

    const academicYear = await AcademicYear.findOne({ schoolId, isActive: true });
    if (!academicYear) throw new APIError('No active academic year', 404);

    const classes = await Class.find({ schoolId });
    const validClassIds = new Set(classes.map(cls => cls._id.toString()));

    const studentCount = await Student.countDocuments({ schoolId, academicYearId: academicYear._id });
    let sequentialNumber = studentCount;

    const school = await School.findById(schoolId).select('code');
    const schoolCode = school.code || 'SCH';
    const year = academicYear.name.split('-')[0];

    const studentsToInsert = await Promise.all(studentsData.map(async (student, index) => {
      const classId = student.classId?.trim();
      if (!classId || !mongoose.Types.ObjectId.isValid(classId) || !validClassIds.has(classId)) {
        throw new APIError(`Invalid class ID for student ${index}`, 400);
      }

      sequentialNumber += 1;
      const admissionNo = `${schoolCode}-${year}-${sequentialNumber.toString().padStart(3, '0')}`;

      const addressParts = student.address.split(', ').map(part => part.trim());
      const city = addressParts[addressParts.length - 2] || '';
      const state = addressParts[addressParts.length - 1] || '';
      const country = 'India';

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
        classId,
        section: student.section,
        address: student.address,
        gender: student.gender,
        schoolId,
        academicYearId: academicYear._id,
        usesTransport: student.transport === 'YES',
        usesHostel: student.hostel === 'YES',
        parents,
        createdBy: userId,
        status: true
      };
    }));

    const createdStudents = await Student.insertMany(studentsToInsert, { ordered: false });
    res.status(201).json({ success: true, data: createdStudents });
  } catch (error) {
    logger.error('bulkCreateStudents error:', error);
    next(error);
  }
};

// ── GET STUDENTS ──
const getStudents = async (req, res, next) => {
  try {
    const { page = 1, limit = 25, classId, academicYearId, search } = req.query;
    const query = { schoolId: req.user.schoolId, status: true };

    if (search) {
      query.$or = [{ name: new RegExp(search, 'i') }, { admissionNo: new RegExp(search, 'i') }];
    }
    if (classId) query.classId = new mongoose.Types.ObjectId(classId);
    if (academicYearId) query.academicYearId = new mongoose.Types.ObjectId(academicYearId);

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const [students, total] = await Promise.all([
      Student.find(query)
        .populate('classId', 'name')
        .populate('academicYearId', 'name')
        .sort({ name: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Student.countDocuments(query)
    ]);

    const studentsWithPortals = await Promise.all(students.map(async (student) => {
      const studentObjectId = new mongoose.Types.ObjectId(student._id);
      const key = toR2Key(student.profileImage);
      const url = key ? `${req.protocol}://${req.get('host')}/api/proxy-image/${encodeURIComponent(key)}` : '';

      const [studentUser, parentUser] = await Promise.all([
        User.findOne({
          schoolId: req.user.schoolId,
          role: 'student',
          'additionalInfo.studentId': studentObjectId
        }).select('username password'),
        User.findOne({
          schoolId: req.user.schoolId,
          role: 'parent',
          'additionalInfo.parentOfStudentId': studentObjectId
        }).select('username password')
      ]);

      return {
        ...student,
        profileImageKey: key,
        profileImageUrl: url,
        portalUsername: studentUser ? studentUser.username : '',
        portalPassword: studentUser ? decryptPassword(studentUser.password) || '' : '',
        parentPortalUsername: parentUser ? parentUser.username : '',
        parentPortalPassword: parentUser ? decryptPassword(parentUser.password) || '' : ''
      };
    }));

    res.status(200).json({
      students: studentsWithPortals,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    logger.error('getStudents error:', error);
    next(error);
  }
};

// ── GET STUDENT ──
const getStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id).populate('classId', 'name').populate('academicYearId', 'name');
    if (!student) throw new APIError('Student not found', 404);
    res.status(200).json(student);
  } catch (error) {
    next(error);
  }
};

// ── UPDATE STUDENT ──
const updateStudent = async (req, res, next) => {
  try {
    const studentId = req.params.id;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new APIError('Invalid student ID format', 400);
    }

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



const softDeleteStudents = async (req, res, next) => {
  try {
    const { studentIds } = req.body;

    // Validate input
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      throw new APIError('studentIds must be a non-empty array', 400);
    }

    // Validate all student IDs
    if (!studentIds.every(id => mongoose.Types.ObjectId.isValid(id))) {
      throw new APIError('All student IDs must be valid ObjectIds', 400);
    }

    const schoolId = req.user.schoolId;

    // Verify all students belong to the user's school and are active
    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId,
      status: true
    });

    if (students.length === 0) {
      throw new APIError('No active students found with the provided IDs', 404);
    }

    if (students.length !== studentIds.length) {
      const foundIds = new Set(students.map(student => student._id.toString()));
      const invalidIds = studentIds.filter(id => !foundIds.has(id));
      throw new APIError(`Some student IDs are invalid or already inactive: ${invalidIds.join(', ')}`, 400);
    }

    // Perform soft delete by setting status to false
    const result = await Student.updateMany(
      { _id: { $in: studentIds }, schoolId },
      { $set: { status: false } }
    );

    if (result.modifiedCount === 0) {
      throw new APIError('Failed to soft delete students', 500);
    }

    res.status(200).json({
      success: true,
      message: `Successfully soft deleted ${result.modifiedCount} student(s)`,
      deletedStudentIds: studentIds
    });
  } catch (error) {
    console.error('Error in softDeleteStudents:', error);
    next(error);
  }
};


const uploadStudentPhoto = async (req, res, next) => {
  try {
    const studentId = req.params.id;

    if (!req.file) {
      throw new APIError('No file uploaded', 400);
    }

    const fileName = `student-${studentId}-${Date.now()}${path.extname(req.file.originalname)}`;
    const key = `students/${fileName}`;

    const uploadParams = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    };

    // FIX: Use s3Client instead of s3
    await s3Client.send(new PutObjectCommand(uploadParams));

    const student = await Student.findByIdAndUpdate(
      studentId,
      { profileImage: key }, // Store only the key
      { new: true }
    );

    res.status(200).json({ 
      message: 'Photo uploaded successfully',
      student
    });
  } catch (error) {
    console.error('Error in uploadStudentPhoto:', error);
    next(error);
  }
};


const searchStudents = async (req, res, next) => {
  try {
    // SUPPORT BOTH: /search/roh (param) AND /search?q=roh (query)
    const rawQuery = req.params.query || req.query.q || '';
    const q = rawQuery.trim();

    const { schoolId, limit = 50 } = req.query;

    // VALIDATE
    if (!schoolId) {
      return res.status(400).json({ message: 'schoolId is required' });
    }

    if (!q || q.length < 2) {
      return res.json({ students: [] });
    }

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json({ message: 'Invalid schoolId format' });
    }

    // SEARCH BY NAME OR ADMISSION NO
    const students = await Student.find({
      schoolId: new mongoose.Types.ObjectId(schoolId),
      status: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { admissionNo: { $regex: q, $options: 'i' } }
      ]
    })
      .select('name admissionNo _id classId')
      .limit(Math.min(parseInt(limit), 100)) // cap at 100
      .sort({ name: 1 })
      .lean();

    res.json({ students });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

const assignRollNumberToStudent = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const studentId = req.params.id;
    const { rollNo } = req.body;
    const schoolId = req.user.schoolId;
    const userId = req.user._id || req.user.id;

    // ── VALIDATIONS ─────────────────────────────────────
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new APIError('Invalid student ID format', 400);
    }

    if (!rollNo || !/^\d{1,3}$/.test(rollNo)) { // Allow 1-999, padded later if needed
      throw new APIError('Valid roll number (1-999) is required', 400);
    }

    // ── FETCH STUDENT ──────────────────────────────────
    const student = await Student.findOne({ _id: studentId, schoolId, status: true }).session(session);
    if (!student) {
      throw new APIError('Student not found or inactive', 404);
    }

    // ── AUTHORIZATION CHECK ───────────────────────────
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: req.user.id, schoolId }).session(session);
      if (!teacher) {
        throw new APIError('Teacher profile not found', 404);
      }

      const teacherId = teacher._id;

      const classExists = await Class.findOne({ 
        _id: student.classId, 
        schoolId,
        $or: [
          { attendanceTeacher: teacherId },
          { substituteAttendanceTeachers: teacherId }
        ]
      }).session(session);

      const assignment = await classSubjectAssignment.findOne({
        schoolId,
        classId: student.classId,
        teacherId,
        academicYearId: student.academicYearId,
      }).session(session);

      if (!classExists && !assignment) {
        throw new APIError('Unauthorized to assign roll numbers for this student\'s class', 403);
      }
    }

    // ── CHECK DUPLICATE ROLL NO IN CLASS/SECTION ──────
    const existingWithRollNo = await Student.findOne({
      schoolId,
      academicYearId: student.academicYearId,
      classId: student.classId,
      section: { $all: student.section }, // Match all sections
      rollNo: rollNo.toString().padStart(2, '0'), // Pad for comparison
      _id: { $ne: studentId }, // Exclude self
      status: true
    }).session(session);

    if (existingWithRollNo) {
      throw new APIError(`Roll number ${rollNo} already assigned to another student in this section`, 409);
    }

    // ── UPDATE ROLL NO ─────────────────────────────────
    const paddedRollNo = rollNo.toString().padStart(2, '0');
    await Student.updateOne(
      { _id: studentId },
      { $set: { rollNo: paddedRollNo, updatedBy: userId, updatedAt: new Date() } }
    ).session(session);

    // ── AUDIT LOG ─────────────────────────────────────
    await AuditLog.create([{
      userId,
      schoolId,
      action: 'assign_roll_number',
      details: {
        studentId,
        studentName: student.name,
        classId: student.classId,
        section: student.section,
        rollNo: paddedRollNo,
        assignedBy: req.user.role
      },
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    }], { session });

    await session.commitTransaction();

    // ── REFETCH FOR RESPONSE ──────────────────────────
    const updatedStudent = await Student.findById(studentId).populate('classId', 'name').session(session);

    logger.info(`Roll number ${paddedRollNo} assigned to student ${student.name} (${studentId}) by ${req.user.role}:${userId}`);

    res.status(200).json({
      success: true,
      message: `Roll number ${paddedRollNo} assigned successfully to ${student.name}`,
      student: updatedStudent
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('assignRollNumberToStudent error:', error);
    next(error);
  } finally {
    session.endSession();
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
    const {
      classId,
      academicYearId,
      nextAcademicYearId,
      nextClassId,
      studentIds,
      isPromotedManually = false
    } = req.body;
    const schoolId = req.user.schoolId;

    // ── VALIDATIONS ─────────────────────────────────────
    if (!classId || !academicYearId || !nextAcademicYearId || !nextClassId) {
      throw new APIError('All IDs (class, academicYear, nextClass, nextYear) are required', 400);
    }

    const ids = [classId, nextClassId, academicYearId, nextAcademicYearId];
    if (!ids.every(id => mongoose.Types.ObjectId.isValid(id))) {
      throw new APIError('Invalid ID format', 400);
    }

    if (studentIds) {
      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        throw new APIError('studentIds must be a non-empty array', 400);
      }
      if (!studentIds.every(id => mongoose.Types.ObjectId.isValid(id))) {
        throw new APIError('All studentIds must be valid ObjectIds', 400);
      }
    }

    // ── FETCH REFERENCE DOCS ───────────────────────────
    const [currentClass, nextClass, currentYear, nextYear] = await Promise.all([
      Class.findOne({ _id: classId, schoolId }),
      Class.findOne({ _id: nextClassId, schoolId }),
      AcademicYear.findOne({ _id: academicYearId, schoolId }),
      AcademicYear.findOne({ _id: nextAcademicYearId, schoolId })
    ]);

    [currentClass, nextClass, currentYear, nextYear].forEach((doc, i) => {
      if (!doc) {
        const names = ['Current class', 'Next class', 'Current year', 'Next year'];
        throw new APIError(`${names[i]} not found or does not belong to this school`, 404);
      }
    });

    // ── BUILD STUDENT QUERY ───────────────────────────
    const query = { classId, academicYearId, schoolId, status: true };
    if (studentIds) query._id = { $in: studentIds };

    // ── FETCH STUDENTS TO PROMOTE ─────────────────────
    const students = await Student.find(query);
    if (students.length === 0) {
      throw new APIError('No active students found to promote', 404);
    }

    if (studentIds && students.length !== studentIds.length) {
      const found = new Set(students.map(s => s._id.toString()));
      const missing = studentIds.filter(id => !found.has(id));
      throw new APIError(`Invalid/missing student IDs: ${missing.join(', ')}`, 400);
    }

    // ── PROMOTE EACH STUDENT ──────────────────────────
    const promoted = [];
    const failed = [];

    await Promise.all(
      students.map(async student => {
        try {
          const historyEntry = {
            classId: student.classId,
            className: student.className || currentClass.name,
            academicYearId: student.academicYearId,
            academicYearName: student.academicYearName || currentYear.name,
            promotedAt: new Date(),
            promotionStatus: 'promoted'
          };

          await Student.updateOne(
            { _id: student._id },
            {
              $set: {
                classId: nextClassId,
                academicYearId: nextAcademicYearId,
                className: nextClass.name,
                academicYearName: nextYear.name,
                rollNo: '',
                isPromotedManually
              },
              $push: { promotionHistory: historyEntry }
            }
          );

          promoted.push({ studentId: student._id, name: student.name });
        } catch (err) {
          failed.push({ studentId: student._id, name: student.name, error: err.message });
        }
      })
    );

    if (failed.length > 0) {
      throw new APIError(`Promotion failed for ${failed.length} student(s): ${JSON.stringify(failed)}`, 500);
    }

    // ── SUCCESS RESPONSE ───────────────────────────────
    res.status(200).json({
      success: true,
      data: {
        promotedStudents: promoted,
        nextClass: nextClass.name,
        nextAcademicYear: nextYear.name
      }
    });
  } catch (error) {
    next(error);
  }
};


const getOldStudents = async (req, res, next) => {
  try {
    const { academicYearId, classId } = req.query;
    const schoolId = req.user.schoolId;

    if (!academicYearId || !classId) {
      throw new APIError('academicYearId and classId query params required', 400);
    }

    const students = await Student.find({ schoolId })
      .elemMatch('promotionHistory', { 
        academicYearId: new mongoose.Types.ObjectId(academicYearId), 
        classId: new mongoose.Types.ObjectId(classId) 
      })
      .select('name admissionNo phone section promotionHistory')
      .populate('promotionHistory.classId', 'name'); // Show old class

    res.json({ success: true, data: { students } });
  } catch (error) {
    next(error);
  }
};


const getStudentsList = async (req, res) => {
  try {
    const schoolId = req.user.schoolId; // From auth
    const { page = 1, limit = 25, all = false } = req.query;
    const skip = (page - 1) * limit;

    const query = { schoolId, status: true }; // Active only

    let students;
    if (all === 'true') {
      // Bulk: Full list, no paginate
      students = await Student.find(query).populate('classId', 'name').lean();
    } else {
      // Paginated
      students = await Student.find(query)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('classId', 'name')
        .lean();
    }

    // Add parent phone extraction for bulk
    const studentsWithParents = students.map(student => ({
      ...student,
      parentPhone: student.parents?.fatherPhone || student.parents?.motherPhone // Fallback
    }));

    if (all === 'true') {
      res.json({ data: studentsWithParents, total: studentsWithParents.length });
    } else {
      const total = await Student.countDocuments(query);
      res.json({ data: studentsWithParents, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    }
  } catch (err) {
    logger.error('Get students error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};  

const createStudentPortal = async (req, res) => {
  try {
    // Check if the logged-in user is an admin
    if (!req.user || req.user.role !== 'admin') {
      throw new APIError('Only admins can create portals', 403);
    }

    const { studentId, role } = req.body; // role: 'student' or 'parent'
    const schoolId = req.user.schoolId;

    // Verify student exists and belongs to the admin's school
    const student = await Student.findOne({ _id: studentId, schoolId });
    if (!student) {
      throw new APIError('Student not found or does not belong to your school', 404);
    }

    const studentObjectId = new mongoose.Types.ObjectId(studentId);

    // Check for existing portal
    let query = {};
    if (role === 'student') {
      query = { schoolId, role, 'additionalInfo.studentId': studentObjectId };
    } else if (role === 'parent') {
      query = { schoolId, role, 'additionalInfo.parentOfStudentId': studentObjectId };
    } else {
      throw new APIError('Invalid role. Use "student" or "parent"', 400);
    }

    const existingUser = await User.findOne(query);
    if (existingUser) {
      const decryptedPassword = decryptPassword(existingUser.password) || '112233'; // Default fallback
      return res.status(400).json({
        message: `${role} portal already exists for this student`,
        credentials: { username: existingUser.username, password: decryptedPassword }
      });
    }

    // Generate unique username
    let baseUsername = `${student.admissionNo}-${role}`;
    let username = baseUsername;
    let suffix = 0;
    while (await User.findOne({ username, schoolId })) {
      suffix++;
      username = `${baseUsername}-${suffix}`;
    }

    // Set name based on role
    const name = role === 'student' ? student.name : (student.parents.fatherName || student.parents.motherName || 'Parent');

    // Generate random password
    const generateRandomPassword = (length = 8) => {
      const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let password = '';
      for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
      }
      return password;
    };

    const plainPassword = generateRandomPassword(8);
    const encryptedPassword = encryptPassword(plainPassword); // Use AES encryption

    // Generate email
    const email = `${username}@school-${schoolId.toString().substring(0, 8)}.edu`;

    // Create new user
    const newUser = new User({
      username,
      password: encryptedPassword, // Store AES-encrypted password
      role,
      name,
      email,
      schoolId,
      status: true,
      additionalInfo: role === 'student' ? { studentId: studentObjectId } : { parentOfStudentId: studentObjectId }
    });

    await newUser.save();

    res.status(201).json({
      message: `${role} portal created successfully`,
      credentials: { username, password: plainPassword }
    });
  } catch (error) {
    console.error('Error creating portal:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        message: `${field} already exists`,
        error: `The ${field} '${error.keyValue[field]}' is already in use`
      });
    }
    res.status(error.statusCode || 500).json({ message: 'Error creating portal', error: error.message });
  }
};



// Export all functions, including getStudentsByClass
module.exports = {
  createStudent,
  promoteStudents,
  createStudentPortal,
  getStudentsList,
  bulkCreateStudents,
  getStudents,
  getStudent,
  updateStudent,
  uploadStudentPhoto,
  searchStudents,
  assignRollNumbers,
  assignRollNumbersAlphabetically,
  assignRollNumberToStudent,
  validateParent,
  softDeleteStudents,
  getOldStudents,
  getStudentsByClass // Added to exports
};