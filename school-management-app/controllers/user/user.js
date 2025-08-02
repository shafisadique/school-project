const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../../models/user');
const nodemailer = require('nodemailer');

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = bcrypt.compareSync(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = bcrypt.hashSync(newPassword, 10);
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error changing password', error: err.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User with this email not found' });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from 12:46 PM IST = 1:46 PM IST

    user.resetToken = resetToken;
    user.resetTokenExpires = resetTokenExpires;
    await user.save();

    const resetUrl = `http://your-frontend-url/reset-password?token=${resetToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      html: `<h1>Password Reset</h1><p>Click <a href="${resetUrl}">here</a> to reset your password. Expires at ${resetTokenExpires.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>`
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Password reset link sent to your email' });
  } catch (err) {
    res.status(500).json({ message: 'Error sending reset email', error: err.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpires: { $gt: new Date() }
    });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.password = bcrypt.hashSync(newPassword, 10);
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error resetting password', error: err.message });
  }
};

// src/controllers/user/user.js
const getProfile = async (req, res) => {
  try {
    const requestedUserId = req.params.userId;
    // Check if the requested userId matches the authenticated user or if the user is an admin
    if (req.user.userId !== requestedUserId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    const user = await User.findById(requestedUserId).select('name email username additionalInfo');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'Profile retrieved successfully', data: user });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching profile', error: err.message });
    }
  };
  
const updateProfile = async (req, res) => {
  try {
    const { name, email, additionalInfo } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.name = name;
    user.email = email;
    if (additionalInfo) user.additionalInfo = additionalInfo;
    await user.save();

    res.status(200).json({ message: 'Profile updated successfully', data: user });
  } catch (err) {
    res.status(500).json({ message: 'Error updating profile', error: err.message });
  }
};

const getUsers = async (req, res) => {
  try {
    // Restrict to admin of the school
    if (req.user.role !== 'admin' || req.user.schoolId.toString() !== req.query.schoolId) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    const users = await User.find({ schoolId: req.user.schoolId });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
};

const updateUser = async (req, res) => {
  const { userId } = req.params;
  const { additionalInfo } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the requesting user is an admin of the same school
    if (req.user.role !== 'admin' || user.schoolId.toString() !== req.user.schoolId.toString()) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    user.additionalInfo = additionalInfo || user.additionalInfo;
    await user.save();

    res.status(200).json({ message: 'User updated successfully', user });
  } catch (err) {
    res.status(500).json({ message: 'Error updating user', error: err.message });
  }
};

module.exports = { changePassword, forgotPassword, resetPassword, getProfile, updateProfile, getUsers, updateUser };