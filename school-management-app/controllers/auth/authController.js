const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/user');
const Teacher = require('../../models/teacher');
const AcademicYear = require('../../models/academicyear');

// Encryption configuration (must match createStudentPortal)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f123';
const IV_LENGTH = 16;

// Function to decrypt password
const decryptPassword = (encryptedText) => {
  try {
    if (!encryptedText || typeof encryptedText !== 'string') return null;
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted || ivHex.length !== 32) return null;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return null;
  }
};

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
    if (user.role === 'student' || user.role === 'parent') {
      const decryptedPassword = decryptPassword(user.password);
      isPasswordValid = decryptedPassword === password;
    } else {
      isPasswordValid = bcrypt.compareSync(password, user.password);
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

    const token = jwt.sign(
      { userId: user._id, role: user.role, schoolId: user.schoolId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      role: user.role,
      userId: user._id.toString(),
      schoolId: user.schoolId ? user.schoolId.toString() : null,
      teacherId: (user.role === 'teacher' && teacherId) ? teacherId : null,
      email: user.email,
      activeAcademicYearId: (user.role !== 'superadmin' && user.schoolId && activeAcademicYearId) ? activeAcademicYearId : null
    });
  } catch (err) {
    console.error('Login error:', err.stack);
    res.status(500).json({ message: 'Error logging in', error: err.message });
  }
};

module.exports = login;