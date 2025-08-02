const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Teacher = require('../../models/teacher');
const User = require('../../models/user');
const School = require('../../models/school');
const { createUploadMiddleware } = require('../../utils/fileUploader');
const APIError = require('../../utils/apiError');
const nodemailer = require('nodemailer');
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

// Configure nodemailer transporter (generic setup, will use school email)
const transporter = nodemailer.createTransport({
  service: 'gmail', // Can be adjusted based on school's email provider
  auth: {
    user: 'default-email@gmail.com', // Fallback email for authentication
    pass: 'default-email-password' // Fallback password or app-specific password
  }
});




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

      // Fetch school's email
      const school = await School.findById(schoolId).select('email').lean().orFail(new APIError('School not found', 404));
      const schoolEmail = school.email;

      // Send welcome email using school's email
      const mailOptions = {
        from: schoolEmail, // Use school's email as the sender
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
  try {
    const updates = await validateTeacherInput(req.body, true);
    const teacher = await Teacher.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.user.schoolId },
      updates,
      { new: true, runValidators: true }
    ).orFail(new APIError('Teacher not found', 404));

    res.json({
      success: true,
      data: teacher
    });
  } catch (error) {
    next(error);
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
  try {
    const teacher = await Teacher.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.user.schoolId },
      { status: false },
      { new: true }
    ).orFail(new APIError('Teacher not found', 404));

    res.json({
      success: true,
      data: teacher
    });
  } catch (error) {
    next(error);
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

// Soft Delete Teacher (Set status to false)
exports.softDeleteTeacher = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const teacher = await Teacher.findOneAndUpdate(
        { _id: req.params.id, schoolId: req.user.schoolId },
        { status: false },
        { new: true, session }
      ).orFail(new APIError('Teacher not found', 404));

      res.json({
        success: true,
        message: 'Teacher soft deleted successfully',
        data: teacher
      });
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};