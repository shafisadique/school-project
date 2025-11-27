// middleware/checkFeatureAccess.js
const Subscription = require('../models/subscription');

const checkFeatureAccess = (requiredFeature) => {
  return async (req, res, next) => {
    try {
      const schoolId = req.user.schoolId;
      const now = new Date();

      // Find highest priority ACTIVE subscription
      const subscription = await Subscription.findOne({
        schoolId,
        status: { $in: ['active', 'grace_period'] },
        expiresAt: { $gt: now }
      }).sort({ priority: -1 });

      // No subscription at all
      if (!subscription) {
        return res.status(403).json({
          success: false,
          message: 'No active subscription found. Please upgrade your plan.',
          upgradeRequired: true
        });
      }

      // Grace period expired?
      if (subscription.status === 'grace_period' && subscription.gracePeriodEnds < now) {
        return res.status(403).json({
          success: false,
          message: 'Your subscription has expired. Please renew to continue.',
          upgradeRequired: true
        });
      }

      // PREMIUM FEATURES (only allowed in premium plans)
      const premiumFeatures = [
        'student_portal',
        'parent_portal',
        'exam',
        'result',
        'assignment',
        'online_result'
      ];

      if (premiumFeatures.includes(requiredFeature)) {
        // Check if plan is PREMIUM
        const isPremium = subscription.planType.toLowerCase().includes('premium');

        if (!isPremium) {
          return res.status(403).json({
            success: false,
            message: 'This feature is only available in Premium plans',
            upgradeRequired: true,
            currentPlan: subscription.planType,
            requiredPlan: 'Premium'
          });
        }
      }

      // Optional: Check features array (if you use it)
      // const hasFeature = subscription.features?.includes(requiredFeature);
      // if (!hasFeature) {
      //   return res.status(403).json({ message: 'Feature not included in your plan' });
      // }

      req.subscription = subscription;
      next();
    } catch (error) {
      console.error('Feature access check failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to verify subscription'
      });
    }
  };
};

module.exports = checkFeatureAccess;