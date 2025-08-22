const jwt = require('jsonwebtoken');
const User = require('../models/user');
const School = require('../models/school');
const Subscription = require('../models/subscription');

const authMiddleware = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Server configuration error: Missing JWT_SECRET' });
    }

    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized. User not found.' });
    }

    let school = null;
    let subscription = null;
    if (user.role !== 'superadmin') {
      subscription = await Subscription.findOne({
        schoolId: user.schoolId,
        status: { $in: ['active', 'pending'] }
      }).lean();

      if (!subscription || (subscription.status === 'active' && subscription.expiresAt < new Date())) {
        if (subscription && subscription.expiresAt < new Date()) {
          await Subscription.updateOne(
            { _id: subscription._id },
            { status: 'expired', updatedAt: new Date() }
          );
          subscription = subscription ? { ...subscription, status: 'expired' } : null;
        }
        if (req.method !== 'GET') {
          return res.status(403).json({
            message: subscription?.status === 'pending'
              ? 'Subscription payment pending verification. Only viewing is allowed.'
              : 'Subscription expired. Only viewing is allowed. Please upgrade your plan.'
          });
        }
      }

      school = await School.findById(user.schoolId).select('activeAcademicYear weeklyHolidayDay').lean();
      if (!school || !school.activeAcademicYear) {
        return res.status(400).json({ message: 'No active academic year set for this school' });
      }
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      schoolId: user.schoolId?.toString(),
      activeAcademicYear: user.role !== 'superadmin' && school ? school.activeAcademicYear.toString() : null,
      subscriptionStatus: user.role === 'superadmin' ? 'unlimited' : subscription?.status || 'none'
    };
    next();
  } catch (err) {
    console.error('Auth Error:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token. Access denied.' });
    }
    res.status(500).json({ message: 'Server error. Authentication failed.', error: err.message });
  }
};

module.exports = authMiddleware;