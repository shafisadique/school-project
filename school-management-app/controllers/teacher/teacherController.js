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
exports.addTeacher = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const schoolId = req.user.schoolId;

      // CRITICAL FIX: Use .lean() here so communication fields are real objects
      const school = await School.findById(schoolId)
        .select('name email mobileNo communication activeAcademicYear')
        .populate('activeAcademicYear')
        .lean()                    // ADD THIS LINE
        .session(session);

      if (!school) throw new Error('School not found');
      if (!school.activeAcademicYear) throw new Error('No active academic year set');

      const academicYearId = school.activeAcademicYear._id;

      // 2. Validate input
      const { name, username, email, phone, designation, subjects, gender } = req.body;
      if (!name || !username || !email || !phone || !subjects || !designation) {
        throw new Error('All fields required');
      }

      // 3. Check duplicate
      const existing = await User.findOne({
        $or: [{ email }, { username }],
        schoolId
      }).session(session);
      if (existing) throw new Error('Email or username already exists');

      // 4. Generate password
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';

      // 5. Create User
      const newUser = new User({
        name,
        username,
        email,
        password: bcrypt.hashSync(tempPassword, 10),
        role: 'teacher',
        schoolId,
        phoneNumber: phone
      });
      await newUser.save({ session });

      // 6. Upload photo
      let profileImageKey = '';
      if (req.file) {
        const fileName = `teachers/${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        await s3Client.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: fileName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype
        }));
        profileImageKey = fileName;
      }

      // 7. Create Teacher
      const teacher = new Teacher({
        userId: newUser._id,
        name,
        email,
        phone,
        designation,
        subjects: Array.isArray(subjects) ? subjects : JSON.parse(subjects || '[]'),
        gender,
        schoolId,
        academicYearId,
        profileImage: profileImageKey,
        status: true,
        createdBy: req.user.id
      });
      await teacher.save({ session });

      // 8. SEND EMAIL — NOW 100% FROM SCHOOL EMAIL
      try {
        const transporter = await createTransporter(schoolId);

        // These will NOW be defined because of .lean()
        const fromName = school.communication?.emailName || school.name;
        const fromEmail = school.communication?.emailFrom;

        if (!fromEmail) {
          logger.warn('School email not configured, skipping email');
        } else {
          const mailOptions = {
            from: `"${fromName}" <${fromEmail}>`,
            to: email,
            subject: `Welcome to ${school.name}!`,
            html: `
              <h2>Welcome ${name}!</h2>
              <p>You have been added as a teacher at <strong>${school.name}</strong>.</p>
              <p><strong>Login Details:</strong><br>
              Username: ${username}<br>
              Password: ${tempPassword}</p>
              <p>Please change your password after first login.</p>
              <p>Best regards,<br>${school.name} Team</p>
            `
          };

          await transporter.sendMail(mailOptions);
          logger.info(`Welcome email sent from ${fromEmail} to ${email}`);
        }
      } catch (err) {
        logger.error('Email failed in addTeacher:', err.message);
        // Don't fail the whole request
      }

      // 9. SEND NOTIFICATION
      const notification = await createWelcomeNotification(
        { name, username, email, phone, password: tempPassword },
        school,
        newUser._id,
        session,
        req.user.id
      );
      await deliver(notification, session);

      res.status(201).json({
        success: true,
        message: 'Teacher added successfully!',
        data: {
          teacherId: teacher._id,
          username,
          temporaryPassword: tempPassword
        }
      });
    });
  } catch (err) {
    logger.error('Add teacher error:', err);
    next(err);
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
exports.updateTeacher = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { schoolId } = req.user;
      if (req.user.role !== 'admin') {
        throw new APIError('Unauthorized: Only admins can update teacher details', 403);
      }

      const teacherData = await validateTeacherInput(req.body, true);
      const teacher = await Teacher.findOne({ _id: req.params.id, schoolId })
        .session(session)
        .orFail(new APIError('Teacher not found', 404));

      // Track changes for notifications
      const changes = { email: false, other: false };
      let email = teacherData.email || teacher.email;
      if (email && email !== teacher.email) {
        changes.email = true;
        const existingUser = await User.findOne({ email }).session(session);
        if (existingUser && existingUser._id.toString() !== teacher.userId.toString()) {
          throw new APIError('Email already in use by another user', 409);
        }
        await User.findOneAndUpdate({ _id: teacher.userId }, { email }, { session });
      }

      // Handle password if provided
      if (teacherData.password) {
        const hashedPassword = bcrypt.hashSync(teacherData.password, 10);
        await User.findOneAndUpdate({ _id: teacher.userId }, { password: hashedPassword }, { session });
      }

      // Any other field change triggers "other" notification
      if (teacherData.name !== teacher.name || teacherData.phone !== teacher.phone || 
          JSON.stringify(teacherData.subjects) !== JSON.stringify(teacher.subjects) || 
          teacherData.designation !== teacher.designation) {
        changes.other = true;
      }

      // Handle profile image: Store KEY only
      let profileImageKey = teacher.profileImage;
      if (req.file) {
        const fileBuffer = req.file.buffer;
        const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const params = {
          Bucket: process.env.R2_BUCKET_NAME,
          Key: `teachers/${fileName}`,
          Body: fileBuffer,
          ContentType: req.file.mimetype,
        };
        const command = new PutObjectCommand(params);
        await s3Client.send(command);
        profileImageKey = `teachers/${fileName}`;
      }

      // Update teacher (exclude password)
      const { password: _, ...updateData } = teacherData;
      const updatedTeacher = await Teacher.findByIdAndUpdate(
        req.params.id,
        {
          ...updateData,
          email,
          profileImage: profileImageKey,
        },
        { new: true, runValidators: true, session }
      ).orFail(new APIError('Failed to update teacher', 500));

      // Send notification only if changes
      if (changes.email || changes.other) {
        const school = await School.findById(schoolId).select('name email mobileNo').session(session);
        const transporter = await createTransporter(schoolId);
        const mailOptions = {
          from: `"${school.communication?.emailName || school.name}" <${school.communication?.emailFrom}>`,
          to: email,
          subject: 'Profile Updated',
          html: `
            <h1>Profile Update Notification</h1>
            ${changes.email ? `<p>Your email has been updated to <strong>${email}</strong>.</p>` : ''}
            ${changes.other ? `<p>Your details (name, phone, subjects, or designation) have been updated.</p>` : ''}
            <p>If you did not request this, contact ${school.name} immediately.</p>
            <p>School Contact: ${school.mobileNo} | ${school.email}</p>
            <p>Best,<br>The ${school.name} Team</p>
          `,
        };
        try {
          await transporter.sendMail(mailOptions);
          logger.info('✅ Update notification sent');
        } catch (emailError) {
          logger.error('❌ Update notification failed:', emailError);
        }
      }

      // Enrich with proxy URL
      const base = `${req.protocol}://${req.get('host')}`;
      const key = toR2Key(updatedTeacher.profileImage);
      const profileImageUrl = key ? `${base}/api/proxy-image/${encodeURIComponent(key)}` : '';

      res.json({
        success: true,
        message: 'Teacher updated successfully',
        data: {
          ...updatedTeacher.toObject(),
          profileImageUrl,
        },
      });
    });
  } catch (error) {
    logger.error('Error in updateTeacher:', error);
    if (session.inTransaction()) await session.abortTransaction();
    next(error);
  } finally {
    await session.endSession();
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