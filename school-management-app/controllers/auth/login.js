const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/user');
const Teacher = require('../../models/teacher');
const AcademicYear = require('../../models/academicyear');

const login = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    if ((!username && !email) || !password) {
      return res.status(400).json({ message: 'Username/Email and password are required' });
    }

    const user = await User.findOne({
      $or: [{ username }, { email }]
    });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username/email or password' });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password);
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