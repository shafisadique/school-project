// src/routes/user.js (or equivalent)
const express = require('express');
const router = express.Router();
const { changePassword, forgotPassword, resetPassword, getProfile, updateProfile, getUsers, updateUser } = require('../controllers/user/user');
const { isAdmin } = require('../middleware/roleMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

// Protected routes
router.use(authMiddleware);

// User-specific routes (authenticated user can access their own profile)
router.get('/:userId', getProfile); // Allow authenticated user to get their own profile
router.put('/:userId', isAdmin, updateUser); // Admin-only update
router.patch('/change-password', changePassword); // Update password for authenticated user
router.post('/forgot-password', forgotPassword); // Forgot password
router.post('/reset-password', resetPassword); // Reset password

// Admin-only routes
router.get('/', isAdmin, getUsers); // List all users (admin only)

module.exports = router;