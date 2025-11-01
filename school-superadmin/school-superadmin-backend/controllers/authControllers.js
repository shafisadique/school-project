const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.login = async (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', { email }); // Temp: See incoming email

  try {
    const user = await User.findOne({ email });
    console.log('User found:', !!user, user ? user.email : 'null'); // Temp: Check if found

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await user.comparePassword(password);
    console.log('Password match:', match); // Temp: Check hash

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, email } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};