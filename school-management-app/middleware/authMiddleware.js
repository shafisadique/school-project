// middleware/authMiddleware.js — FINAL 100% WORKING VERSION

const jwt = require('jsonwebtoken');
const User = require('../models/user');
const School = require('../models/school');
const Subscription = require('../models/subscription');

const authMiddleware = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Server error: Missing JWT_SECRET' });
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

    // === WHITELIST: Allow these routes even if subscription expired or pending ===
    const WHITELIST_ROUTES = [
      '/api/subscriptions/upgrade',
      '/api/subscriptions/verify-payment',
      '/api/subscriptions/webhook',
      '/api/subscriptions/plans',
      '/api/subscriptions/current'
    ];

    const isWhitelisted = WHITELIST_ROUTES.some(route => req.originalUrl.startsWith(route));
    const isReadOnly = ['GET', 'OPTIONS', 'HEAD'].includes(req.method);

    let subscription = null;
    let school = null;

    if (user.role !== 'superadmin') {
      // Find the latest subscription (active, pending, expired)
      subscription = await Subscription.findOne({
        schoolId: user.schoolId
      }).sort({ createdAt: -1 }).lean();

      // Auto-update status if needed
      const now = new Date();
      if (subscription) {
        if (subscription.status === 'active' && subscription.expiresAt < now) {
          subscription.status = 'grace_period';
          subscription.gracePeriodEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          await Subscription.updateOne({ _id: subscription._id }, {
            status: 'grace_period',
            gracePeriodEnds: subscription.gracePeriodEnds
          });
        } else if (subscription.status === 'grace_period' && subscription.gracePeriodEnds < now) {
          subscription.status = 'expired';
          await Subscription.updateOne({ _id: subscription._id }, { status: 'expired' });
        }
      }

      // BLOCK only if: not read-only AND not whitelisted AND (expired or pending)
      if (subscription && ['expired', 'pending'].includes(subscription.status)) {
        if (!isReadOnly && !isWhitelisted) {
          return res.status(403).json({
            message: subscription.status === 'expired'
              ? 'Subscription expired. Please renew your plan.'
              : 'Payment pending verification. Only viewing allowed.',
            code: subscription.status === 'expired' ? 'SUBSCRIPTION_EXPIRED' : 'PAYMENT_PENDING'
          });
        }
      }

      // Load school
      school = await School.findById(user.schoolId).select('activeAcademicYear');
      if (!school?.activeAcademicYear) {
        return res.status(400).json({ message: 'No active academic year set' });
      }
    }

    // Attach cleaned user to request
    req.user = {
      id: user._id.toString(),
      role: user.role,
      schoolId: user.schoolId?.toString(),
      activeAcademicYear: user.role !== 'superadmin' ? school?.activeAcademicYear.toString() : null,
      subscriptionStatus: user.role === 'superadmin' ? 'unlimited' : (subscription?.status || 'none'),
      ...(user.role === 'teacher' && { teacherId: decoded.additionalInfo?.teacherId }),
      ...(['parent', 'student'].includes(user.role) && { additionalInfo: user.additionalInfo || {} })
    };

    next();

  } catch (err) {
    console.error('Auth error:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please login again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    res.status(500).json({ message: 'Authentication failed' });
  }
};

module.exports = authMiddleware;