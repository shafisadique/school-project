const express = require('express');
const router = express.Router();
const Subscription = require('../models/subscription');
const School = require('../models/School');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

// Superadmin only
router.use(authMiddleware);
router.use((req, res, next) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ message: 'Access denied' });
  next();
});

router.get('/dashboard', async (req, res) => {
  try {
    const schools = await School.find();
    const subs = await Subscription.find({ 
      status: { $in: ['active', 'pending', 'grace_period', 'expired'] } 
    });

    const result = await Promise.all(schools.map(async (school) => {
      // Manually fetch admin
      let adminName = 'Unknown';
      if (school.adminId) {
        const admin = await User.findById(school.adminId).select('name');
        adminName = admin?.name || 'Unknown';
      }

      const sub = subs.find(s => s.schoolId.toString() === school._id.toString()) || {
        planType: 'none', status: 'none', isTrial: false, revenue: 0, daysRemaining: 0
      };

      const daysRemaining = sub.expiresAt 
        ? Math.max(0, Math.ceil((new Date(sub.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        _id: school._id,
        schoolName: school.name,
        adminName,
        planType: sub.planType || 'none',
        status: sub.status || 'none',
        expiresAt: sub.expiresAt,
        daysRemaining,
        isTrial: sub.planType === 'trial',
        revenue: sub.finalAmount || 0,
        createdAt: school.createdAt
      };
    }));

    const stats = {
      totalSchools: schools.length,
      activeTrials: result.filter(s => s.isTrial && s.status === 'active').length,
      activePaid: result.filter(s => !s.isTrial && s.status === 'active').length,
      totalRevenue: subs.reduce((sum, s) => sum + (s.finalAmount || 0), 0)
    };

    res.json({ schools: result, ...stats });
  } catch (err) {
    console.error('Superadmin dashboard error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/activate-trial', async (req, res) => {
  try {
    const { schoolId } = req.body;
    const school = await School.findById(schoolId);
    if (!school) return res.status(404).json({ message: 'School not found' });

    let sub = await Subscription.findOne({ schoolId, status: { $in: ['active', 'pending'] } });
    if (sub) return res.status(400).json({ message: 'Already has subscription' });

    sub = new Subscription({
      schoolId,
      planType: 'trial',
      status: 'active',
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      durationDays: 14,
      finalAmount: 0,
      messageLimits: { smsMonthly: 5, whatsappMonthly: 5 },
      usageStats: { lastResetDate: new Date() },
      testMode: process.env.TEST_MODE === 'true'
    });

    await sub.save();
    res.json({ message: 'Trial activated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;