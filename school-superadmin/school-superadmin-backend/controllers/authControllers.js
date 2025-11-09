const jwt = require('jsonwebtoken');
const User = require('../models/superuser');  // Confirm path: If models/superuser.js, this is ok

exports.login = async (req, res) => {
  const { email, username, password } = req.body;  // Add username support

  try {
    // Validate input
    if (!password ||  (!email && !username)) {
      return res.status(400).json({ error: 'Email/Username and password required' });
    }

    // Query by email OR username
    const query = email ? { email } : { username };

    const user = await User.findOne(query);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await user.comparePassword(password);
    console.log('Password match:', match);  // Temp

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Fix: Use JWT_SECRET_SUPER from .env
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET_SUPER, { expiresIn: '7d' });

    res.json({ token, user: { id: user._id, email: user.email, username: user.username, role: user.role } });
  } catch (error) {
    console.error('Login error details:', error.message, error.stack);  // Better error log
    res.status(500).json({ error: 'Login failed' });
  }
};