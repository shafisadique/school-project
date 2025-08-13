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

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: './uploads/payment-proofs/',
  filename: (req, file, cb) => {
    cb(null, `proof-${req.user.schoolId}-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images and PDFs are allowed'));
  }
});

// POST /api/subscriptions/approve-bank-transfer (Superadmin only)
router.post('/approve-bank-transfer', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmins can approve payments' });
    }

    const { subscriptionId, approve } = req.body;
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription || subscription.status !== 'pending' || subscription.paymentMethod !== 'bank_transfer') {
      return res.status(404).json({ message: 'Invalid or non-pending bank transfer subscription' });
    }

    if (approve) {
      subscription.status = 'active';
      subscription.expiresAt = new Date(Date.now() + subscription.durationDays * 24 * 60 * 60 * 1000);
      subscription.updatedAt = new Date();
    } else {
      subscription.status = 'expired';
      subscription.paymentProof = null;
    }
    await subscription.save();

    res.status(200).json({ message: approve ? 'Subscription approved' : 'Subscription rejected' });
  } catch (err) {
    res.status(500).json({ message: 'Error processing approval', error: err.message });
  }
});

// GET /api/subscriptions/current
router.get('/current', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'superadmin') {
      return res.status(200).json({ message: 'Superadmin has unlimited access', subscriptionStatus: 'unlimited' });
    }

    const subscription = await Subscription.findOne({
      schoolId: req.user.schoolId,
      status: { $in: ['active', 'pending'] }
    }).select('planType expiresAt daysToExpire status paymentMethod paymentProof');

    if (!subscription) {
      return res.status(404).json({ message: 'No active or pending subscription found', subscriptionStatus: 'none' });
    }

    const isExpired = subscription.status === 'active' && subscription.expiresAt < new Date();
    if (isExpired) {
      subscription.status = 'expired';
      await subscription.save();
    }

    res.status(200).json({
      planType: subscription.planType,
      expiresAt: subscription.expiresAt,
      daysToExpire: subscription.daysToExpire,
      isExpiringSoon: subscription.daysToExpire < 10 && subscription.daysToExpire > 0,
      subscriptionStatus: subscription.status,
      paymentMethod: subscription.paymentMethod,
      paymentProof: subscription.paymentProof
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching subscription', error: err.message });
  }
});

// POST /api/subscriptions/upgrade
router.post('/upgrade', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'superadmin') {
      return res.status(403).json({ message: 'Superadmin cannot upgrade subscriptions' });
    }

    const { planType, paymentMethod } = req.body;
    if (!['basic', 'premium'].includes(planType)) {
      return res.status(400).json({ message: 'Invalid plan type' });
    }
    if (!['razorpay', 'phonepe', 'bank_transfer'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    const currentSub = await Subscription.findOne({
      schoolId: req.user.schoolId,
      status: { $in: ['active', 'pending', 'expired'] }
    });
    if (!currentSub) {
      return res.status(404).json({ message: 'No subscription to upgrade' });
    }

    const plans = {
      basic: { amount: 50000, durationDays: 365 }, // ₹500, 1 year (in paise)
      premium: { amount: 100000, durationDays: 365 } // ₹1000, 1 year
    };
    const { amount, durationDays } = plans[planType];

    if (paymentMethod === 'bank_transfer') {
      // Update subscription to pending
      currentSub.planType = planType;
      currentSub.paymentMethod = 'bank_transfer';
      currentSub.status = 'pending';
      currentSub.updatedAt = new Date();
      await currentSub.save();

      // Return bank details
      return res.status(200).json({
        message: 'Bank transfer initiated. Please upload payment proof.',
        bankDetails: {
          accountName: 'School Management Ltd',
          accountNumber: '1234567890123456',
          ifscCode: 'SBIN0001234',
          bankName: 'State Bank of India',
          branch: 'Main Branch'
        },
        subscriptionId: currentSub._id
      });
    }

    // Razorpay or PhonePe (UPI)
    const order = await rzp.orders.create({
      amount,
      currency: 'INR',
      receipt: `sub_${currentSub._id}`,
      notes: { schoolId: req.user.schoolId.toString(), planType, durationDays, paymentMethod }
    });

    res.status(200).json({ order });
  } catch (err) {
    res.status(500).json({ message: 'Error initiating upgrade', error: err.message });
  }
});

// POST /api/subscriptions/upload-proof
router.post('/upload-proof', authMiddleware, upload.single('paymentProof'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const subscription = await Subscription.findOne({
      schoolId: req.user.schoolId,
      status: 'pending',
      paymentMethod: 'bank_transfer'
    });
    if (!subscription) {
      return res.status(404).json({ message: 'No pending bank transfer subscription found' });
    }

    subscription.paymentProof = `/uploads/payment-proofs/${req.file.filename}`;
    await subscription.save();

    res.status(200).json({ message: 'Payment proof uploaded. Awaiting verification.' });
  } catch (err) {
    res.status(500).json({ message: 'Error uploading payment proof', error: err.message });
  }
});

// POST /api/subscriptions/verify (for Razorpay/PhonePe)
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const order = await rzp.orders.fetch(razorpay_order_id);
    const { schoolId, planType, durationDays, paymentMethod } = order.notes;

    const subscription = await Subscription.findOneAndUpdate(
      { schoolId, status: { $in: ['active', 'expired', 'pending'] } },
      {
        planType,
        status: 'active',
        paymentMethod,
        expiresAt: new Date(Date.now() + Number(durationDays) * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        paymentProof: null
      },
      { new: true }
    );

    res.status(200).json({ message: 'Subscription upgraded successfully', subscription });
  } catch (err) {
    res.status(500).json({ message: 'Error verifying payment', error: err.message });
  }
});

module.exports = router;