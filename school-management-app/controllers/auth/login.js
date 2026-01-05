const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/user');  // School-only User model (no superadmin)
const Teacher = require('../../models/teacher');
const AcademicYear = require('../../models/academicyear');
const { decryptPassword } = require('../../utils/cryptoUtils');
const { logLoginAttempt } = require('../../utils/loginLogger');

const login = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    if ((!username && !email) || !password) {
      return res.status(400).json({ message: 'Username/Email and password are required' });
    }

    const query = {
      $or: [
        { username: username || '' },
        { email: email || '' }
      ]
    };
    const user = await User.findOne(query);
    if (!user) {
      await logLoginAttempt(req, null, 'failed', 'User not found');
      return res.status(401).json({ message: 'Invalid username/email or password' });
    }

    // Fail if no schoolId (enforce school context)
    if (!user.schoolId) {
      await logLoginAttempt(req, user, 'failed', 'No school assigned');
      return res.status(403).json({ message: 'User not associated with a school' });
    }

    let isPasswordValid = false;
    
    // Handle password validation based on role (school roles only)
    if (['admin', 'teacher'].includes(user.role)) {
      // Hashed password for admin/teacher
      isPasswordValid = bcrypt.compareSync(password, user.password);
    } else if (['parent', 'student'].includes(user.role)) {
      // Encrypted password for parent/student
      console.log('Decrypting password for role:', user.role);
      const decryptedStoredPassword = decryptPassword(user.password);
      if (decryptedStoredPassword === null) {
        return res.status(500).json({ message: 'Error decrypting password' });
      }
      isPasswordValid = password === decryptedStoredPassword;
    } else {
      // Unknown role - fail safely
      return res.status(400).json({ message: 'Invalid user role' });
    }

    if (!isPasswordValid) {
      await logLoginAttempt(req, user, 'failed', 'Wrong password');
      return res.status(401).json({ message: 'Invalid username/email or password' });
    }

    let teacherId = null;
    if (user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: user._id });
      if (!teacher) {
        return res.status(400).json({ message: 'Teacher profile not found for this user' });
      }
      if (!teacher.status) {
        return res.status(403).json({ message: 'You are not part of the school' });
      }
      teacherId = teacher._id.toString();
    }

    // Extract studentId from user.additionalInfo
    let studentId = null;
    if (user.role === 'student') {
      if (!user.additionalInfo || !user.additionalInfo.studentId) {
        return res.status(400).json({ message: 'Student profile not linked to this user' });
      }
      studentId = user.additionalInfo.studentId.toString();
    }

    // Always fetch active academic year for school users
    const activeAcademicYear = await AcademicYear.findOne({
      schoolId: user.schoolId,
      isActive: true
    });
    if (!activeAcademicYear) {
      return res.status(400).json({ message: 'No active academic year found for your school' });
    }
    const activeAcademicYearId = activeAcademicYear._id.toString();

    // Add additionalInfo to JWT payload
    const additionalInfo = {};
    if (user.role === 'student' && studentId) {
      additionalInfo.studentId = studentId;
    }
    if (user.role === 'teacher' && teacherId) {
      additionalInfo.teacherId = teacherId;
    }

    const token = jwt.sign(
      { 
        userId: user._id, 
        role: user.role, 
        schoolId: user.schoolId,
        additionalInfo  // For req.user.additionalInfo in controllers
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    await logLoginAttempt(req, user, 'success');
    res.json({
      token,
      role: user.role,
      userId: user._id.toString(),
      schoolId: user.schoolId.toString(),
      teacherId: (user.role === 'teacher' && teacherId) ? teacherId : null,
      studentId: (user.role === 'student' && studentId) ? studentId : null,
      email: user.email,
      activeAcademicYearId
    });
  } catch (err) {
    console.error('Login error:', err.stack);
    res.status(500).json({ message: 'Error logging in', error: err.message });
  }
};

module.exports = login;