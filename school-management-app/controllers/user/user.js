const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../../models/user');
const nodemailer = require('nodemailer');
const teacherSchema = require('../../models/teacher');

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
    console.log('here we reached')
    const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
    console.log('here we reached,',resetUrl)
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

    // Ensure requestedUserId is a valid ObjectId
    const { isValidObjectId } = require('mongoose');
    if (!isValidObjectId(requestedUserId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Check if the user is authorized: must be requesting their own profile or be an admin
    if (req.user.id !== requestedUserId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: You can only view your own profile or must be an admin' });
    }

    // Fetch the user with selected fields
    const user = await User.findById(requestedUserId).select('name email username additionalInfo role schoolId').lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Initialize response data
    let responseData = { ...user };

    // If the user is a teacher, fetch additional teacher data
    if (user.role === 'teacher') {
      const teacher = await teacherSchema.findOne({ userId: requestedUserId, schoolId: user.schoolId })
        .select('name email phone designation gender subjects schoolId academicYearId profileImage status')
        .populate('subjects', 'name code') // Populate subject details
        .populate('schoolId', 'name') // Populate school name
        .populate('academicYearId', 'year') // Populate academic year
        .lean();

      if (!teacher) {
        return res.status(404).json({ message: 'Teacher profile not found' });
      }

      // Merge teacher data into the response
      responseData = {
        ...responseData,
        teacherDetails: {
          phone: teacher.phone,
          designation: teacher.designation,
          gender: teacher.gender,
          subjects: teacher.subjects,
          school: teacher.schoolId,
          academicYear: teacher.academicYearId,
          profileImage: teacher.profileImage,
          status: teacher.status
        }
      };
    }

    res.status(200).json({ message: 'Profile retrieved successfully', data: responseData });
  } catch (err) {
    console.error('Error in getProfile:', err);
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