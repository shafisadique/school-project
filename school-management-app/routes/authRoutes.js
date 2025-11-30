// routes/auth.js — CLEAN, ORGANIZED & PRODUCTION READY

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

// Middleware
const authMiddleware = require('../middleware/authMiddleware');
const { isSuperAdmin, isAdmin } = require('../middleware/roleMiddleware');
const validateRequest = require('../middleware/validateRequest');
const rateLimiter = require('../middleware/rateLimit');

// Controllers
const login = require('../controllers/auth/login');
const registerTeacher = require('../controllers/auth/register/teacherRegister');
const registerStudent = require('../controllers/auth/register/studentRegister');
const { changePassword, forgotPassword, resetPassword, getProfile, updateProfile } = require('../controllers/user/user');
const { createPaymentOrder, generateSchoolInvoicePDF, handleWebhook } = require('../controllers/fee/paymentController');
const { getSmsStatus, getAnnouncements, createAnnouncement } = require('../controllers/announcements/announcementController');

// Rate limiter for webhook
const webhookLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: 'Too many webhook requests, please try again later.'
});

/* ==================================================================
   1. PUBLIC ROUTES (No Auth Required)
   ================================================================== */
router.post('/login', login);

// Forgot & Reset Password
router.post('/user/forgot-password', 
  validateRequest([body('email').isEmail().withMessage('Valid email required')]),
  forgotPassword
);

router.post('/user/reset-password',
  validateRequest([
    body('token').notEmpty().withMessage('Reset token required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be 6+ chars'),
    body('confirmPassword').custom((val, { req }) => val === req.body.newPassword || 'Passwords do not match')
  ]),
  resetPassword
);

/* ==================================================================
   2. PROTECTED ROUTES (Auth Required)
   ================================================================== */

// Profile
router.get('/user/profile', authMiddleware, getProfile);
router.patch('/user/profile', 
  authMiddleware,
  validateRequest([
    body('name').notEmpty().withMessage('Name required'),
    body('email').isEmail().withMessage('Valid email required')
  ]),
  updateProfile
);

router.patch('/user/change-password',
  authMiddleware,
  validateRequest([
    body('currentPassword').notEmpty().withMessage('Current password required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be 6+ chars'),
    body('confirmPassword').custom((val, { req }) => val === req.body.newPassword || 'Passwords do not match')
  ]),
  changePassword
);

// Register Teacher & Student (Admin Only)
router.post('/register/teacher',
  authMiddleware,
  isAdmin,
  validateRequest([
    body('name').notEmpty().withMessage('Name required'),
    body('username').notEmpty().withMessage('Username required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be 6+ chars'),
    body('schoolId').notEmpty().withMessage('School ID required'),
    body('subjects').isArray({ min: 1 }).withMessage('At least one subject required'),
    body('classes').isArray({ min: 1 }).withMessage('At least one class required')
  ]),
  registerTeacher
);

router.post('/register/student',
  authMiddleware,
  isAdmin,
  validateRequest([
    body('name').notEmpty().withMessage('Name required'),
    body('username').notEmpty().withMessage('Username required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be 6+ chars'),
    body('schoolId').notEmpty().withMessage('School ID required'),
    body('className').notEmpty().withMessage('Class required'),
    body('rollNumber').notEmpty().withMessage('Roll number required')
  ]),
  registerStudent
);

/* ==================================================================
   3. ANNOUNCEMENTS (Admin Create, All Can Read)
   ================================================================== */
router.post('/announcements',
  authMiddleware,
  isAdmin,
  validateRequest([
    body('title')
      .notEmpty().withMessage('Title is required')
      .trim()
      .isLength({ max: 200 }).withMessage('Title too long'),

    body('body')
      .notEmpty().withMessage('Message is required')
      .trim()
      .isLength({ max: 2000 }).withMessage('Message too long'),

    // YE LINE SABSE ZAROORI — AB ROLE YA USER MEIN SE EK ZAROORI HAI
    body().custom((_, { req }) => {
      const hasRoles = Array.isArray(req.body.targetRoles) && req.body.targetRoles.length > 0;
      const hasUsers = Array.isArray(req.body.targetUsers) && req.body.targetUsers.length > 0;
      
      if (!hasRoles && !hasUsers) {
        throw new Error('Please select at least one recipient (role or specific users)');
      }
      return true;
    })
  ]),
  createAnnouncement
);

router.get('/announcements', authMiddleware, getAnnouncements);

/* ==================================================================
   4. PAYMENT & INVOICE (SuperAdmin Only)
   ================================================================== */
router.post('/payment/webhook', webhookLimiter, (req, res, next) => 
  handleWebhook(req, res).catch(next)
);

router.get('/payment/invoice/:id', authMiddleware, isSuperAdmin, generateSchoolInvoicePDF);

/* ==================================================================
   5. SMS STATUS (Admin Dashboard)
   ================================================================== */
router.get('/subscription/sms-status', authMiddleware, isAdmin, getSmsStatus);

module.exports = router;