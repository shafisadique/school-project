const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const SuperUser = require('../../models/superuser');  // Your SuperUser model

const superadminLogin = async (req, res) => {
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
    const superUser = await SuperUser.findOne(query);
    if (!superUser) {
      return res.status(401).json({ message: 'Invalid username/email or password' });
    }

    // Bcrypt only for superadmin
    const isPasswordValid = await superUser.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username/email or password' });
    }

    // No school/teacher/student logic—just basics
    const token = jwt.sign(
      { 
        userId: superUser._id, 
        role: superUser.role,  // 'superadmin'
        schoolId: null,
        isSuperAdmin: true  // Flag for guards
      },
      process.env.JWT_SECRET_SUPER,  // Separate secret
      { expiresIn: '1h' }
    );

    res.json({
      token,
      role: superUser.role,
      userId: superUser._id.toString(),
      schoolId: null,
      email: superUser.email
      // No academicYear, teacherId, etc.
    });
  } catch (err) {
    console.error('Superadmin login error:', err.stack);
    res.status(500).json({ message: 'Error logging in', error: err.message });
  }
};

module.exports = superadminLogin;