const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/user');
const Teacher = require('../../models/teacher');
const AcademicYear = require('../../models/academicyear');
const { decryptPassword } = require('../../utils/cryptoUtils');

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
      return res.status(401).json({ message: 'Invalid username/email or password' });
    }

    let isPasswordValid = false;
    
    // Handle password validation based on role
    if (['admin', 'teacher', 'superadmin'].includes(user.role)) {
      // Hashed password for admin/teacher/superadmin
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

    // UPDATED: Extract studentId from user.additionalInfo (no query needed)
    let studentId = null;
    if (user.role === 'student') {
      if (!user.additionalInfo || !user.additionalInfo.studentId) {
        return res.status(400).json({ message: 'Student profile not linked to this user' });
      }
      studentId = user.additionalInfo.studentId.toString();
    }

    let activeAcademicYearId = null;
    if (user.role !== 'superadmin' && user.schoolId) {
      const activeAcademicYear = await AcademicYear.findOne({
        schoolId: user.schoolId,
        isActive: true
      });
      if (!activeAcademicYear) {
        return res.status(400).json({ message: 'No active academic year found for your school' });
      }
      activeAcademicYearId = activeAcademicYear._id.toString();
    }

    // UPDATED: Add additionalInfo to JWT payload (includes studentId for req.user)
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
        additionalInfo  // Enables req.user.additionalInfo.studentId in controllers
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      role: user.role,
      userId: user._id.toString(),
      schoolId: user.schoolId ? user.schoolId.toString() : null,
      teacherId: (user.role === 'teacher' && teacherId) ? teacherId : null,
      studentId: (user.role === 'student' && studentId) ? studentId : null,  // From additionalInfo
      email: user.email,
      activeAcademicYearId: (user.role !== 'superadmin' && user.schoolId && activeAcademicYearId) ? activeAcademicYearId : null
    });
  } catch (err) {
    console.error('Login error:', err.stack);
    res.status(500).json({ message: 'Error logging in', error: err.message });
  }
};

module.exports = login;