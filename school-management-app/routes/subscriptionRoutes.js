



const express = require('express');
const router = express.Router();
const Subscription = require('../models/subscription');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');

const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Enhanced subscription plans with clear benefits
const subscriptionPlans = {
  trial: {
    name: "Free Trial",
    duration: 14,
    price: 0,
    features: [
      "Full access to all features",
      "Up to 50 students",
      "Basic support",
      "No payment required"
    ],
    recommended: false
  },
  basic: {
    monthly: {
      name: "Basic Monthly",
      price: 700,
      originalPrice: 700,
      duration: 30,
      features: [
        "Unlimited students",
        "Basic reporting tools",
        "Email support",
        "Mobile app access"
      ],
      savings: 0,
      recommended: false
    },
    yearly: {
      name: "Basic Yearly",
      price: 6000,
      originalPrice: 8400,
      duration: 365,
      features: [
        "Unlimited students",
        "Advanced reporting tools",
        "Priority email support",
        "Mobile app access",
        "2 admin accounts"
      ],
      savings: 2400,
      recommended: true
    }
  },
  premium: {
    monthly: {
      name: "Premium Monthly",
      price: 1200,
      originalPrice: 1200,
      duration: 30,
      features: [
        "Unlimited students & staff",
        "Advanced analytics",
        "Phone & email support",
        "Custom reports",
        "5 admin accounts",
        "Data export功能"
      ],
      savings: 0,
      recommended: false
    },
    yearly: {
      name: "Premium Yearly",
      price: 12000,
      originalPrice: 14400,
      duration: 365,
      features: [
        "Unlimited students & staff",
        "Advanced analytics dashboard",
        "24/7 priority support",
        "Custom report builder",
        "Unlimited admin accounts",
        "Automated data backups",
        "White-label option",
        "API access"
      ],
      savings: 2400,
      recommended: true
    }
  }
};

// GET /api/subscriptions/plans - Get all available plans
router.get('/plans', authMiddleware, (req, res) => {
  res.status(200).json(subscriptionPlans);
});

// GET /api/subscriptions/current - Get current subscription
router.get('/current', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'superadmin') {
      return res.status(200).json({ 
        message: 'Superadmin has unlimited access', 
        subscriptionStatus: 'unlimited',
        plan: { name: 'Super Admin', features: ['All features', 'Unlimited access'] }
      });
    }

    const subscription = await Subscription.findOne({
      schoolId: req.user.schoolId,
      status: { $in: ['active', 'pending', 'grace_period'] }
    });

    if (!subscription) {
      // Check if school is eligible for trial
      const school = await School.findById(req.user.schoolId);
      const isNewSchool = new Date(school.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      if (isNewSchool) {
        // Auto-create trial subscription for new schools
        const trialSubscription = new Subscription({
          schoolId: req.user.schoolId,
          planType: 'trial',
          status: 'active',
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
          durationDays: 14,
          originalAmount: 0,
          discountAmount: 0,
          finalAmount: 0
        });
        
        await trialSubscription.save();
        return res.status(200).json({
          planType: 'trial',
          name: 'Free Trial',
          expiresAt: trialSubscription.expiresAt,
          daysRemaining: trialSubscription.daysRemaining,
          isTrial: true,
          subscriptionStatus: 'active',
          features: subscriptionPlans.trial.features
        });
      }
      
      return res.status(404).json({ 
        message: 'No active subscription found', 
        subscriptionStatus: 'none',
        eligibleForTrial: isNewSchool
      });
    }

    // Check if subscription expired and needs to move to grace period
    const now = new Date();
    if (subscription.status === 'active' && subscription.expiresAt < now) {
      subscription.status = 'grace_period';
      subscription.gracePeriodEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days grace
      await subscription.save();
    }
    
    // Check if grace period ended
    if (subscription.status === 'grace_period' && subscription.gracePeriodEnds < now) {
      subscription.status = 'expired';
      await subscription.save();
    }

    const planDetails = getPlanDetails(subscription.planType);
    
    res.status(200).json({
      planType: subscription.planType,
      name: planDetails.name,
      expiresAt: subscription.expiresAt,
      daysRemaining: subscription.daysRemaining,
      isTrial: subscription.planType === 'trial',
      isInGracePeriod: subscription.status === 'grace_period',
      gracePeriodEnds: subscription.gracePeriodEnds,
      subscriptionStatus: subscription.status,
      paymentMethod: subscription.paymentMethod,
      features: planDetails.features,
      autoRenew: subscription.autoRenew
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching subscription', error: err.message });
  }
});

// POST /api/subscriptions/upgrade - Upgrade subscription
router.post('/upgrade', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'superadmin') {
      return res.status(403).json({ message: 'Superadmin cannot upgrade subscriptions' });
    }

    const { planType, paymentMethod, autoRenew = false } = req.body;
    
    // Validate plan type
    const planDetails = getPlanDetails(planType);
    if (!planDetails) {
      return res.status(400).json({ message: 'Invalid plan type' });
    }
    
    // Validate payment method
    if (!['razorpay', 'phonepe', 'bank_transfer', 'card', 'upi'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    // Check if school already has a pending or active subscription
    const existingSub = await Subscription.findOne({
      schoolId: req.user.schoolId,
      status: { $in: ['active', 'pending', 'grace_period'] }
    });

    // For bank transfer, create a pending subscription
    if (paymentMethod === 'bank_transfer') {
      const newSubscription = new Subscription({
        schoolId: req.user.schoolId,
        planType,
        status: 'pending',
        expiresAt: new Date(Date.now() + planDetails.duration * 24 * 60 * 60 * 1000),
        paymentMethod,
        durationDays: planDetails.duration,
        originalAmount: planDetails.originalPrice,
        discountAmount: planDetails.originalPrice - planDetails.price,
        finalAmount: planDetails.price,
        autoRenew
      });
      
      await newSubscription.save();

      return res.status(200).json({
        message: 'Bank transfer initiated. Please upload payment proof.',
        bankDetails: {
          accountName: 'EduManage Solutions',
          accountNumber: '1234567890123456',
          ifscCode: 'SBIN0001234',
          bankName: 'State Bank of India',
          branch: 'Main Branch',
          amount: planDetails.price,
          reference: `EDU-${newSubscription._id.toString().slice(-8)}`
        },
        subscriptionId: newSubscription._id
      });
    }

    // For online payments, create Razorpay order
    const order = await rzp.orders.create({
      amount: planDetails.price * 100, // In paise
      currency: 'INR',
      receipt: `sub_${existingSub ? existingSub._id : 'new'}`,
      notes: { 
        schoolId: req.user.schoolId.toString(), 
        planType, 
        durationDays: planDetails.duration,
        paymentMethod, 
        originalAmount: planDetails.originalPrice, 
        discountAmount: planDetails.originalPrice - planDetails.price, 
        finalAmount: planDetails.price,
        autoRenew
      }
    });

    res.status(200).json({ 
      order,
      plan: planDetails
    });
  } catch (err) {
    res.status(500).json({ message: 'Error initiating upgrade', error: err.message });
  }
});

// POST /api/subscriptions/cancel - Cancel auto-renewal
router.post('/cancel-auto-renew', authMiddleware, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      schoolId: req.user.schoolId,
      status: 'active'
    });
    
    if (!subscription) {
      return res.status(404).json({ message: 'No active subscription found' });
    }
    
    subscription.autoRenew = false;
    await subscription.save();
    
    res.status(200).json({ message: 'Auto-renewal cancelled successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error cancelling auto-renewal', error: err.message });
  }
});

// POST /api/subscriptions/apply-coupon - Apply discount coupon
router.post('/apply-coupon', authMiddleware, async (req, res) => {
  try {
    const { planType, couponCode } = req.body;
    const planDetails = getPlanDetails(planType);
    
    if (!planDetails) {
      return res.status(400).json({ message: 'Invalid plan type' });
    }
    
    // In a real application, you would validate the coupon against a database
    const coupon = validateCoupon(couponCode, planType);
    
    if (!coupon.valid) {
      return res.status(400).json({ message: 'Invalid or expired coupon code' });
    }
    
    const discountedPrice = calculateDiscount(planDetails.price, coupon.discount);
    
    res.status(200).json({
      originalPrice: planDetails.price,
      discount: coupon.discount,
      finalPrice: discountedPrice,
      couponCode: coupon.code,
      message: `Coupon applied successfully! You saved ${coupon.discount}%`
    });
  } catch (err) {
    res.status(500).json({ message: 'Error applying coupon', error: err.message });
  }
});

// Helper function to get plan details
function getPlanDetails(planType) {
  const [tier, duration] = planType.split('_');
  
  if (planType === 'trial') {
    return subscriptionPlans.trial;
  }
  
  if (subscriptionPlans[tier] && subscriptionPlans[tier][duration]) {
    return subscriptionPlans[tier][duration];
  }
  
  return null;
}

// Helper function to validate coupon (simplified)
function validateCoupon(code, planType) {
  // In a real application, this would check against a database
  const coupons = {
    'WELCOME10': { discount: 10, validFor: ['basic_monthly', 'premium_monthly'], expires: '2024-12-31' },
    'EDU25': { discount: 25, validFor: ['basic_yearly', 'premium_yearly'], expires: '2024-06-30' }
  };
  
  const coupon = coupons[code];
  if (!coupon) {
    return { valid: false };
  }
  
  const now = new Date();
  const expires = new Date(coupon.expires);
  
  if (now > expires || !coupon.validFor.includes(planType)) {
    return { valid: false };
  }
  
  return {
    valid: true,
    discount: coupon.discount,
    code: code
  };
}

// Helper function to calculate discount
function calculateDiscount(price, discountPercent) {
  return price - (price * discountPercent / 100);
}

module.exports = router;