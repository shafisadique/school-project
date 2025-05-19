const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/user');
const Teacher = require('../../models/teacher');
const AcademicYear = require('../../models/academicyear');

const login = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check if username/email and password are provided
    if ((!username && !email) || !password) {
      return res.status(400).json({ message: 'Username/Email and password are required' });
    }

    // Find the user by username or email
    const user = await User.findOne({
      $or: [{ username }, { email }]
    });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username/email or password' });
    }

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username/email or password' });
    }

    // If the user is a teacher, fetch their teacherId
    let teacherId = null;
    if (user.role === 'teacher') {
      const teacher = await Teacher.findOne({ userId: user._id });
      if (teacher) {
        teacherId = teacher._id.toString();
      } else {
        return res.status(400).json({ message: 'Teacher profile not found for this user' });
      }
    }

    // Find the active academic year for the user's school
    const activeAcademicYear = await AcademicYear.findOne({
      schoolId: user.schoolId,
      isActive: true
    });
    if (!activeAcademicYear) {
      return res.status(400).json({ message: 'No active academic year found for your school' });
    }

    // Generate a JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role, schoolId: user.schoolId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Send the token, user role, teacherId (if applicable), and activeAcademicYearId in the response
    res.json({
      token,
      role: user.role,
      schoolId: user.schoolId.toString(),
      userId: user._id.toString(),
      teacherId, // Include teacherId for teachers
      activeAcademicYearId: activeAcademicYear._id.toString()
    });
  } catch (err) {
    res.status(500).json({ message: 'Error logging in', error: err.message });
  }
};

module.exports = login;