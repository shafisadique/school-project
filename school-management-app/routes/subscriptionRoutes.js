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

const subscriptionPlans = {
  trial: {
    name: "Free Trial",
    duration: 14,
    price: 0,
    smsMonthlyLimit: 100,
    whatsappMonthlyLimit: 50,
    features: ['Dashboard', 'Student Management', 'Fee Collection', 'Attendance', '100 SMS + 50 WhatsApp'],
    recommended: false,
    priority: 1
  },

  // SMS ONLY PLANS
  sms_basic_monthly: {
    name: "Basic Monthly (SMS Pack)",
    price: 950,
    duration: 30,
    smsMonthlyLimit: 1000,
    whatsappMonthlyLimit: 0,
    features: ['All Basic Features', '1000 SMS/month', 'Student Management', 'Fee Collection', 'Attendance'],
    savings: 0,
    recommended: false,
    priority: 2,
    channel: 'sms'
  },
  sms_basic_yearly: {
    name: "Basic Yearly (SMS Pack)",
    price: 9000,
    originalPrice: 11400,
    duration: 365,
    smsMonthlyLimit: 12000,
    whatsappMonthlyLimit: 0,
    features: ['All Basic Features', '12000 SMS/year', 'Save ₹2400'],
    savings: 2400,
    recommended: true,
    priority: 2,
    channel: 'sms'
  },

  // WHATSAPP ONLY PLANS
  whatsapp_basic_monthly: {
    name: "Basic Monthly (WhatsApp Pack)",
    price: 775,
    duration: 30,
    smsMonthlyLimit: 0,
    whatsappMonthlyLimit: 500,
    features: ['All Basic Features', '500 WhatsApp/month', 'Student Management', 'Fee Collection'],
    savings: 0,
    recommended: false,
    priority: 2,
    channel: 'whatsapp'
  },
  whatsapp_basic_yearly: {
    name: "Basic Yearly (WhatsApp Pack)",
    price: 6900,
    duration: 365,
    smsMonthlyLimit: 0,
    whatsappMonthlyLimit: 6000,
    features: ['All Basic Features', '6000 WhatsApp/year', 'Save ₹2400'],
    savings: 2400,
    recommended: true,
    priority: 2,
    channel: 'whatsapp'
  },

  // BOTH (FULL FEATURES)
  both_basic_monthly: {
    name: "Basic Monthly (SMS + WhatsApp)",
    price: 1025,
    duration: 30,
    smsMonthlyLimit: 1000,
    whatsappMonthlyLimit: 500,
    features: ['1000 SMS + 500 WhatsApp', 'Student Management', 'Fee Collection', 'Attendance'],
    savings: 0,
    recommended: true,
    priority: 2,
    channel: 'both'
  },

  both_basic_yearly: {
    name: "Basic Monthly (SMS + WhatsApp)",
    price: 10000,
    duration: 365,
    smsMonthlyLimit: 12000,
    whatsappMonthlyLimit: 15000,
    features: ['1000 SMS + 500 WhatsApp', 'Student Management', 'Fee Collection', 'Attendance'],
    savings: 0,
    recommended: true,
    priority: 2,
    channel: 'both'
  },
  
  both_premium_monthly: {
    name: "Premium Monthly",
    price: 1500,
    duration: 30,
    smsMonthlyLimit: 5000,
    whatsappMonthlyLimit: 2000,
    features: [
      'Everything in Basic',
      '5000 SMS + 2000 WhatsApp',
      'Student Portal',
      'Assignment Module',
      'Online Result',
      'Parent Login',
      'Homework',
      'Exam Management',
      'Reports & Analytics'
    ],
    savings: 0,
    recommended: true,
    priority: 3,
    channel: 'both'
  },
  both_premium_yearly: {
    name: "Premium Yearly",
    price: 12000,
    originalPrice: 18000,
    duration: 365,
    smsMonthlyLimit: 60000,
    whatsappMonthlyLimit: 24000,
    features: [
      'Everything in Premium Monthly',
      'Save ₹6000',
      'Priority Support',
      'Custom Branding'
    ],
    savings: 6000,
    recommended: true,
    priority: 3,
    channel: 'both'
  }
};


// GET /api/subscriptions/plans — FINAL WORKING CODE
router.get('/plans', authMiddleware, async (req, res) => {
  const school = await School.findById(req.user.schoolId);
  if (!school) return res.status(404).json({ message: 'School not found' });

  const channel = school.preferredChannel; // sms | whatsapp | both

  let plans = {
    trial: { ...subscriptionPlans.trial, value: 'trial' }
  };

  // HAMESHA BASIC DIKHAO (channel ke hisaab se)
  if (channel === 'sms' || channel === 'both') {
    plans.sms_basic_monthly = { ...subscriptionPlans.sms_basic_monthly, value: 'sms_basic_monthly' };
    plans.sms_basic_yearly = { ...subscriptionPlans.sms_basic_yearly, value: 'sms_basic_yearly' };
  }
  if (channel === 'whatsapp' || channel === 'both') {
    plans.whatsapp_basic_monthly = { ...subscriptionPlans.whatsapp_basic_monthly, value: 'whatsapp_basic_monthly' };
    plans.whatsapp_basic_yearly = { ...subscriptionPlans.whatsapp_basic_yearly, value: 'whatsapp_basic_yearly' };
  }

  // PREMIUM HAMESHA DIKHAO — lekin channel ke hisaab se message change
  const premiumMonthly = { ...subscriptionPlans.both_premium_monthly, value: 'both_premium_monthly' };
  const premiumYearly = { ...subscriptionPlans.both_premium_yearly, value: 'both_premium_yearly' };

  if (channel === 'sms') {
    premiumMonthly.name = "Premium Monthly (+WhatsApp Add-on)";
    premiumMonthly.price = 1500 + 75; // + WhatsApp charge
    premiumMonthly.extraNote = "WhatsApp add-on: +₹75/month";
  } else if (channel === 'whatsapp') {
    premiumMonthly.name = "Premium Monthly (+SMS Add-on)";
    premiumMonthly.price = 1500 + 250; // + SMS charge
    premiumMonthly.extraNote = "SMS add-on: +₹250/month";
  } else {
    premiumMonthly.extraNote = "Includes both SMS + WhatsApp";
  }

  plans.both_premium_monthly = premiumMonthly;
  plans.both_premium_yearly = premiumYearly;

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
  try {
    const now = new Date();
    const schoolId = req.user.schoolId;

    // 1. FIND ALL ACTIVE SUBSCRIPTIONS (including grace)
    let subscriptions = await Subscription.find({
      schoolId,
      status: { $in: ['active', 'pending', 'grace_period'] },
      expiresAt: { $gt: now }
    }).sort({ priority: -1, expiresAt: 1 }); // Highest priority first

    let subscription = null;
    let nextPlan = null;

    // 2. IF NO SUBSCRIPTION → CHECK FOR TRIAL
    if (!subscriptions.length) {
      const school = await School.findById(schoolId);
      const isNewSchool = new Date(school.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      if (isNewSchool) {
        const trialSubscription = new Subscription({
          schoolId,
          planType: 'trial',
          name: 'Free Trial',
          status: 'active',
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          durationDays: 14,
          originalAmount: 0,
          discountAmount: 0,
          finalAmount: 0,
          priority: 1,
          messageLimits: {
            smsMonthly: subscriptionPlans.trial.smsMonthlyLimit,
            whatsappMonthly: subscriptionPlans.trial.whatsappMonthlyLimit
          },
          usageStats: {
            smsUsedThisMonth: 0,
            whatsappUsedThisMonth: 0,
            lastResetDate: new Date()
          },
          features: subscriptionPlans.trial.features,
          testMode: process.env.TEST_MODE === 'true'
        });

        await trialSubscription.save();
        subscriptions = [trialSubscription];
      } else {
        return res.json({
          subscriptionStatus: 'none',
          message: 'No active plan',
          eligibleForTrial: false
        });
      }
    }

    // 3. GET CURRENT (HIGHEST PRIORITY)
    subscription = subscriptions[0];
    await checkAndResetUsage(subscription);

    // 4. HANDLE GRACE PERIOD
    if (subscription.status === 'active' && subscription.expiresAt < now) {
      subscription.status = 'grace_period';
      subscription.gracePeriodEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await subscription.save();
    }

    if (subscription.status === 'grace_period' && subscription.gracePeriodEnds < now) {
      subscription.status = 'expired';
      await subscription.save();
      // Re-query active subs
      subscriptions = await Subscription.find({
        schoolId,
        status: 'active',
        expiresAt: { $gt: now }
      }).sort({ priority: -1 });
      if (subscriptions.length) {
        subscription = subscriptions[0];
      } else {
        return res.json({ subscriptionStatus: 'expired' });
      }
    }

    // 5. FIND NEXT PLAN (after current expires)
    const remainingSubs = subscriptions.slice(1);
    if (remainingSubs.length > 0) {
      const next = remainingSubs[0];
      nextPlan = `${next.name} (from ${new Date(next.startsAt).toLocaleDateString('en-IN')})`;
    }

    // 6. GET PLAN DETAILS
    // const planDetails = getPlanDetails(subscription.planType) || subscriptionPlans[subscription.planType];
      const planDetails = getPlanDetails(subscription.planType);
      if (!planDetails) {
        console.error('Plan not found:', subscription.planType);
        return res.status(500).json({ message: 'Plan config missing' });
      }

    const smsRemaining = subscription.messageLimits.smsMonthly - subscription.usageStats.smsUsedThisMonth;
    const whatsappRemaining = subscription.messageLimits.whatsappMonthly - subscription.usageStats.whatsappUsedThisMonth;

    // 7. RETURN RESPONSE
    res.json({
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
      autoRenew: subscription.autoRenew,
      testMode: subscription.testMode || false,
      nextPlan,
      messageDetails: {
        sms: {
          monthlyLimit: subscription.messageLimits.smsMonthly,
          usedThisMonth: subscription.usageStats.smsUsedThisMonth,
          remaining: Math.max(0, smsRemaining)
        },
        whatsapp: {
          monthlyLimit: subscription.messageLimits.whatsappMonthly,
          usedThisMonth: subscription.usageStats.whatsappUsedThisMonth,
          remaining: Math.max(0, whatsappRemaining)
        }
      }
    });

  } catch (err) {
    console.error('Subscription /current error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// POST /api/subscriptions/upgrade - Upgrade subscription
router.post('/upgrade', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'superadmin') {
      return res.status(403).json({ message: 'Superadmin cannot upgrade subscriptions' });
    }

    const { planType, paymentMethod, autoRenew = false, upiId, cardDetails } = req.body;
    
    // Validate plan type
    const planDetails = getPlanDetails(planType);
    if (!planDetails) {
      return res.status(400).json({ message: 'Invalid plan type' });
    }

    // Calculate expiration date
    const expiresAt = new Date(Date.now() + planDetails.duration * 24 * 60 * 60 * 1000);

    // Check existing subscription
    const existingSub = await Subscription.findOne({
      schoolId: req.user.schoolId,
      status: { $in: ['active', 'pending', 'grace_period'] }
    });

    if (paymentMethod === 'bank_transfer') {
      const newSubscription = new Subscription({
        schoolId: req.user.schoolId,
        planType,
        status: 'pending',
        startsAt: new Date(),
        expiresAt: expiresAt, // Add this
        paymentMethod,
        durationDays: planDetails.duration,
        originalAmount: planDetails.originalPrice,
        discountAmount: planDetails.originalPrice - planDetails.price,
        finalAmount: planDetails.price,
        autoRenew,
        messageLimits: {
          smsMonthly: planDetails.smsMonthlyLimit,
          whatsappMonthly: planDetails.whatsappMonthlyLimit
        },
        usageStats: {
          students: 0,
          staff: 0,
          storage: 0,
          smsUsedThisMonth: 0,
          whatsappUsedThisMonth: 0,
          lastResetDate: new Date()
        },
        testMode: process.env.TEST_MODE === 'true',
        paymentProof: process.env.TEST_MODE ? 'test-mode-no-payment' : null
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

    // For Razorpay payment
    if (paymentMethod === 'razorpay' || paymentMethod === 'phonepe') {
  // const planDetails = getPlanDetails(planType);
  if (!planDetails) return res.status(400).json({ message: 'Invalid plan' });

 const newSubscription = new Subscription({
  schoolId: req.user.schoolId,
  planType,
  name: planDetails.name,
  status: 'pending',
  startsAt: new Date(),
  expiresAt: new Date(Date.now() + planDetails.duration * 24 * 60 * 60 * 1000),
  durationDays: planDetails.duration,
  originalAmount: planDetails.originalPrice,
  discountAmount: planDetails.originalPrice - planDetails.price,
  finalAmount: planDetails.price,
  autoRenew,
  priority: planDetails.priority,
  paymentMethod: paymentMethod,  // ← ADD THIS
  messageLimits: {
    smsMonthly: planDetails.smsMonthlyLimit,
    whatsappMonthly: planDetails.whatsappMonthlyLimit
  },
  usageStats: {
    smsUsedThisMonth: 0,
    whatsappUsedThisMonth: 0,
    lastResetDate: new Date()
  },
  features: planDetails.features,
  testMode: process.env.TEST_MODE === 'true'
});

  await newSubscription.save();

  let order;
  try {
    order = await rzp.orders.create({
      amount: planDetails.price * 100,
      currency: 'INR',
      receipt: `sub_${newSubscription._id}`
    });
  } catch (err) {
    await Subscription.findByIdAndDelete(newSubscription._id);
    return res.status(500).json({ message: 'Payment failed', error: err.message });
  }

  newSubscription.razorpayOrderId = order.id;
  await newSubscription.save();

  res.json({ order, plan: planDetails, subscriptionId: newSubscription._id });
}
  } catch (err) {
    console.error('Upgrade error:', err);
    res.status(500).json({ message: 'Error initiating upgrade', error: err.message });
  }
});

// POST /api/subscriptions/verify-payment - Verify Razorpay payment
router.post('/verify-payment', authMiddleware, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, subscriptionId } = req.body;

    console.log('🔍 Verify payload:', { razorpay_order_id, razorpay_payment_id, subscriptionId });  // Log incoming

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !subscriptionId) {
      return res.status(400).json({ message: 'Missing details' });
    }

    // Signature check first (unchanged)
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (generatedSignature !== razorpay_signature) {
      console.error('❌ Signature mismatch');
      return res.status(400).json({ message: 'Invalid signature' });
    }

    // Primary lookup: By subscriptionId (your _id)
    let subscription = await Subscription.findById(subscriptionId);
    if (!subscription) {
      console.error('❌ Sub not found by ID:', subscriptionId);
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Cross-verify order_id (logs if mismatch)
    if (subscription.razorpayOrderId !== razorpay_order_id || subscription.status !== 'pending') {
      console.error('❌ Mismatch:', { 
        expectedOrder: razorpay_order_id, 
        storedOrder: subscription.razorpayOrderId, 
        status: subscription.status 
      });
      return res.status(404).json({ message: 'Subscription mismatch' });
    }

    console.log('✅ Sub found & valid:', subscription._id);

    // Fetch Razorpay order (unchanged)
    const order = await rzp.orders.fetch(razorpay_order_id);

    // Activate sub (unchanged)
    subscription.status = 'active';
    subscription.startsAt = new Date();
    subscription.expiresAt = new Date(Date.now() + subscription.durationDays * 24 * 60 * 60 * 1000);
    subscription.transactionId = razorpay_payment_id;
    subscription.paymentDetails = {
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      amount: order.amount / 100,
      currency: order.currency
    };
    await subscription.save();

    console.log('✅ Activated:', subscription._id);

    res.status(200).json({ /* unchanged */ });
  } catch (err) {
    console.error('❌ Verify error:', err);
    res.status(500).json({ message: 'Verification failed', error: err.message });
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

        // ←←← THIS IS THE MISSING LINE (FIXED!)
        await school.findByIdAndUpdate(subscription.schoolId, {
          $set: {
            smsPackActive: true,
            remainingSms: subscription.messageLimits.smsMonthly || 1000,
            smsExpiry: subscription.expiresAt,
            smsPlan: subscription.planType
          }
        });

        logger.info(`SMS pack activated for school ${subscription.schoolId} via webhook`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    logger.error('Webhook error:', err);
    res.status(500).json({ message: 'Failed' });
  }
});

// POST /api/subscriptions/approve-bank-transfer
// router.post('/approve-bank-transfer', authMiddleware, async (req, res) => {
//   try {
//     if (req.user.role !== 'superadmin') {
//       return res.status(403).json({ message: 'Only super admin can approve bank transfers' });
//     }

//     const { subscriptionId } = req.body;

//     if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
//       return res.status(400).json({ message: 'Invalid subscription ID' });
//     }

//     const subscription = await Subscription.findById(subscriptionId);
//     if (!subscription || subscription.paymentMethod !== 'bank_transfer' || subscription.status !== 'pending') {
//       return res.status(400).json({ message: 'Invalid or non-pending bank transfer subscription' });
//     }

//     subscription.status = 'active';
//     subscription.startsAt = new Date();
//     subscription.paymentProof = subscription.testMode ? 'test-mode-approved' : 'manually-approved';
//     await subscription.save();

//     res.status(200).json({
//       message: 'Bank transfer subscription approved and activated',
//       subscription: {
//         schoolId: subscription.schoolId,
//         planType: subscription.planType,
//         status: subscription.status,
//         messageLimits: subscription.messageLimits
//       }
//     });
//   } catch (err) {
//     res.status(500).json({ message: 'Error approving bank transfer', error: err.message });
//   }
// });

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

function getPlanDetails(planType) {
  // Handle trial
  if (planType === 'trial') {
    return {
      ...subscriptionPlans.trial,
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
  
  if (subscriptionPlans[key]) {
    return {
      ...subscriptionPlans[key],
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