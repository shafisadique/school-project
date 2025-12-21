
// const jwt = require('jsonwebtoken');
// const prisma = require('../utils/prisma'); // your Prisma instance

// /**
//  * Get the currently active subscription (main plan or boost if higher priority)
//  */
// async function getActiveSubscription(schoolId) {
//   const now = new Date();

//   const main = await prisma.subscription.findFirst({
//     where: {
//       schoolId,
//       isTemporaryBoost: false,
//       status: { in: ['active', 'grace_period'] },
//       expiresAt: { gt: now },
//     },
//     orderBy: { expiresAt: 'desc' },
//   });

//   const boost = await prisma.subscription.findFirst({
//     where: {
//       schoolId,
//       isTemporaryBoost: true,
//       status: 'active',
//       expiresAt: { gt: now },
//     },
//   });

//   if (boost && boost.priority > (main?.priority || 0)) {
//     return { subscription: boost, isBoost: true };
//   }

//   return { subscription: main, isBoost: false };
// }

// const authMiddleware = async (req, res, next) => {
//   try {
//     // 1. Extract token
//     const token = req.header('Authorization')?.replace('Bearer ', '');
//     if (!token) {
//       return res.status(401).json({ message: 'Access denied. No token provided.' });
//     }

//     // 2. Verify token
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const userId = decoded.userId;
//     const roleFromToken = decoded.role; // Make sure your login includes role in JWT!

//     let user = null;
//     let schoolId = null;
//     let activeAcademicYear = null;
//     let activeSub = null;
//     let hasPendingUpgrade = false;

//     // =================================================================
//     // CASE 1: Superadmin — completely separate table
//     // =================================================================
//     if (roleFromToken === 'superadmin') {
//       const superUser = await prisma.superUser.findUnique({
//         where: { id: userId },
//         select: {
//           id: true,
//           name: true,
//           username: true,
//           email: true,
//         },
//       });

//       if (!superUser) {
//         return res.status(401).json({ message: 'Invalid superadmin token' });
//       }

//       // Attach superadmin to req.user and bypass all school checks
//       req.user = {
//         userId: superUser.id,
//         id: superUser.id,
//         role: 'superadmin',
//         schoolId: null,
//         activeAcademicYear: null,
//         subscriptionStatus: 'superadmin',
//         isPremium: true,
//         hasPendingUpgrade: false,
//         name: superUser.name,
//         email: superUser.email,
//         username: superUser.username,
//       };

//       return next(); // Superadmin has full access
//     }

//     // =================================================================
//     // CASE 2: Regular school users (admin, teacher, student, parent)
//     // =================================================================
//     user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: {
//         id: true,
//         name: true,
//         username: true,
//         email: true,
//         role: true,
//         schoolId: true,
//         additionalInfo: true,
//         status: true,
//       },
//     });

//     if (!user) {
//       return res.status(401).json({ message: 'User not found' });
//     }

//     if (!user.status) {
//       return res.status(401).json({ message: 'Account is inactive' });
//     }

//     if (!user.schoolId) {
//       return res.status(403).json({ message: 'User not assigned to any school' });
//     }

//     schoolId = user.schoolId;

//     // Load active subscription
//     const { subscription: currentSub } = await getActiveSubscription(schoolId);
//     activeSub = currentSub;

//     // Check for pending upgrades (for UI banner)
//     const pendingCount = await prisma.subscription.count({
//       where: { schoolId, status: 'pending' },
//     });
//     hasPendingUpgrade = pendingCount > 0;

//     // Load active academic year from School table
//     const school = await prisma.school.findUnique({
//       where: { id: schoolId },
//       select: { activeAcademicYear: true },
//     });

//     if (!school?.activeAcademicYear) {
//       return res.status(400).json({ message: 'No active academic year set' });
//     }

//     activeAcademicYear = school.activeAcademicYear;

//     // Whitelist routes — allow even without active subscription
//     const WHITELIST_ROUTES = [
//       '/api/subscriptions/upgrade',
//       '/api/subscriptions/verify-payment',
//       '/api/subscriptions/webhook',
//       '/api/subscriptions/plans',
//       '/api/subscriptions/current',
//       '/api/subscriptions/cancel-upgrade',
//     ];

//     const isWhitelisted = WHITELIST_ROUTES.some((route) =>
//       req.originalUrl.startsWith(route)
//     );
//     const isReadOnly = ['GET', 'OPTIONS', 'HEAD'].includes(req.method);

//     // Block write operations if no active plan (except whitelisted routes)
//     if (!activeSub && !isReadOnly && !isWhitelisted) {
//       return res.status(403).json({
//         message: 'Please upgrade your plan to continue.',
//         code: 'NO_ACTIVE_PLAN',
//       });
//     }

//     // =================================================================
//     // Attach everything to req.user (compatible with your frontend)
//     // =================================================================
//     req.user = {
//       userId: user.id,
//       id: user.id,
//       role: user.role,
//       schoolId: user.schoolId,
//       activeAcademicYear,
//       subscriptionStatus: activeSub ? 'active' : 'none',
//       isPremium: !!activeSub && activeSub.priority === 3,
//       hasPendingUpgrade,
//       name: user.name,
//       email: user.email,
//       username: user.username,

//       // Teacher & student/parent specific
//       ...(user.role === 'teacher' && {
//         teacherId: decoded.additionalInfo?.teacherId,
//       }),
//       ...(['student', 'parent'].includes(user.role) && {
//         additionalInfo: user.additionalInfo || {},
//       }),
//     };

//     // Optional: attach for convenience in controllers
//     req.activeSubscription = activeSub;
//     req.hasPendingUpgrade = hasPendingUpgrade;

//     next();
//   } catch (err) {
//     console.error('Auth middleware error:', err);

//     if (err.name === 'TokenExpiredError') {
//       return res.status(401).json({ message: 'Session expired. Please login again.' });
//     }
//     if (err.name === 'JsonWebTokenError') {
//       return res.status(401).json({ message: 'Invalid token' });
//     }

//     return res.status(401).json({ message: 'Authentication failed' });
//   }
// };

// module.exports = authMiddleware;

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