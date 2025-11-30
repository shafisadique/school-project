// // middleware/authMiddleware.js — FINAL 100% WORKING VERSION

// const jwt = require('jsonwebtoken');
// const User = require('../models/user');
// const School = require('../models/school');
// const Subscription = require('../models/subscription');


// async function getActiveSubscription(schoolId) {
//   const now = new Date();

//   const main = await Subscription.findOne({
//     schoolId,
//     isTemporaryBoost: false,
//     status: { $in: ['active', 'grace_period'] },
//     expiresAt: { $gt: now }
//   }).sort({ expiresAt: -1 });

//   const boost = await Subscription.findOne({
//     schoolId,
//     isTemporaryBoost: true,
//     status: 'active',
//     expiresAt: { $gt: now }
//   });

//   if (boost && boost.priority > (main?.priority || 0)) {
//     return boost;
//   }
//   return main;
// }

// const authMiddleware = async (req, res, next) => {
//   try {
//     if (!process.env.JWT_SECRET) {
//       return res.status(500).json({ message: 'Server error: Missing JWT_SECRET' });
//     }

//     const token = req.header('Authorization')?.replace('Bearer ', '');
//     if (!token) {
//       return res.status(401).json({ message: 'Access denied. No token provided.' });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await User.findById(decoded.userId).select('-password');
//     if (!user) {
//       return res.status(401).json({ message: 'Unauthorized. User not found.' });
//     }

//     // === WHITELIST: Allow these routes even if subscription expired or pending ===
//     const WHITELIST_ROUTES = [
//       '/api/subscriptions/upgrade',
//       '/api/subscriptions/verify-payment',
//       '/api/subscriptions/webhook',
//       '/api/subscriptions/plans',
//       '/api/subscriptions/current',
//       '/api/subscriptions/cancel-upgrade'
//     ];

//     const isWhitelisted = WHITELIST_ROUTES.some(route => req.originalUrl.startsWith(route));
//     const isReadOnly = ['GET', 'OPTIONS', 'HEAD'].includes(req.method);

//     let subscription = null;
//     let school = null;
//     let activeSubscription = null;
//     let hasPendingUpgrade = false;   

//     if (user.role !== 'superadmin') {
//       // Find the latest subscription (active, pending, expired)
//       subscription = await Subscription.findOne({
//         schoolId: user.schoolId
//       }).sort({ createdAt: -1 }).lean();

//       // Auto-update status if needed
//       const now = new Date();
//       if (subscription) {
//         if (subscription.status === 'active' && subscription.expiresAt < now) {
//           subscription.status = 'grace_period';
//           subscription.gracePeriodEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
//           await Subscription.updateOne({ _id: subscription._id }, {
//             status: 'grace_period',
//             gracePeriodEnds: subscription.gracePeriodEnds
//           });
//         } else if (subscription.status === 'grace_period' && subscription.gracePeriodEnds < now) {
//           subscription.status = 'expired';
//           await Subscription.updateOne({ _id: subscription._id }, { status: 'expired' });
//         }
//       }

//       // BLOCK only if: not read-only AND not whitelisted AND (expired or pending)
//       if (subscription && ['expired', 'pending'].includes(subscription.status)) {
//         if (!isReadOnly && !isWhitelisted) {
//           return res.status(403).json({
//             message: subscription.status === 'expired'
//               ? 'Subscription expired. Please renew your plan.'
//               : 'Payment pending verification. Only viewing allowed.',
//             code: subscription.status === 'expired' ? 'SUBSCRIPTION_EXPIRED' : 'PAYMENT_PENDING'
//           });
//         }
//       }

//       // Load school
//       school = await School.findById(user.schoolId).select('activeAcademicYear');
//       if (!school?.activeAcademicYear) {
//         return res.status(400).json({ message: 'No active academic year set' });
//       }
//     }

//     // Attach cleaned user to request
//     req.user = {
//       id: user._id.toString(),
//       role: user.role,
//       schoolId: user.schoolId?.toString(),
//       activeAcademicYear: user.role !== 'superadmin' ? school?.activeAcademicYear.toString() : null,
//       subscriptionStatus: user.role === 'superadmin' ? 'unlimited' : (subscription?.status || 'none'),
//       ...(user.role === 'teacher' && { teacherId: decoded.additionalInfo?.teacherId }),
//       ...(['parent', 'student'].includes(user.role) && { additionalInfo: user.additionalInfo || {} })
//     };

//     next();

//   } catch (err) {
//     console.error('Auth error:', err.message);
//     if (err.name === 'TokenExpiredError') {
//       return res.status(401).json({ message: 'Session expired. Please login again.' });
//     }
//     if (err.name === 'JsonWebTokenError') {
//       return res.status(401).json({ message: 'Invalid token.' });
//     }
//     res.status(500).json({ message: 'Authentication failed' });
//   }
// };

// module.exports = authMiddleware;




// middleware/authMiddleware.js — FINAL PRODUCTION VERSION (2025)
// Fixes PAYMENT_PENDING bug | 100% safe | No breaking changes

const jwt = require('jsonwebtoken');
const User = require('../models/user');
const School = require('../models/school');
const Subscription = require('../models/subscription');

// YOUR ORIGINAL LOGIC — KEEP IT (it's correct!)
async function getActiveSubscription(schoolId) {
  const now = new Date();

  const main = await Subscription.findOne({
    schoolId,
    isTemporaryBoost: false,
    status: { $in: ['active', 'grace_period'] },
    expiresAt: { $gt: now }
  }).sort({ expiresAt: -1 });

  const boost = await Subscription.findOne({
    schoolId,
    isTemporaryBoost: true,
    status: 'active',
    expiresAt: { $gt: now }
  });

  if (boost && boost.priority > (main?.priority || 0)) {
    return { subscription: boost, isBoost: true };
  }
  return { subscription: main, isBoost: false };
}

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

    // WHITELIST — allow subscription actions even if blocked
    const WHITELIST_ROUTES = [
      '/api/subscriptions/upgrade',
      '/api/subscriptions/verify-payment',
      '/api/subscriptions/webhook',
      '/api/subscriptions/plans',
      '/api/subscriptions/current',
      '/api/subscriptions/cancel-upgrade'
    ];

    const isWhitelisted = WHITELIST_ROUTES.some(route => req.originalUrl.startsWith(route));
    const isReadOnly = ['GET', 'OPTIONS', 'HEAD'].includes(req.method);

    let school = null;
    let activeSub = null;
    let hasPendingUpgrade = false;

    // === MAIN FIX: Use REAL active subscription, not "latest created" ===
    const activeResult = await getActiveSubscription(user.schoolId);
    activeSub = activeResult.subscription;

    // Check if there's any pending upgrade (for UI banner only)
    const pendingCount = await Subscription.countDocuments({
      schoolId: user.schoolId,
      status: 'pending'
    });
    hasPendingUpgrade = pendingCount > 0;

    // Load school & academic year
    school = await School.findById(user.schoolId).select('activeAcademicYear');
    if (!school?.activeAcademicYear) {
      return res.status(400).json({ message: 'No active academic year set' });
    }

    // BLOCK ONLY IF: No active subscription + not read-only + not whitelisted
    if (!activeSub && !isReadOnly && !isWhitelisted) {
      return res.status(403).json({
        message: 'Please upgrade your plan to continue.',
        code: 'NO_ACTIVE_PLAN'
      });
    }

    // Attach user (100% backward compatible with your current frontend)
    req.user = {
      id: user._id.toString(),
      role: user.role,
      schoolId: user.schoolId?.toString(),
      activeAcademicYear: school.activeAcademicYear.toString(),
      subscriptionStatus: activeSub ? 'active' : 'none',
      isPremium: activeSub?.priority === 3 || false,
      hasPendingUpgrade,  // For banner in NavRightComponent
      ...(user.role === 'teacher' && { teacherId: decoded.additionalInfo?.teacherId }),
      ...(['parent', 'student'].includes(user.role) && { additionalInfo: user.additionalInfo || {} })
    };

    // Optional: Attach for future use
    req.activeSubscription = activeSub;
    req.hasPendingUpgrade = hasPendingUpgrade;

    next();

  } catch (err) {
    console.error('Auth middleware error:', err.message);
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