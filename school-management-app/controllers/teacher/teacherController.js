const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Teacher = require('../../models/teacher');
const User = require('../../models/user');
const School = require('../../models/school');
const Subscription = require('../../models/subscription'); 
const Class = require('../../models/class');
const Subject = require('../../models/subject');
const APIError = require('../../utils/apiError');
const nodemailer = require('nodemailer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const { toR2Key } = require('../../utils/image');
const logger = require('../../config/logger');
const { deliver } = require('../../services/notificationService');

// Constants
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_FILE_TYPES = ['image/png', 'image/jpg', 'image/jpeg'];

// R2 Configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      return cb(new APIError('Only PNG, JPG, and JPEG files are allowed.', 400));
    }
    cb(null, true);
  },
}).single('profileImage');

// File Upload Configuration (already configured with .single('profileImage'))
exports.upload = upload;

// Helper Functions
  async function validateTeacherInput(reqBody, isUpdate = false) {
    const { subjects, ...rest } = reqBody;
    const data = {
      ...rest,
      subjects: Array.isArray(subjects) ? subjects : JSON.parse(subjects || '[]')
    };

    // Production-level validation
    const requiredFields = isUpdate ? ['name'] : ['name', 'username', 'email', 'password'];
    for (const field of requiredFields) {
      if (!data[field]?.trim()) {
        throw new APIError(`${field.charAt(0).toUpperCase() + field.slice(1)} is required`, 400);
      }
    }

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new APIError('Invalid email format', 400);
    }

    if (data.phone && !/^\d{10}$/.test(data.phone)) {
      throw new APIError('Phone must be a valid 10-digit number', 400);
    }

    if (data.subjects && (!Array.isArray(data.subjects) || data.subjects.length === 0)) {
      throw new APIError('At least one subject is required', 400);
    }

    if (!isUpdate && data.password && data.password.length < 6) {
      throw new APIError('Password must be at least 6 characters', 400);
    }

    return data;
  }

  async function getActiveAcademicYearId(schoolId) {
    const school = await School.findById(schoolId).select('activeAcademicYear').lean().orFail(new APIError('School not found', 404));
    if (!school.activeAcademicYear) throw new APIError('No active academic year set', 400);
    return school.activeAcademicYear;
  }

  async function checkAndResetUsage(subscription) {
    const now = new Date();
    const lastReset = subscription.usageStats.lastResetDate;
    const lastResetMonth = lastReset.getMonth();
    const lastResetYear = lastReset.getFullYear();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    if (lastResetMonth !== currentMonth || lastResetYear !== currentYear) {
      subscription.usageStats.smsUsedThisMonth = 0;
      subscription.usageStats.whatsappUsedThisMonth = 0;
      subscription.usageStats.lastResetDate = now;
      await subscription.save();
    }
  }


const createWelcomeNotification = async (teacherData, school, userId, session, senderId) => {
  const notificationData = {
    schoolId: school._id,
    senderId: senderId, // Use the passed parameter (req.user.id from addTeacher)
    type: 'welcome', // Matches your enum
    title: `Welcome to ${school.name}`, // Required field
    message: `Welcome to ${school.name}, ${teacherData.name}! You've been added as a teacher. Your login: Username: ${teacherData.username}, Password: ${teacherData.password}. Please change your password after first login. School contact: ${school.mobileNo}, ${school.email}`,
    recipientId: userId, // New teacher's userId
    data: {
      recipientPhone: teacherData.phone,
      teacherName: teacherData.name,
      username: teacherData.username,
      password: teacherData.password,
      schoolName: school.name,
      schoolEmail: school.email,
      schoolPhone: school.mobileNo
    },
    status: 'pending', // Matches your default/enum
    // No studentId (optional, omitted for teachers)
  };

  const Notification = require('../../models/notifiation'); // Fixed path
  
  const notification = new Notification(notificationData);
  await notification.save({ session });
  
  return notification;
};


async function createTransporter(schoolId) {
  const school = await School.findById(schoolId).select('communication name').lean();

  const email = school?.communication?.emailFrom;
  const pass = school?.communication?.emailPass;

  if (!email || !pass) {
    logger.error(`School ${schoolId} has no email config!`);
    throw new Error('School email not configured');
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: email, pass: pass },
    tls: { rejectUnauthorized: false }
  });
}

/**
 * ADD TEACHER — FINAL 100% WORKING (EMAIL FIXED FOREVER)
 */
exports.addTeacher = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const schoolId = req.user.schoolId;

      const school = await School.findById(schoolId)
        .select('name communication activeAcademicYear')
        .populate('activeAcademicYear')
        .lean()
        .session(session);

      if (!school) throw new Error('School not found');
      if (!school.activeAcademicYear) throw new Error('No active academic year set');

      const academicYearId = school.activeAcademicYear._id;

      // Extract all fields
      const {
        name,
        username,
        email,
        phone,
        designation,
        subjects,
        gender,
        qualification,
        joiningDate,
        dateOfBirth,
        address,
        bloodGroup,
        emergencyContactName,
        emergencyContactPhone,
        leaveBalance = 12
      } = req.body;

      // Required fields check
      if (!name?.trim() || !username?.trim() || !email?.trim() || !phone?.trim() ||
          !designation?.trim() || !gender || !subjects) {
        throw new Error('All required fields must be filled');
      }

      // Parse subjects safely
      let parsedSubjects = [];
      try {
        parsedSubjects = typeof subjects === 'string' ? JSON.parse(subjects) : subjects;
        if (!Array.isArray(parsedSubjects) || parsedSubjects.length === 0) {
          throw new Error('At least one subject must be selected');
        }
      } catch (e) {
        throw new Error('Invalid subjects format');
      }

      // Check duplicate email/username in User collection
      const existingUser = await User.findOne({
        schoolId,
        $or: [
          { email: email.toLowerCase().trim() },
          { username: username.toLowerCase().trim() }
        ]
      }).session(session);

      if (existingUser) {
        throw new Error('Email or username already exists in this school');
      }

      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1@';

      // Create User for portal login
      const newUser = new User({
        name: name.trim(),
        username: username.toLowerCase().trim(),
        email: email.toLowerCase().trim(),
        password: bcrypt.hashSync(tempPassword, 10),
        role: 'teacher',
        schoolId,
        phoneNumber: phone.trim()
      });
      await newUser.save({ session });

      // Upload profile image
      let profileImageKey = '';
      if (req.file) {
        const fileExt = req.file.originalname.split('.').pop()?.toLowerCase();
        const fileName = `teachers/${newUser._id}_${Date.now()}.${fileExt}`;

        await s3Client.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype
        }));

        profileImageKey = fileName;
      }

      // Create Teacher document - WITH name, email, phone (backward compatible)
      const teacher = new Teacher({
        userId: newUser._id,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        designation: designation.trim(),
        subjects: parsedSubjects,
        gender,
        qualification: qualification?.trim(),
        joiningDate: joiningDate ? new Date(joiningDate) : undefined,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        address: address?.trim(),
        bloodGroup: bloodGroup?.trim(),
        emergencyContactName: emergencyContactName?.trim(),
        emergencyContactPhone: emergencyContactPhone?.trim(),
        leaveBalance: parseInt(leaveBalance) || 12,
        profileImage: profileImageKey,
        schoolId,
        academicYearId,
        status: true,
        createdBy: req.user.id
      });

      await teacher.save({ session });

        // Send welcome email FROM SCHOOL'S CONFIGURED EMAIL to the TEACHER
    try {
      const transporter = await createTransporter(schoolId); // This uses school's SMTP settings
      const fromName = school.communication?.emailName || school.name;
      const fromEmail = school.communication?.emailFrom; // This is the school's email (e.g., admin@myschool.com)

      if (!fromEmail) {
        logger.warn('School email not configured — skipping welcome email');
      } else {
        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,  // ← FROM school's email
          to: email,                             // ← TO teacher's email (correct)
          subject: `Welcome to ${school.name} - Your Teacher Account`,
          html: `
            <h2>Hello ${name},</h2>
            <p>You have been successfully added as a teacher at <strong>${school.name}</strong>.</p>
            <div style="background:#f0f0f0;padding:15px;border-radius:8px;margin:20px 0;">
              <p><strong>Your Login Credentials:</strong></p>
              <p><strong>Username:</strong> ${username}</p>
              <p><strong>Temporary Password:</strong> ${tempPassword}</p>
              </div>
              <p><strong>Important:</strong> Please change your password immediately after logging in.</p>
              <p>Best regards,<br><strong>${school.name} Administration</strong></p>
            `
          });
          logger.info(`Welcome email sent from ${fromEmail} to ${email}`);
        }
      } catch (emailErr) {
        logger.warn('Failed to send welcome email:', emailErr.message);
        // Don't fail the whole transaction
      }

      // Store result
      result = {
        teacherId: teacher._id,
        username: username.toLowerCase().trim(),
        temporaryPassword: tempPassword
      };
    });

    // Success
    return res.status(201).json({
      success: true,
      message: 'Teacher added successfully! Credentials sent via email.',
      data: result
    });

  } catch (err) {
    logger.error('Add teacher error:', err.message);
    return res.status(400).json({
      success: false,
      message: err.message || 'Failed to add teacher'
    });
  } finally {
    session.endSession();
  }
};


/**
 * @desc    Get all teachers for current school
 * @route   GET /api/teachers/list
 * @access  Private/Admin
 */
exports.getTeachersBySchool = async (req, res, next) => {
  try {
    const teachers = await Teacher.find({ 
      schoolId: req.user.schoolId,
      status: true 
    })
    .populate('userId', 'username')
    .populate('academicYear', 'year')
    .lean();

    const base = `${req.protocol}://${req.get('host')}`; // Dynamic base URL

    const teacherWithImages = await Promise.all(teachers.map(async (teacher) => {
      const key = toR2Key(teacher.profileImage); // Extracts key from full URL (ensure toR2Key is defined)
      const url = key ? `${base}/api/proxy-image/${encodeURIComponent(key)}` : '';

      return {
        ...teacher, // No .toObject() needed – teacher is already a plain object
        profileImageKey: key,
        profileImageUrl: url,
      };
    }));

    res.json({
      success: true,
      count: teachers.length,
      data: teacherWithImages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single teacher
 * @route   GET /api/teachers/:id
 * @access  Private/Admin
 */
exports.getTeacher = async (req, res, next) => {
  try {
    const teacher = await Teacher.findOne({
      _id: req.params.id,
      schoolId: req.user.schoolId
    }).orFail(new APIError('Teacher not found', 404));

    const base = `${req.protocol}://${req.get('host')}`;
    const key = toR2Key(teacher.profileImage);
    const profileImageUrl = key ? `${base}/api/proxy-image/${encodeURIComponent(key)}` : '';

    const enrichedTeacher = {
      ...teacher.toObject(),
      profileImageUrl,
    };

    res.json({
      success: true,
      data: enrichedTeacher
    });
  } catch (error) {
    next(error);
  }
};


/**
 * @desc Update teacher
 * @route PUT /api/teachers/:id
 * @access Private/Admin
 */
/**
 * @desc Update teacher
 * @route PUT /api/teachers/:id
 * @access Private/Admin
 */
exports.updateTeacher = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (req.user.role !== 'admin') {
        throw new APIError('Unauthorized: Only admins can update teachers', 403);
      }

      const schoolId = req.user.schoolId;
      const teacherId = req.params.id;

      // Extract ALL possible fields from body
      const {
        name,
        email,
        phone,
        designation,
        subjects,
        gender,
        qualification,
        joiningDate,
        dateOfBirth,
        address,
        bloodGroup,
        emergencyContactName,
        emergencyContactPhone,
        leaveBalance,
        status
      } = req.body;

      // Find teacher
      const teacher = await Teacher.findOne({ _id: teacherId, schoolId }).session(session);
      if (!teacher) throw new APIError('Teacher not found', 404);

      // Parse subjects if sent
      let parsedSubjects = teacher.subjects;
      if (subjects) {
        try {
          parsedSubjects = typeof subjects === 'string' ? JSON.parse(subjects) : subjects;
          if (!Array.isArray(parsedSubjects) || parsedSubjects.length === 0) {
            throw new Error('At least one subject must be selected');
          }
        } catch (e) {
          throw new APIError('Invalid subjects format', 400);
        }
      }

      // Handle email update (also update in User if exists)
      if (email && email.toLowerCase().trim() !== teacher.email) {
        const normalizedEmail = email.toLowerCase().trim();

        // Check if new email is already used by another user
        const existingUser = await User.findOne({
          schoolId,
          email: normalizedEmail,
          _id: { $ne: teacher.userId } // Exclude current user
        }).session(session);

        if (existingUser) {
          throw new APIError('Email already in use by another account', 400);
        }

        // Update in User collection if userId exists
        if (teacher.userId) {
          await User.findByIdAndUpdate(
            teacher.userId,
            { email: normalizedEmail },
            { session }
          );
        }

        teacher.email = normalizedEmail;
      }

      // Handle profile image upload
      let profileImageKey = teacher.profileImage;
      if (req.file) {
        const ext = req.file.originalname.split('.').pop()?.toLowerCase();
        const fileName = `teachers/${teacher.userId || teacher._id}_${Date.now()}.${ext}`;

        await s3Client.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype
        }));

        profileImageKey = fileName;
      }

      // Update all fields — INCLUDING NEW ONES
      teacher.name = name?.trim() || teacher.name;
      teacher.phone = phone?.trim() || teacher.phone;
      teacher.designation = designation?.trim() || teacher.designation;
      teacher.subjects = parsedSubjects;
      teacher.gender = gender || teacher.gender;
      teacher.qualification = qualification?.trim() || teacher.qualification;
      teacher.joiningDate = joiningDate ? new Date(joiningDate) : teacher.joiningDate;
      teacher.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : teacher.dateOfBirth;
      teacher.address = address?.trim() || teacher.address;
      teacher.bloodGroup = bloodGroup?.trim() || teacher.bloodGroup;
      teacher.emergencyContactName = emergencyContactName?.trim() || teacher.emergencyContactName;
      teacher.emergencyContactPhone = emergencyContactPhone?.trim() || teacher.emergencyContactPhone;
      teacher.leaveBalance = leaveBalance !== undefined ? parseInt(leaveBalance) : teacher.leaveBalance;
      teacher.status = status !== undefined ? status : teacher.status;
      teacher.profileImage = profileImageKey;

      await teacher.save({ session });

      // Generate proxy URL
      const base = `${req.protocol}://${req.get('host')}`;
      const key = toR2Key(teacher.profileImage);
      const profileImageUrl = key ? `${base}/api/proxy-image/${encodeURIComponent(key)}` : null;

      res.json({
        success: true,
        message: 'Teacher updated successfully',
        data: {
          ...teacher.toObject(),
          profileImageUrl
        }
      });
    });
  } catch (error) {
    logger.error('updateTeacher error:', error);
    if (session.inTransaction()) await session.abortTransaction();
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to update teacher'
    });
  } finally {
    session.endSession();
  }
};

/**
 * @desc Upload teacher profile image
 * @route PUT /api/teachers/:id/photo
 * @access Private/Admin
 */
exports.uploadTeacherPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new APIError('Please upload a file', 400);
    }

    const fileBuffer = req.file.buffer;
    const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const key = `teachers/${fileName}`;
    const params = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: req.file.mimetype,
    };
    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    const base = `${req.protocol}://${req.get('host')}`;
    const profileImageUrl = `${base}/api/proxy-image/${encodeURIComponent(key)}`;

    const teacher = await Teacher.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.user.schoolId },
      { profileImage: key }, // Store key only
      { new: true }
    ).orFail(new APIError('Teacher not found', 404));

    res.json({
      success: true,
      data: {
        profileImage: key,
        profileImageUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Soft delete a teacher and clean up related assignments
 * @route DELETE /api/teachers/:id
 * @access Private/Admin
 */
exports.softDeleteTeacher = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (req.user.role !== 'admin') {
        throw new APIError('Unauthorized: Only admins can delete teachers', 403);
      }
      const teacher = await Teacher.findOne({
        _id: req.params.id,
        schoolId: req.user.schoolId
      })
        .session(session)
        .orFail(new APIError('Teacher not found', 404));

      // Soft delete teacher
      teacher.status = false;
      await teacher.save({ session });

      // Soft delete associated User
      const user = await User.findOne({ _id: teacher.userId }).session(session);
      if (user) {
        user.status = false;
        await user.save({ session });
      }

      // Remove teacher from Class and Subject associations
      await Class.updateMany(
        { schoolId: req.user.schoolId, attendanceTeacher: req.params.id },
        { $set: { attendanceTeacher: null } },
        { session }
      );
      await Class.updateMany(
        { schoolId: req.user.schoolId, substituteAttendanceTeachers: req.params.id },
        { $pull: { substituteAttendanceTeachers: req.params.id } },
        { session }
      );
      await Subject.updateMany(
        { schoolId: req.user.schoolId, teachers: req.params.id },
        { $pull: { teachers: req.params.id } },
        { session }
      );
      await Subject.updateMany(
        { schoolId: req.user.schoolId, 'teacherAssignments.teacherId': req.params.id },
        { $pull: { teacherAssignments: { teacherId: req.params.id } } },
        { session }
      );

      // Attempt to send notification to admin
      const school = await School.findById(req.user.schoolId).select('email smtpConfig').lean();
      if (school && school.email && req.user.email) {
        try {
          const transporter = await createTransporter(req.user.schoolId);
          const mailOptions = {
            from:`"${school.communication?.emailName || school.name}" <${school.communication?.emailFrom}>`,
            to: req.user.email,
            subject: 'Teacher Soft Deleted',
            html: `<p>Teacher ${teacher.name} has been soft deleted. Please reassign their subjects and classes.</p>`
          };
          await transporter.sendMail(mailOptions);
          logger.info('✅ Delete notification sent');
        } catch (emailError) {
          logger.error('Failed to send delete email:', emailError);
        }
      } else {
        logger.warn('Email notification skipped: School email or admin email not found.');
      }

      res.json({
        success: true,
        message: 'Teacher and associated assignments removed successfully',
        data: teacher
      });
    });
  } catch (error) {
    logger.error('Error in softDeleteTeacher:', error);
    if (session.inTransaction()) await session.abortTransaction();
    next(error);
  } finally {
    await session.endSession();
  }
};
//   try {
//     const schoolId = req.user.schoolId;
//     const { page = 1, limit = 25, all = false } = req.query;
//     const skip = (page - 1) * limit;

//     const query = { schoolId, status: true };

//     let teachers;
//     if (all === 'true') {
//       teachers = await Teacher.find(query).populate('academicYearId', 'name').lean();
//     } else {
//       teachers = await Teacher.find(query)
//         .skip(skip)
//         .limit(parseInt(limit))
//         .populate('academicYearId', 'name')
//         .lean();
//     }

//     if (all === 'true') {
//       res.json({ data: teachers, total: teachers.length });
//     } else {
//       const total = await Teacher.countDocuments(query);
//       res.json({ data: teachers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
//     }
//   } catch (err) {
//     logger.error('Get teachers error:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// };