// const bcrypt = require('bcryptjs');
// const mongoose = require('mongoose');
// const User = require('../models/User');
// const logger = require('winston');

// const resetPassword = async (req, res) => {
//   const { token, newPassword } = req.body;

//   try {
//     if (!token || !newPassword) {
//       return res.status(400).json({ message: 'Token and new password are required' });
//     }

//     const user = await User.findOne({
//       resetToken: token,
//       resetTokenExpires: { $gt: Date.now() }
//     });

//     if (!user) {
//       return res.status(400).json({ message: 'Invalid or expired reset token' });
//     }

//     user.password = bcrypt.hashSync(newPassword, 10);
//     user.resetToken = null;
//     user.resetTokenExpires = null;
//     await user.save();

//     logger.info(`Password reset for user ${user._id}`);
//     res.status(200).json({ message: 'Password reset successfully' });
//   } catch (err) {
//     logger.error('Password reset error:', err);
//     res.status(500).json({ message: 'Error resetting password', error: err.message });
//   }
// };

// module.exports = { resetPassword };