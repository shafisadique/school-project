const express = require('express');
const router = express.Router();
const { getUsers, updateUser } = require('../controllers/user/user');
const { isAdmin } = require('../middleware/roleMiddleware');
const authMiddleware = require('../middleware/authMiddleware');


// Protected routes
router.use(authMiddleware);

// Admin-only routes
router.get('/', isAdmin, getUsers);
router.put('/:userId', isAdmin, updateUser);

module.exports = router;