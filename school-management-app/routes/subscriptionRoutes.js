const express = require('express');
const router = express.Router();
const Subscription = require('../models/subscription');
const Razorpay = require('razorpay');
const authMiddleware = require('../middleware/authMiddleware');
const crypto = require('crypto');
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
      smsMonthlyLimit: 5,
      whatsappMonthlyLimit: 5,
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
        smsMonthlyLimit: 10,  // Low for testing; change to 1000 in prod
        whatsappMonthlyLimit: 10,
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
        smsMonthlyLimit: 10,  // Same monthly limit; change to 1000 in prod
        whatsappMonthlyLimit: 10,
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
        smsMonthlyLimit: 30,  // Low for testing; change to 3000 in prod
        whatsappMonthlyLimit: 30,
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
      price: 1, // Temporarily set to 1 INR for testing
      originalPrice: 14400,
      duration: 365,
      smsMonthlyLimit: 30,
      whatsappMonthlyLimit: 30,
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
    if (req.user.role === 'superadmin') {
      return res.status(200).json({
        message: 'Superadmin has unlimited access',
        subscriptionStatus: 'unlimited',
        plan: { name: 'Super Admin', features: ['All features', 'Unlimited access'] }
      });
    }

    let subscription = await Subscription.findOne({
      schoolId: req.user.schoolId,
      status: { $in: ['active', 'pending', 'grace_period'] }
    });

    if (!subscription) {
      const school = await School.findById(req.user.schoolId);
      const isNewSchool = new Date(school.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      if (isNewSchool) {
        const trialSubscription = new Subscription({
          schoolId: req.user.schoolId,
          planType: 'trial',
          status: 'active',
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          durationDays: 14,
          originalAmount: 0,
          discountAmount: 0,
          finalAmount: 0,
          messageLimits: {
            smsMonthly: subscriptionPlans.trial.smsMonthlyLimit,
            whatsappMonthly: subscriptionPlans.trial.whatsappMonthlyLimit
          },
          usageStats: {
            students: 0,
            staff: 0,
            storage: 0,
            smsUsedThisMonth: 0,
            whatsappUsedThisMonth: 0,
            lastResetDate: new Date()
          },
          testMode: process.env.TEST_MODE === 'true'
        });

        await trialSubscription.save();
        subscription = trialSubscription;
      } else {
        return res.status(404).json({
          message: 'No active subscription found',
          subscriptionStatus: 'none',
          eligibleForTrial: isNewSchool,
          messageDetails: {
            sms: { monthlyLimit: 0, usedThisMonth: 0, remaining: 0 },
            whatsapp: { monthlyLimit: 0, usedThisMonth: 0, remaining: 0 }
          }
        });
      }
    }

    const now = new Date();
    if (subscription.status === 'active' && subscription.expiresAt < now) {
      subscription.status = 'grace_period';
      subscription.gracePeriodEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await subscription.save();
    }

    if (subscription.status === 'grace_period' && subscription.gracePeriodEnds < now) {
      subscription.status = 'expired';
      await subscription.save();
    }

    await checkAndResetUsage(subscription); // Now defined
    const planDetails = getPlanDetails(subscription.planType);
    const smsRemaining = subscription.messageLimits.smsMonthly - subscription.usageStats.smsUsedThisMonth;
    const whatsappRemaining = subscription.messageLimits.whatsappMonthly - subscription.usageStats.whatsappUsedThisMonth;

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
      autoRenew: subscription.autoRenew,
      testMode: subscription.testMode || false,
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
    res.status(500).json({ message: 'Error fetching subscription', error: err.message });
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
      // Create subscription record first
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
        razorpayOrderId: null, // Will be set after order creation
        testMode: process.env.TEST_MODE === 'true'
      });

      await newSubscription.save();

      // Create Razorpay order
     let order;  // Declare outside try
  try {
    // Create Razorpay order
    order = await rzp.orders.create({
      amount: planDetails.price * 100,
      currency: 'INR',
      receipt: `sub_${newSubscription._id}`,
      notes: { /* unchanged */ }
    });
    console.log(`✅ Razorpay order created: ID=${order.id}, Status=${order.status}`);  // Log success
  } catch (orderErr) {
    console.error('❌ Razorpay order creation FAILED:', orderErr.message || orderErr);  // Catch & log
    // Rollback: Delete the pending sub to avoid orphans
    await Subscription.findByIdAndDelete(newSubscription._id);
    return res.status(500).json({ 
      message: 'Payment gateway error. Please refresh and try again.', 
      error: orderErr.message 
    });
  }

  // Update & save order ID
  try {
    newSubscription.razorpayOrderId = order.id;
    await newSubscription.save();
    console.log(`✅ Subscription updated with Order ID: ${order.id} (Sub ID: ${newSubscription._id})`);  // Confirm save
  } catch (saveErr) {
    console.error('❌ Subscription save after order FAILED:', saveErr.message || saveErr);  // Catch save issues
    // Don't rollback here—order exists, but sub is inconsistent. For now, return error.
    return res.status(500).json({ 
      message: 'Order created but save failed. Contact support with Order ID: ' + order.id 
    });
  }

      // Update subscription with order ID
      // newSubscription.razorpayOrderId = order.id;
      // await newSubscription.save();

      res.status(200).json({
        order,
        plan: planDetails,
        subscriptionId: newSubscription._id
      });
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
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;
    
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(body))
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    const event = body.event;
    const payment = body.payload.payment.entity;

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
        
        console.log(`Subscription ${subscription._id} activated via webhook`);
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

// POST /api/subscriptions/approve-bank-transfer
router.post('/approve-bank-transfer', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only super admin can approve bank transfers' });
    }

    const { subscriptionId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
      return res.status(400).json({ message: 'Invalid subscription ID' });
    }

    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription || subscription.paymentMethod !== 'bank_transfer' || subscription.status !== 'pending') {
      return res.status(400).json({ message: 'Invalid or non-pending bank transfer subscription' });
    }

    subscription.status = 'active';
    subscription.startsAt = new Date();
    subscription.paymentProof = subscription.testMode ? 'test-mode-approved' : 'manually-approved';
    await subscription.save();

    res.status(200).json({
      message: 'Bank transfer subscription approved and activated',
      subscription: {
        schoolId: subscription.schoolId,
        planType: subscription.planType,
        status: subscription.status,
        messageLimits: subscription.messageLimits
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error approving bank transfer', error: err.message });
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