const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/user');

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

    // Generate a JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role,schoolId: user.schoolId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    console.log(user._id)
    // Send the token and user role in the response
    res.json({ token, role: user.role, schoolId: user.schoolId ,userId: user._id });
  } catch (err) {
    res.status(500).json({ message: 'Error logging in', error: err.message });
  }
};

module.exports = login;