const Subscription = require('../models/subscription');

const checkFeatureAccess = (requiredFeature) => {
  return async (req, res, next) => {
    try {
      const schoolId = req.user.schoolId;
      const now = new Date();

      // Find the highest priority active/valid subscription
      const subscription = await Subscription.findOne({
        schoolId,
        status: { $in: ['active', 'grace_period'] },
        expiresAt: { $gt: now }
      }).sort({ priority: -1 }); // Highest priority first

      // If no active subscription found
      if (!subscription) {
        return res.status(403).json({
          message: 'No active subscription found'
        });
      }

      // Check grace period expiry
      if (subscription.status === 'grace_period' && subscription.gracePeriodEnds < now) {
        return res.status(403).json({
          message: 'Your subscription has expired. Please renew to continue.'
        });
      }

      // Check if the required feature is included
      const hasFeature = subscription.features?.includes(requiredFeature);

      if (!hasFeature) {
        return res.status(403).json({
          message: `This feature requires a Premium plan. Upgrade to access ${requiredFeature} module.`,
          upgradeRequired: true,
          currentPlan: subscription.planType,
          requiredFeature
        });
      }

      // Optional: Attach subscription to req for later use
      req.subscription = subscription;

      next();
    } catch (error) {
      console.error('Feature access check failed:', error);
      return res.status(500).json({ message: 'Failed to verify plan access' });
    }
  };
};

module.exports = checkFeatureAccess;