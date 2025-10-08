const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const registerParent = require('../controllers/auth/register/parentController');

router.post('/create-parent-portal', authMiddleware, registerParent);

module.exports = router;