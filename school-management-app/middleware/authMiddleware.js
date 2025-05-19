const jwt = require('jsonwebtoken');
const User = require('../models/user');
const School = require('../models/school');

const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from DB (without password)
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized. User not found.' });
    }

    // Fetch the active academic year from the School model
    const school = await School.findById(user.schoolId).select('activeAcademicYear');
    if (!school || !school.activeAcademicYear) {
      return res.status(400).json({ message: 'No active academic year set for this school' });
    }

    // Attach user data to request
    req.user = {
      id: user._id.toString(),
      role: user.role,
      schoolId: user.schoolId?.toString(),
      activeAcademicYear: school.activeAcademicYear.toString()
    };

    console.log('req.user set in authMiddleware:', req.user);

    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    console.error('Auth Error:', err.message);

    // Handle specific JWT errors
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token. Access denied.' });
    }

    res.status(500).json({ message: 'Server error. Authentication failed.' });
  }
};

module.exports = authMiddleware;