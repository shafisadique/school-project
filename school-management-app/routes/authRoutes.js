const express = require('express');
const { body } = require('express-validator');
const login = require('../controllers/auth/login');
const registerTeacher = require('../controllers/auth/register/teacherRegister');
const registerStudent = require('../controllers/auth/register/studentRegister');
const { registerSchool, getSchoolById } = require('../controllers/auth/register/schoolRegistration');
const twilio = require('twilio')
const VerificationSchema = require('../models/verification')
const { approveSchoolRequest, updateSubscription } =require('../controllers/school/schoolController');
const { changePassword, forgotPassword, resetPassword, getProfile, updateProfile, getUsers, updateUser } = require('../controllers/user/user');
const validateRequest = require('../middleware/validateRequest');
const Payment =require('../models/payment')
const authMiddleware = require('../middleware/authMiddleware');
const { isSuperAdmin, isAdmin } = require('../middleware/roleMiddleware');
const { createPaymentOrder, generateSchoolInvoicePDF, handleWebhook } = require('../controllers/fee/paymentController');
const rateLimiter = require('../middleware/rateLimit');
const router = express.Router();
const axios = require('axios');
const { getSmsStatus, getAnnouncements, createAnnouncement } = require('../controllers/announcements/announcementController');

const paymentLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many webhook requests, please try again later.'
});
// ✅ Login Route
  router.post('/login', login);

  // router.post('/request-school', validateRequest([
  //   body('name').notEmpty().withMessage('School name is required'),
  //   body('email').isEmail().withMessage('Valid email is required'),
  //   body('mobileNo').matches(/^\+?[1-9]\d{9,14}$/).withMessage('Valid mobile number is required'),
  //   body('address.street').notEmpty().withMessage('Street is required'),
  //   body('address.city').notEmpty().withMessage('City is required'),
  //   body('address.state').notEmpty().withMessage('State is required'),
  //   body('address.country').notEmpty().withMessage('Country is required'),
  //   body('address.postalCode').notEmpty().withMessage('Postal code is required')
  // ]), requestSchool);

// Superadmin endpoint for approving requests
  // router.post('/approve-school-request', isSuperAdmin, validateRequest([
  //   body('pendingSchoolId').notEmpty().withMessage('Pending school ID is required'),
  //   body('planType').isIn(['basic', 'premium', 'trial']).withMessage('Invalid plan type')
  // ]), approveSchoolRequest);


// ✅ Register School (No Auth Required)
// router.post(
//   '/register-school',
//   authMiddleware,
//   isSuperAdmin,
//   validateRequest([
//     body('schoolName').notEmpty().withMessage('School name is required'),
//     body('adminName').notEmpty().withMessage('Admin name is required'),
//     body('username').notEmpty().withMessage('Username is required'),
//     body('email').isEmail().withMessage('Valid email is required'),
//     body('mobileNo').notEmpty().matches(/^\+?[1-9]\d{9,14}$/).withMessage('Valid mobile number is required'),
//     body('preferredChannel').isIn(['sms', 'whatsapp', 'both']).withMessage('Valid preferred channel is required'),
//     body('whatsappOptIn').isBoolean().withMessage('WhatsApp opt-in must be a boolean'),
//     body('address.street').notEmpty().withMessage('Street is required'),
//     body('address.city').notEmpty().withMessage('City is required'),
//     body('address.state').notEmpty().withMessage('State is required'),
//     body('address.country').notEmpty().withMessage('Country is required'),
//     body('address.postalCode').notEmpty().withMessage('Postal code is required'),
//     body('latitude').isFloat().withMessage('Valid latitude is required'),
//     body('longitude').isFloat().withMessage('Valid longitude is required'),
//     body('isMobileVerified').isBoolean().withMessage('Mobile verification status is required').equals('true').withMessage('Mobile number must be verified')
//   ]),
//   registerSchool
// );

  // router.post('/payment/create-order', isSuperAdmin, validateRequest([
  //   body('schoolId').notEmpty().withMessage('School ID is required'),
  //   body('planType').isIn(['basic', 'premium']).withMessage('Invalid plan type'),
  //   body('amount').isFloat({ min: 0 }).withMessage('Invalid amount')
  // ]), createPaymentOrder);

router.post('/payment/webhook', paymentLimiter, (req, res, next) => {
  handleWebhook(req, res).catch(next);
});

let twilioClient;
try {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,   // ✅ Account SID, not Verify SID
    process.env.TWILIO_AUTH_TOKEN     // ✅ Auth Token
  );

  if (!twilioClient.verify || !twilioClient.verify.v2) {
    throw new Error('Twilio Verify API v2 not available');
  }

  console.log('✅ Twilio client initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Twilio client:', error);
  throw new Error('Twilio client initialization failed');
}


// router.post('/send-otp', async (req, res) => {
//   const { phoneNumber } = req.body;
//   if (!phoneNumber) {
//     return res.status(400).json({ error: 'Phone number is required' });
//   }

//   // Strict validation for phone number
//   const phoneRegex = /^\+?[1-9]\d{9,14}$/;
//   if (!phoneRegex.test(phoneNumber)) {
//     console.log('Invalid phone number format received:', phoneNumber);
//     return res.status(400).json({ error: 'Invalid phone number format. Use +<country code><number> or 10-15 digits (e.g., +919876543210 or 9876543210)' });
//   }

//   try {
   
//     // Normalize phone number to E.164 format
//     let normalizedPhoneNumber = phoneNumber.trim();
//     if (!normalizedPhoneNumber.startsWith('+')) {
//       normalizedPhoneNumber = `+91${normalizedPhoneNumber.replace(/^\+/, '')}`;
//     }

//     // Validate normalized E.164 format
//     if (!/^\+[1-9]\d{10,14}$/.test(normalizedPhoneNumber)) {
//       console.log('Invalid normalized phone number:', normalizedPhoneNumber);
//       return res.status(400).json({ error: 'Phone number must be in E.164 format (e.g., +919876543210)' });
//     }

//     console.log('Sending OTP to normalized phone number:', normalizedPhoneNumber);

//     const verification = await twilioClient.verify.v2
//       .services(process.env.TWILIO_VERIFY_SERVICE_SID)
//       .verifications.create({ to: normalizedPhoneNumber, channel: 'sms' });
     

//     // Save verification record
//     const verificationRecord = new VerificationSchema({
//       phoneNumber: normalizedPhoneNumber,
//       verificationSid: verification.sid,
//       status: 'pending'
//     });
//     await verificationRecord.save();
//     res.json({ success: true, sid: verification.sid });
//   } catch (error) {
//     console.error('Send OTP error:', error);
//     res.status(400).json({ error: error.message, code: error.code, details: error.details });
//   }
// });

// Verify OTP



// router.post('/verify-otp', async (req, res) => {
//   const { phoneNumber, code } = req.body;
//   if (!phoneNumber || !code) {
//     return res.status(400).json({ error: 'Phone number and OTP code required' });
//   }
//   try {
//     const normalizedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
//     const verificationCheck = await twilioClient.verify.v2
//       .services(process.env.TWILIO_VERIFY_SERVICE_SID)
//       .verificationChecks.create({ to: normalizedPhoneNumber, code });
//     if (verificationCheck.status === 'approved') {
//       res.json({ success: true, message: 'Phone number verified' });
//     } else {
//       res.status(400).json({ error: 'Invalid OTP code' });
//     }
//   } catch (error) {
//     console.error('Verify OTP error:', error);
//     res.status(400).json({ error: error.message });
//   }
// });



  router.get('/payment/invoice/:id', isSuperAdmin, generateSchoolInvoicePDF);

// ✅ Register Teacher (Admin Only)
  router.post('/register/teacher', authMiddleware, validateRequest([
    body('name').notEmpty().withMessage('Name is required'),
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('schoolId').notEmpty().withMessage('School ID is required'),
    body('subjects').notEmpty().withMessage('Subjects are required'),
    body('classes').notEmpty().withMessage('Classes are required'),
  ]), registerTeacher);

// ✅ Register Student (Admin Only)
  router.post('/register/student', authMiddleware, validateRequest([
    body('name').notEmpty().withMessage('Name is required'),
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('schoolId').notEmpty().withMessage('School ID is required'),
    body('className').notEmpty().withMessage('Class name is required'),
    body('rollNumber').notEmpty().withMessage('Roll Number is required'),
  ]), registerStudent);

// ✅ Get School by ID (Protected)
  // router.get('/school/:id', authMiddleware, getSchoolById);

// ✅ Change Password (Protected)
router.patch('/user/change-password', authMiddleware, validateRequest([
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
]), changePassword);

// ✅ Forgot Password (Public)
  router.post('/user/forgot-password', validateRequest([
    body('email').isEmail().withMessage('Valid email is required')
  ]), forgotPassword);

router.post('/user/reset-password', validateRequest([
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
]), resetPassword);

// ✅ Get Profile (Protected)
  router.get('/user/profile', authMiddleware, getProfile);

// ✅ Update Profile (Protected)
  router.patch('/user/profile', authMiddleware, validateRequest([
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required')
  ]), updateProfile);

// ✅ Get Users (Admin Only)
router.get('/users', authMiddleware, getUsers);

// ✅ Update User (Admin Only)
router.patch('/user/:userId', authMiddleware, validateRequest([
  body('additionalInfo').optional().isObject().withMessage('Additional info must be an object')
]), updateUser);

// router.post('/subscription/update', authMiddleware, isSuperAdmin, validateRequest([
//   body('schoolId').notEmpty().withMessage('School ID is required'),
//   body('planType').isIn(['trial', 'basic', 'premium']).withMessage('Invalid plan type'),
//   body('expiresAt').optional().isISO8601().withMessage('Invalid date format')
// ]), updateSubscription);




// POST /announcements (Updated Validation)


router.post('/announcements',
  authMiddleware,
  isAdmin,
  validateRequest([
    body('title').notEmpty().withMessage('Title required').isLength({ max: 200 }),
    body('body').notEmpty().withMessage('Body required').isLength({ max: 1000 }),
    // Roles optional if targetUsers provided
    body('roles').optional().isArray({ min: 1 }).withMessage('Roles required (array)').custom((roles, { req }) => {
      if (req.body.targetUsers && req.body.targetUsers.length > 0) return true; // Skip if IDs provided
      if (!roles || !Array.isArray(roles) || roles.length === 0) throw new Error('Roles required');
      return roles.every(r => ['admin', 'teacher', 'parent', 'student'].includes(r));
    }),
    body('targetUsers').optional().isArray({ min: 1 }).withMessage('Target users required (array)')
  ]),
  createAnnouncement
);

// Get Announcements (Any Authenticated User, Filtered by Role/School)
router.get('/announcements',
  authMiddleware,
  getAnnouncements  // ?page=1&limit=10
);

// Get SMS Status (School Admin Only, for Dashboard)
router.get('/subscription/sms-status',
  authMiddleware,
  isAdmin,
  getSmsStatus
);

module.exports = router;