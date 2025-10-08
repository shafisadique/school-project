const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../../../models/user');
const School = require('../../../models/school');
const AcademicYear = require('../../../models/academicyear');
const auditLogs = require('../../../models/auditLogs');
const PendingSchool = require('../../../models/pendingSchool');
const Notification = require('../../../models/notifiation');
const notificationService = require('../../../services/notificationService')
const subscriptionSchema = require('../../../models/subscription');

const registerSchool = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const {
        schoolName,
        adminName,
        username,
        email,
        mobileNo,
        address,
        latitude,
        longitude,
        preferredChannel,
        whatsappOptIn,
        pendingSchoolId
      } = req.body;

      console.log('Received data:', { schoolName, adminName, username, email, mobileNo, preferredChannel, whatsappOptIn, latitude, longitude });

      // Validate user session
      if (!req.user || !req.user.id) {
        throw { status: 401, message: 'Unauthorized: Invalid user session' };
      }

      // Log superadmin ID for debugging
      console.log('Superadmin ID:', req.user.id);

      // Validate pending school request if provided
      let pendingSchool = null;
      if (pendingSchoolId) {
        pendingSchool = await PendingSchool.findById(pendingSchoolId).session(session);
        if (!pendingSchool || pendingSchool.status !== 'approved') {
          throw { status: 400, message: 'Invalid or unapproved pending school request' };
        }
      }

      // Validate required fields
      const requiredFields = ['schoolName', 'adminName', 'username', 'email', 'mobileNo', 'address', 'latitude', 'longitude', 'preferredChannel'];
      const missingFields = requiredFields.filter(field => !req.body[field]);
      if (missingFields.length > 0) {
        throw { status: 400, message: `Missing required fields: ${missingFields.join(', ')}` };
      }

      // Validate latitude and longitude
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw { status: 400, message: 'Latitude and longitude must be valid numbers' };
      }

      // Validate mobileNo
      if (!/^\+?[1-9]\d{9,14}$/.test(mobileNo)) {
        throw { status: 400, message: 'Invalid mobile number format. Use +<country code><number> (e.g., +919876543210)' };
      }

      // Normalize mobileNo to E.164
      let normalizedMobileNo = mobileNo;
      if (!mobileNo.startsWith('+')) {
        normalizedMobileNo = `+91${mobileNo}`; // Assume India
      }

      // Validate preferredChannel
      if (!['sms', 'whatsapp', 'both'].includes(preferredChannel)) {
        throw { status: 400, message: 'Invalid preferred channel' };
      }

      // Validate and structure address
      if (!address.street || !address.city || !address.state || !address.country || !address.postalCode) {
        throw { status: 400, message: 'Address must include street, city, state, country, and postalCode' };
      }
      const addressObj = {
        street: address.street,
        city: address.city,
        state: address.state,
        country: address.country,
        postalCode: address.postalCode
      };

      // Check for existing entities
      const [existingUser, existingSchool] = await Promise.all([
        User.findOne({ $or: [{ email }, { username }] }).session(session),
        School.findOne({ name: schoolName }).session(session)
      ]);

      if (existingUser || existingSchool) {
        throw {
          status: 409,
          message: existingUser ? 'Email or username already exists' : 'School name already exists'
        };
      }

      // Create school
      const newSchool = new School({
        name: schoolName,
        address: addressObj,
        mobileNo: normalizedMobileNo,
        email,
        latitude,
        longitude,
        radius: 100,
        preferredChannel,
        createdBy: null
      });

      // Create academic year
      const defaultYear = new AcademicYear({
        schoolId: newSchool._id,
        name: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        startDate: new Date(new Date().getFullYear(), 2, 1),
        endDate: new Date(new Date().getFullYear() + 1, 1, 28),
        isActive: true
      });

      // Generate reset token
      const resetToken = crypto.randomBytes(20).toString('hex');
      const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

      // Create admin user with temporary password
      const tempPassword = crypto.randomBytes(8).toString('hex');
      const adminUser = new User({
        name: adminName,
        username,
        email,
        password: bcrypt.hashSync(tempPassword, 10),
        role: 'admin',
        schoolId: newSchool._id,
        phoneNumber: normalizedMobileNo,
        whatsappNumber: preferredChannel === 'sms' ? null : normalizedMobileNo,
        whatsappOptIn: !!whatsappOptIn,
        resetToken,
        resetTokenExpires,
        status: true
      });

      // Link relationships
      newSchool.activeAcademicYear = defaultYear._id;
      newSchool.createdBy = adminUser._id;

      // Save core documents
      await Promise.all([
        newSchool.save({ session }),
        adminUser.save({ session }),
        defaultYear.save({ session })
      ]);

      // Create trial subscription
      const subscription = new subscriptionSchema({
        schoolId: newSchool._id,
        planType: 'trial',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        durationDays: 30,
        originalAmount: 0,
        discountAmount: 0,
        finalAmount: 0
      });
      await subscription.save({ session });

      // Update pending school if provided
      if (pendingSchoolId) {
        pendingSchool.status = 'completed';
        await pendingSchool.save({ session });
      }

      // Create welcome notification with reset link
      const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
      const welcomeMessage = `
        Welcome to Our School Management System!

        Dear ${adminName},

        Congratulations! Your school, ${schoolName}, has been successfully registered.

        Your login credentials:
        Username: ${username}
        Set your password: ${resetLink}

        You can now manage your school's operations, including attendance, fees, and notifications.

        For assistance, contact our support team at support@example.com.

        Best regards,
        The SchoolSync Team
      `;

      const notification = new Notification({
        schoolId: newSchool._id,
        type: 'welcome',
        title: `Welcome to ${schoolName}!`,
        message: welcomeMessage,
        recipientId: adminUser._id,
        senderId: req.user.id,
        data: {
          loginUrl: resetLink,
          username
        }
      });

      console.log('Notification data:', notification.toObject());
      await notification.save({ session });
      await notificationService.deliver(notification, session); // ✅ Pass session

      // Log school creation
      await new auditLogs({
        userId: req.user.id,
        action: 'create_school',
        details: { schoolId: newSchool._id, schoolName, latitude, longitude, preferredChannel, mobileNo: normalizedMobileNo }
      }).save({ session });

      res.status(201).json({
        message: 'Registration successful',
        data: {
          schoolId: newSchool._id,
          academicYear: defaultYear.name,
          userId: adminUser._id,
          subscriptionId: subscription._id,
          location: { latitude, longitude },
          preferredChannel: newSchool.preferredChannel
        }
      });
    });
  } catch (err) {
    console.error('Registration Error:', err);
    const status = err.status || 500;
    const message = err.message || 'Registration failed';
    res.status(status).json({
      message,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    await session.endSession();
  }
};


const getPendingSchools = async (req, res) => {
  try {
    const pendingSchools = await PendingSchool.aggregate([
      { $match: { status: 'pending' } },
      { $sort: { createdAt: -1 } },
      { $project: { name: 1, email: 1, mobileNo: 1, address: 1, createdAt: 1 } },
    ]);
    res.status(200).json({ message: 'Pending schools retrieved', data: pendingSchools });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching pending schools', error: err.message });
  }
};

const getSchoolById = async (req, res) => {
  try {
    const schoolId = req.params.id;
    
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      return res.status(400).json({ message: 'Invalid school ID format' });
    }

    const school = await School.findById(schoolId)
      .populate('activeAcademicYear')
      .populate('createdBy', 'name email');

    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    res.status(200).json({
      message: 'School details retrieved successfully',
      data: school.toObject() // No need to parse address as it's already an object
    });
  } catch (err) {
    res.status(500).json({
      message: 'Failed to fetch school details',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

const getSubscriptionStats = async (req, res) => {
  try {
    const stats = await subscription.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          planTypes: { $addToSet: '$planType' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.status(200).json({ message: 'Subscription stats retrieved', data: stats });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching stats', error: err.message });
  }
};

module.exports = { registerSchool, getSchoolById,getPendingSchools,getSubscriptionStats };