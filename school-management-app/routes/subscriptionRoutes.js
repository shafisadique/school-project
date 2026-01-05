const express = require('express');
const router = express.Router();
const Subscription = require('../models/subscription');
const Razorpay = require('razorpay');
const authMiddleware = require('../middleware/authMiddleware');
const crypto = require('crypto');
const School = require('../models/school');

const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const PLANS = {
  trial: { name: "Free Trial", price: 0, duration: 14, sms: 100, whatsapp: 50, priority: 1 },

  sms_basic_monthly:     { name: "Basic Monthly (SMS)", price: 950, duration: 30, sms: 1000, whatsapp: 0, priority: 2 },
  sms_basic_yearly:      { name: "Basic Yearly (SMS)", price: 9000, duration: 365, sms: 12000, whatsapp: 0, priority: 2 },
  whatsapp_basic_monthly:{ name: "Basic Monthly (WhatsApp)", price: 775, duration: 30, sms: 0, whatsapp: 500, priority: 2 },
  whatsapp_basic_yearly: { name: "Basic Yearly (WhatsApp)", price: 6900, duration: 365, sms: 0, whatsapp: 6000, priority: 2 },
  both_basic_monthly:    { name: "Basic Monthly (Both)", price: 1025, duration: 30, sms: 1000, whatsapp: 500, priority: 2 },
  both_basic_yearly:     { name: "Basic Yearly (Both)", price: 10000, duration: 365, sms: 12000, whatsapp: 15000, priority: 2 },
  both_premium_monthly:  { name: "Premium Monthly", price: 1500, duration: 30, sms: 5000, whatsapp: 2000, priority: 3 },
  both_premium_yearly:   { name: "Premium Yearly", price: 12000, duration: 365, sms: 60000, whatsapp: 24000, priority: 3 }
};

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
    return { subscription: boost, mainPlan: main, isBoost: true };
  }
  return { subscription: main, mainPlan: null, isBoost: false };
}

// GET /api/subscriptions/plans — FINAL WORKING CODE
router.get('/plans', authMiddleware, async (req, res) => {
  const school = await School.findById(req.user.schoolId);
  const channel = school.preferredChannel || 'both';

  const plans = { trial: { ...PLANS.trial, planType: 'trial' } };

  if (channel === 'sms' || channel === 'both') {
    plans.sms_basic_monthly = { ...PLANS.sms_basic_monthly, planType: 'sms_basic_monthly' };
    plans.sms_basic_yearly = { ...PLANS.sms_basic_yearly, planType: 'sms_basic_yearly' };
  }
  if (channel === 'whatsapp' || channel === 'both') {
    plans.whatsapp_basic_monthly = { ...PLANS.whatsapp_basic_monthly, planType: 'whatsapp_basic_monthly' };
    plans.whatsapp_basic_yearly = { ...PLANS.whatsapp_basic_yearly, planType: 'whatsapp_basic_yearly' };
  }
  if (channel === 'both') {
    plans.both_basic_monthly = { ...PLANS.both_basic_monthly, planType: 'both_basic_monthly' };
    plans.both_basic_yearly = { ...PLANS.both_basic_yearly, planType: 'both_basic_yearly' };
  }

  let premiumMonthly = { ...PLANS.both_premium_monthly, planType: 'both_premium_monthly' };
  if (channel === 'sms') {
    premiumMonthly.price = 1575;
    premiumMonthly.name = "Premium Monthly (+WhatsApp ₹75)";
  } else if (channel === 'whatsapp') {
    premiumMonthly.price = 1750;
    premiumMonthly.name = "Premium Monthly (+SMS ₹250)";
  }
  plans.both_premium_monthly = premiumMonthly;
  plans.both_premium_yearly = { ...PLANS.both_premium_yearly, planType: 'both_premium_yearly' };

  res.json(plans);
});

async function checkAndResetUsage(subscription) {
  const now = new Date();
  const lastReset = subscription.usageStats.lastResetDate;
  const lastResetMonth = lastReset.getMonth();
  const lastResetYear = lastReset.getFullYear();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  if (lastResetMonth !== currentMonth || lastResetYear !== currentYear) {
    subscription.usageStats.smsUsedThisMonth = 0;
    subscription.usageStats.whatsappUsedThisMonth = 0;
    subscription.usageStats.lastResetDate = now;
    await subscription.save();
  }
}

router.get('/current', authMiddleware, async (req, res) => {
  let { subscription, mainPlan, isBoost } = await getActiveSubscription(req.user.schoolId);

  if (!subscription) {
    const school = await School.findById(req.user.schoolId);
    const isNew = new Date(school.createdAt) > new Date(Date.now() - 30*24*60*60*1000);
    if (isNew) {
      subscription = await new Subscription({
        schoolId: req.user.schoolId,
        planType: 'trial',
        priority: 1,
        status: 'active',
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 14*24*60*60*1000),
        durationDays: 14,
        originalAmount: 0,
        finalAmount: 0,
        messageLimits: { smsMonthly: 100, whatsappMonthly: 50 },
        isTemporaryBoost: false
      }).save();
      isBoost = false;
      mainPlan = null;
    } else {
      return res.json({ status: 'none' });
    }
  }

  // Reset monthly usage
  const now = new Date();
  if (new Date(subscription.usageStats.lastResetDate).getMonth() !== now.getMonth()) {
    subscription.usageStats.smsUsedThisMonth = 0;
    subscription.usageStats.whatsappUsedThisMonth = 0;
    subscription.usageStats.lastResetDate = now;
    await subscription.save();
  }
  const pendings = await Subscription.find({ 
    schoolId: req.user.schoolId, 
    status: 'pending' 
  }).limit(1);

  res.json({
    planType: subscription.planType,
    name: PLANS[subscription.planType]?.name || 'Unknown',
    isBoostActive: isBoost,
    mainPlanType: mainPlan?.planType || null,
    expiresAt: subscription.expiresAt,
    daysRemaining: subscription.daysRemaining,
    isPremium: subscription.priority === 3,
    messageLimits: subscription.messageLimits,
    usageStats: subscription.usageStats,
    features: subscription.priority === 3 
      ? ['exam','results','reports','student_portal','analytics']
      : ['attendance','fees','notifications'],
    hasPending: pendings.length > 0,
    status: subscription.status

  });
});

// NEW: GET /api/subscriptions/expiry-status — Lightweight endpoint for header display
router.get('/expiry-status', authMiddleware, async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    let { subscription } = await getActiveSubscription(schoolId);

    // If no active subscription, check for trial or return 'none'
    if (!subscription) {
      const school = await School.findById(schoolId);
      const isNew = new Date(school.createdAt) > new Date(Date.now() - 30*24*60*60*1000);
      if (isNew) {
        // Auto-create trial if new school (mirrors /current logic)
        subscription = await new Subscription({
          schoolId,
          planType: 'trial',
          priority: 1,
          status: 'active',
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + 14*24*60*60*1000),
          durationDays: 14,
          originalAmount: 0,
          finalAmount: 0,
          messageLimits: { smsMonthly: 100, whatsappMonthly: 50 },
          isTemporaryBoost: false
        }).save();
      } else {
        // No subscription: Treat as expired/none
        return res.json({
          currentPlanName: 'No Plan',
          planType: '',
          expiresAt: '',
          daysRemaining: 0,
          status: 'none',
          isExpiringSoon: false,
          isExpired: true,
          isPending: false
        });
      }
    }

    // Calculate days remaining (on-the-fly, since it may not be stored)
    const now = new Date();
    const expiresAt = new Date(subscription.expiresAt);
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Check for pending subscriptions
    const pendings = await Subscription.find({ 
      schoolId, 
      status: 'pending' 
    }).limit(1);
    const isPending = pendings.length > 0;

    // Determine status flags
    const status = subscription.status;
    const isExpiringSoon = status === 'active' && daysRemaining <= 7 && daysRemaining > 0;
    const isExpired = status === 'expired' || daysRemaining <= 0;

    // Get plan name from PLANS
    const currentPlanName = PLANS[subscription.planType]?.name || 'Unknown Plan';

    res.json({
      currentPlanName,
      planType: subscription.planType,
      expiresAt: subscription.expiresAt.toISOString(), // ISO for frontend
      daysRemaining,
      status,
      isExpiringSoon,
      isExpired,
      isPending: isPending || status === 'pending'
    });
  } catch (error) {
    console.error('Expiry status error:', error);
    res.status(500).json({ error: 'Failed to fetch expiry status' });
  }
});

// UPGRADE – FULLY TESTED & WORKING
router.post('/upgrade', authMiddleware, async (req, res) => {
  try {
    const { planType, paymentMethod = 'razorpay' } = req.body;

    const plan = PLANS[planType];
    if (!plan) return res.status(400).json({ message: 'Invalid plan type' });

    const school = await School.findById(req.user.schoolId);
    const channel = school?.preferredChannel || 'both';

    let price = plan.price;
    if (planType === 'both_premium_monthly') {
      if (channel === 'sms') price = 1575;
      if (channel === 'whatsapp') price = 1750;
    }

    // const isBoost = planType === 'both_premium_monthly';
    const isBoost = ['temp_boost_7d', 'temp_boost_15d'].includes(planType);

    const newSub = new Subscription({
      schoolId: req.user.schoolId,
      planType,
      priority: plan.priority,
      status: 'pending',
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + plan.duration * 24*60*60*1000),
      durationDays: plan.duration,
      originalAmount: price,
      finalAmount: price,
      messageLimits: {
        smsMonthly: plan.sms,
        whatsappMonthly: plan.whatsapp
      },
      usageStats: {
        smsUsedThisMonth: 0,
        whatsappUsedThisMonth: 0,
        lastResetDate: new Date()
      },
      isTemporaryBoost: isBoost,
      paymentMethod
    });

    await newSub.save();

    if (paymentMethod === 'razorpay') {
      const order = await rzp.orders.create({
        amount: price * 100,
        currency: 'INR',
        receipt: `sub_${newSub._id}`
      });

      newSub.razorpayOrderId = order.id;
      await newSub.save();

      return res.json({
        success: true,
        order,
        subscriptionId: newSub._id,
        plan: { ...plan, price }
      });
    }

    res.json({ success: true, message: 'Pending bank transfer', subscriptionId: newSub._id });

  } catch (err) {
    console.error('Upgrade error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/subscriptions/verify-payment - Verify Razorpay payment
router.post('/verify-payment', authMiddleware, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, subscriptionId } = req.body;

    const sign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (sign !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const sub = await Subscription.findById(subscriptionId);
    if (!sub || sub.razorpayOrderId !== razorpay_order_id || sub.status !== 'pending') {
      return res.status(400).json({ message: 'Invalid subscription' });
    }

    sub.status = 'active';
    sub.startsAt = new Date();
    sub.transactionId = razorpay_payment_id;
    await sub.save();

    res.json({ success: true, message: 'Payment successful & plan activated' });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ message: 'Verification failed' });
  }
});

// POST /api/subscriptions/webhook - Razorpay webhook for payment confirmation
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body.toString();

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const payload = JSON.parse(body);
    const event = payload.event;
    const payment = payload.payload.payment.entity;

    if (event === 'payment.captured') {
      const subscription = await Subscription.findOne({
        razorpayOrderId: payment.order_id
      });

      if (subscription && subscription.status === 'pending') {
        subscription.status = 'active';
        subscription.startsAt = new Date();
        subscription.expiresAt = new Date(Date.now() + subscription.durationDays * 24 * 60 * 60 * 1000);
        subscription.transactionId = payment.id;
        await subscription.save();

        // Fixed: 'school' → 'School'
        await School.findByIdAndUpdate(subscription.schoolId, {
          $set: {
            smsPackActive: true,
            remainingSms: subscription.messageLimits.smsMonthly || 1000,
            smsExpiry: subscription.expiresAt,
            smsPlan: subscription.planType
          }
        });

        console.log(`SMS pack activated for school ${subscription.schoolId} via webhook`); // Assuming logger is console
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ message: 'Failed' });
  }
});

// POST /api/subscriptions/cancel-auto-renew
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

// NEW: POST /api/subscriptions/cancel-upgrade – Delete pending sub on cancel
router.post('/cancel-upgrade', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.body;  // From frontend ondismiss

    if (!orderId) {
      return res.status(400).json({ message: 'Order ID required' });
    }

    // Find & delete pending sub linked to this order
    const pendingSub = await Subscription.findOneAndDelete({
      razorpayOrderId: orderId,
      status: 'pending',
      schoolId: req.user.schoolId
    });

    if (!pendingSub) {
      return res.status(404).json({ message: 'No pending subscription found' });
    }

    // Optional: Cancel Razorpay order (API call)
    await rzp.orders.cancel(orderId);

    res.json({ 
      success: true, 
      message: 'Upgrade cancelled – pending sub removed. Features restored.' 
    });
  } catch (err) {
    console.error('Cancel upgrade error:', err);
    res.status(500).json({ message: 'Cancel failed' });
  }
});

function getPlanDetails(planType) {
  // Handle trial
  if (planType === 'trial') {
    return {
      ...PLANS.trial,
      planType: 'trial',
      priority: 1
    };
  }

  // Fix: Correct splitting for both_basic_monthly, sms_basic_yearly, etc.
  const parts = planType.split('_'); // ['both', 'basic', 'monthly']
  if (parts.length !== 3) {
    console.error('Invalid planType format:', planType);
    return null;
  }

  const [channel, tier, duration] = parts;

  // Reconstruct key: both_basic_monthly, sms_basic_yearly, etc.
  const key = `${channel}_${tier}_${duration}`;
  
  if (PLANS[key]) {  // Fixed: PLANS instead of subscriptionPlans
    return {
      ...PLANS[key],
      planType: key,
      priority: channel === 'both' && tier === 'premium' ? 3 : 2
    };
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