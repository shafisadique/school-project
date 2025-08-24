const express = require('express');
const { body } = require('express-validator');
const login = require('../controllers/auth/login');
const registerTeacher = require('../controllers/auth/register/teacherRegister');
const registerStudent = require('../controllers/auth/register/studentRegister');
const { registerSchool, getSchoolById } = require('../controllers/auth/register/schoolRegistration');
const { approveSchoolRequest,requestSchool, updateSubscription } =require('../controllers/school/schoolController');
const { changePassword, forgotPassword, resetPassword, getProfile, updateProfile, getUsers, updateUser } = require('../controllers/user/user');
const validateRequest = require('../middleware/validateRequest');
const Payment =require('../models/payment')
const authMiddleware = require('../middleware/authMiddleware');
const { isSuperAdmin } = require('../middleware/roleMiddleware');
const { createPaymentOrder, generateSchoolInvoicePDF, handleWebhook } = require('../controllers/fee/paymentController');
const rateLimiter = require('../middleware/rateLimit');
const router = express.Router();

const paymentLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many webhook requests, please try again later.'
});
// ✅ Login Route
  router.post('/login', login);

// Public endpoint for school requests
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
  router.post('/approve-school-request', isSuperAdmin, validateRequest([
    body('pendingSchoolId').notEmpty().withMessage('Pending school ID is required'),
    body('planType').isIn(['basic', 'premium', 'trial']).withMessage('Invalid plan type')
  ]), approveSchoolRequest);

// ✅ Register School (No Auth Required)
  router.post('/register-school',authMiddleware,isSuperAdmin, validateRequest([
    body('schoolName').notEmpty().withMessage('School name is required'),
    body('adminName').notEmpty().withMessage('Admin name is required'),
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('mobileNo').notEmpty().matches(/^\+?[1-9]\d{9,14}$/).withMessage('Valid mobile number is required'),
    body('address.street').notEmpty().withMessage('Street is required'),
    body('address.city').notEmpty().withMessage('City is required'),
    body('address.state').notEmpty().withMessage('State is required'),
    body('address.country').notEmpty().withMessage('Country is required'),
    body('address.postalCode').notEmpty().withMessage('Postal code is required')
  ]), registerSchool);

  router.post('/payment/create-order', isSuperAdmin, validateRequest([
    body('schoolId').notEmpty().withMessage('School ID is required'),
    body('planType').isIn(['basic', 'premium']).withMessage('Invalid plan type'),
    body('amount').isFloat({ min: 0 }).withMessage('Invalid amount')
  ]), createPaymentOrder);

router.post('/payment/webhook', paymentLimiter, (req, res, next) => {
  handleWebhook(req, res).catch(next);
});

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
  router.get('/school/:id', authMiddleware, getSchoolById);

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

// ✅ Reset Password (Public)
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

router.post('/subscription/update', authMiddleware, isSuperAdmin, validateRequest([
  body('schoolId').notEmpty().withMessage('School ID is required'),
  body('planType').isIn(['trial', 'basic', 'premium']).withMessage('Invalid plan type'),
  body('expiresAt').optional().isISO8601().withMessage('Invalid date format')
]), updateSubscription);



module.exports = router;