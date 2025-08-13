const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Teacher = require('../../models/teacher');
const User = require('../../models/user');
const School = require('../../models/school');
const { createUploadMiddleware } = require('../../utils/fileUploader');
const APIError = require('../../utils/apiError');
const nodemailer = require('nodemailer');
const Class = require('../../models/class');
const Subject = require('../../models/subject');
// Constants
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_FILE_TYPES = ['image/png', 'image/jpg', 'image/jpeg'];

// File Upload Configuration
exports.upload = createUploadMiddleware(
  'teachers',
  MAX_FILE_SIZE,  
  ALLOWED_FILE_TYPES
);

// Helper Functions
  async function validateTeacherInput(reqBody, isUpdate = false) {
    const { subjects, ...rest } = reqBody;
    const data = {
      ...rest,
      subjects: Array.isArray(subjects) ? subjects : JSON.parse(subjects || '[]')
    };
    if (!isUpdate && (!data.email || !data.name || !data.username || !data.password)) {
      throw new APIError('Name, username, email, and password are required', 400);
    }
    return data;
  }

  async function getActiveAcademicYearId(schoolId) {
    const school = await School.findById(schoolId).select('activeAcademicYear').lean().orFail(new APIError('School not found', 404));
    if (!school.activeAcademicYear) throw new APIError('No active academic year set', 400);
    return school.activeAcademicYear;
  }


  async function createTransporter(schoolId) {
    const school = await School.findById(schoolId).select('smtpConfig email').lean();
    if (!school) throw new APIError('School not found', 404);

    const smtpConfig = school.smtpConfig || {};
    const email = school.email;

    // Fallback to environment variables if smtpConfig is incomplete
    if (!smtpConfig.auth?.user || !smtpConfig.auth?.pass) {
      return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER, // shafisadique123@gmail.com
          pass: process.env.EMAIL_PASS  // Your App Password
        },
        tls: {
          rejectUnauthorized: false // Development only
        }
      });
    }

    return nodemailer.createTransport({
      host: smtpConfig.host || 'smtp.gmail.com',
      port: smtpConfig.port || 465,
      secure: smtpConfig.secure !== false,
      auth: {
        user: smtpConfig.auth.user,
        pass: smtpConfig.auth.pass
      },
      tls: {
        rejectUnauthorized: false // Development only
      }
    });
  }

/**
 * @desc    Create a new teacher
 * @route   POST /api/teachers/add
 * @access  Private/Admin
 */
  exports.addTeacher = async (req, res, next) => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const { schoolId } = req.user;
        const teacherData = await validateTeacherInput(req.body);

        const existingUser = await User.findOne({
          $or: [{ email: teacherData.email }, { username: teacherData.username }]
        }).session(session);
        if (existingUser) throw new APIError('User with this email or username already exists', 409);

        const hashedPassword = bcrypt.hashSync(teacherData.password, 10);
        const newUser = new User({
          name: teacherData.name,
          username: teacherData.username,
          email: teacherData.email,
          password: hashedPassword,
          role: 'teacher',
          schoolId
        });
        await newUser.save({ session });

        const teacher = await Teacher.create([{
          userId: newUser._id,
          name: teacherData.name,
          email: teacherData.email,
          phone: teacherData.phone,
          designation: teacherData.designation,
          gender: teacherData.gender,
          subjects: teacherData.subjects,
          schoolId,
          academicYearId: await getActiveAcademicYearId(schoolId),
          createdBy: req.user.id,
          profileImage: req.file?.path.replace(/\\/g, '/').split('uploads/')[1] || ''
        }], { session });

        const school = await School.findById(schoolId).select('email').lean().orFail(new APIError('School not found', 404));
        const schoolEmail = school.email;

        const transporter = await createTransporter(schoolId);
        const mailOptions = {
          from: schoolEmail,
          to: teacherData.email,
          subject: 'Welcome to Our School!',
          html: `
            <h1>Welcome, ${teacherData.name}!</h1>
            <p>You have been successfully added as a teacher at our school. We are thrilled to have you on board!</p>
            <p>Your password is: <strong>${teacherData.password}</strong> (Please change it after logging in for security.)</p>
            <p>Best regards,<br>The ${schoolEmail} Team</p>
          `
        };

        await transporter.sendMail(mailOptions);

        res.status(201).json({
          success: true,
          message: 'Teacher added successfully and email sent',
          data: teacher[0],
          userId: newUser._id
        });
      });
    } catch (error) {
      console.error('Error in addTeacher:', error);
      next(error);
    } finally {
      await session.endSession();
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
      .populate('academicYear', 'year')
      .lean();

      res.json({
        success: true,
        count: teachers.length,
        data: teachers
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
  // exports.getTeacher = async (req, res, next) => {
  //   try {
  //     const teacher = await Teacher.findOne({
  //       _id: req.params.id,
  //       schoolId: req.user.schoolId
  //     }).orFail(new APIError('Teacher not found', 404));

  //     res.json({
  //       success: true,
  //       data: teacher
  //     });
  //   } catch (error) {
  //     next(error);
  //   }
  // };


  exports.getTeacher = async (req, res, next) => {
  try {
    const teacher = await Teacher.findOne({
      _id: req.params.id,
      schoolId: req.user.schoolId
    }).orFail(new APIError('Teacher not found', 404));

    res.json({
      success: true,
      data: teacher
    });
  } catch (error) {
    next(error);
  }
};
/**
 * @desc    Update teacher
 * @route   PUT /api/teachers/:id
 * @access  Private/Admin
 */
  exports.updateTeacher = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { schoolId } = req.user;
      const teacherData = await validateTeacherInput(req.body, true);
      if (req.user.role !== 'admin') {
        throw new APIError('Unauthorized: Only admins can update teacher details', 403);
      }

      const { email, ...updateData } = teacherData; // Extract email for separate handling

      const teacher = await Teacher.findOne({ _id: req.params.id, schoolId })
        .session(session)
        .orFail(new APIError('Teacher not found', 404));

      // Check if email is changing and validate uniqueness
      if (email && email !== teacher.email) {
        const existingUser = await User.findOne({ email }).session(session);
        if (existingUser && existingUser._id.toString() !== teacher.userId.toString()) {
          throw new APIError('Email already in use by another user', 409);
        }
        await User.findOneAndUpdate(
          { _id: teacher.userId },
          { email },
          { session }
        );
        await Teacher.findOneAndUpdate(
          { _id: req.params.id, schoolId },
          { email, ...updateData, profileImage: req.file?.path.replace(/\\/g, '/').split('uploads/')[1] || teacher.profileImage },
          { new: true, runValidators: true, session }
        );
      } else {
        await Teacher.findOneAndUpdate(
          { _id: req.params.id, schoolId },
          { ...updateData, profileImage: req.file?.path.replace(/\\/g, '/').split('uploads/')[1] || teacher.profileImage },
          { new: true, runValidators: true, session }
        );
      }

      // Notify the teacher
      const transporter = await createTransporter(schoolId);
      const school = await School.findById(schoolId).select('email').lean();
      const mailOptions = {
        from: school.email,
        to: email, // New email
        cc: teacher.email, // Old email for notification
        subject: 'Email Update Notification',
        html: `
          <h1>Email Update</h1>
          <p>Your email has been updated to <strong>${email}</strong>. If you did not request this change, please contact your admin immediately.</p>
          <p>Best regards,<br>The ${school.email} Team</p>
        `
      };
      await transporter.sendMail(mailOptions);

      res.json({
        success: true,
        message: 'Teacher updated successfully',
        data: teacher
      });
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};


/**
 * @desc    Upload teacher profile image
 * @route   PUT /api/teachers/:id/photo
 * @access  Private/Admin
 */
  exports.uploadTeacherPhoto = async (req, res, next) => {
    try {
      if (!req.file) {
        throw new APIError('Please upload a file', 400);
      }

      const teacher = await Teacher.findOneAndUpdate(
        { _id: req.params.id, schoolId: req.user.schoolId },
        { profileImage: req.file.path.replace(/\\/g, '/').split('uploads/')[1] },
        { new: true }
      ).orFail(new APIError('Teacher not found', 404));

      res.json({
        success: true,
        data: teacher.profileImage
      });
    } catch (error) {
      next(error);
    }
  };


/**
 * @desc    Soft delete teacher
 * @route   DELETE /api/teachers/:id
 * @access  Private/Admin
 */ 

exports.softDeleteTeacher = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
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

      // Send notification to admin (if email is available)
      const adminEmail = req.user.email;
      if (adminEmail) {
        const school = await School.findById(req.user.schoolId).select('email smtpConfig').lean();
        if (school && school.email) {
          const transporter = await createTransporter(req.user.schoolId);
          const mailOptions = {
            from: school.email,
            to: adminEmail,
            subject: 'Teacher Soft Deleted',
            html: `<p>Teacher ${teacher.name} has been soft deleted. Please reassign their subjects and classes.</p>`
          };
          await transporter.sendMail(mailOptions);
        }
      }

      res.json({
        success: true,
        message: 'Teacher and associated assignments removed successfully',
        data: teacher
      });
    });
  } catch (error) {
    console.error('Error in softDeleteTeacher:', error);
    next(error);
  } finally {
    await session.endSession();
  }
};


exports.updateTeacher = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { schoolId } = req.user;
      const teacherData = await validateTeacherInput(req.body, true);

      const teacher = await Teacher.findOneAndUpdate(
        { _id: req.params.id, schoolId },
        { ...teacherData, profileImage: req.file?.path.replace(/\\/g, '/').split('uploads/')[1] || teacherData.profileImage },
        { new: true, runValidators: true, session }
      ).orFail(new APIError('Teacher not found', 404));

      res.json({
        success: true,
        message: 'Teacher updated successfully',
        data: teacher
      });
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

// controllers/teacher/teacherController.js
/**
 * @desc    Soft delete a teacher and clean up related assignments
 * @route   DELETE /api/teachers/:id
 * @access  Private/Admin
 */
  exports.softDeleteTeacher = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const teacher = await Teacher.findOne({
        _id: req.params.id,
        schoolId: req.user.schoolId
      })
        .session(session)
        .orFail(new APIError('Teacher not found', 404));

      // Validate admin email
      if (!req.user.id) {
        throw new APIError('Admin email is not defined. Contact support to configure your account.', 400);
      }

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
      if (school && school.email) {
        try {
          const transporter = await createTransporter(req.user.schoolId);
          const mailOptions = {
            from: school.email,
            to: req.user.email,
            subject: 'Teacher Soft Deleted',
            html: `<p>Teacher ${teacher.name} has been soft deleted. Please reassign their subjects and classes.</p>`
          };
          await transporter.sendMail(mailOptions);
        } catch (emailError) {
          console.error('Failed to send email notification:', emailError);
          // Log the error but allow deletion to proceed
        }
      } else {
        console.warn('Email notification skipped: School email or SMTP config not found.');
      }

      res.json({
        success: true,
        message: 'Teacher and associated assignments removed successfully',
        data: teacher
      });
    });
  } catch (error) {
    console.error('Error in softDeleteTeacher:', error);
    next(error);
  } finally {
    await session.endSession();
  }
};