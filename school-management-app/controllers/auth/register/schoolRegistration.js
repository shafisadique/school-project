const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../../../models/user');
const School = require('../../../models/school');
const AcademicYear = require('../../../models/academicyear');
const subscriptionSchema = require('../../../models/subscription');
const auditLogs = require('../../../models/auditLogs');


const registerSchool = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // ✅ FIXED: Extract latitude and longitude from req.body
      const { schoolName, adminName, username, email, password, mobileNo, address, latitude, longitude } = req.body;
      const pendingSchoolId = req.body.pendingSchoolId; // Optional

      console.log('Received data:', { latitude, longitude }); // Debug log

      // Validate user session
      if (!req.user || !req.user.id) {
        throw { status: 401, message: 'Unauthorized: Invalid user session' };
      }

      // Validate pending school request if provided
      let pendingSchool = null;
      if (pendingSchoolId) {
        pendingSchool = await PendingSchool.findById(pendingSchoolId).session(session);
        if (!pendingSchool || pendingSchool.status !== 'approved') {
          throw { status: 400, message: 'Invalid or unapproved pending school request' };
        }
      }

      // Validate required fields
      const requiredFields = ['schoolName', 'adminName', 'username', 'email', 'password', 'mobileNo', 'address', 'latitude', 'longitude'];
      const missingFields = requiredFields.filter(field => !req.body[field]);
      if (missingFields.length > 0) {
        throw { status: 400, message: `Missing required fields: ${missingFields.join(', ')}` };
      }

      // Validate latitude and longitude
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        throw { status: 400, message: 'Latitude and longitude must be valid numbers' };
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
        postalCode: address.postalCode,
      };

      // Check for existing entities
      const [existingUser, existingSchool] = await Promise.all([
        User.findOne({ $or: [{ email }, { username }] }).session(session),
        School.findOne({ name: schoolName }).session(session),
      ]);

      if (existingUser || existingSchool) {
        throw {
          status: 409,
          message: existingUser ? 'Email or username already exists' : 'School name already exists',
        };
      }

      // Create school WITH latitude and longitude
      const newSchool = new School({
        name: schoolName,
        address: addressObj,
        mobileNo,
        email,
        latitude: latitude,        // ✅ Now properly set
        longitude: longitude,      // ✅ Now properly set
        radius: 100,               // Default radius for GPS validation
        createdBy: null, // Will be set after user creation
      });

      console.log('Creating school with location:', { latitude, longitude }); // Debug log

      // Create academic year with isActive: true
      const defaultYear = new AcademicYear({
        schoolId: newSchool._id,
        name: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        startDate: new Date(new Date().getFullYear(), 2, 1), // March 1st
        endDate: new Date(new Date().getFullYear() + 1, 1, 28), // February 28th next year
        isActive: true,
      });

      // Create admin user
      const adminUser = new User({
        name: adminName,
        username,
        email,
        password: bcrypt.hashSync(password, 10),
        role: 'admin',
        schoolId: newSchool._id,
      });

      // Link relationships
      newSchool.activeAcademicYear = defaultYear._id;
      newSchool.createdBy = adminUser._id;

      // Save core documents with logging
      console.log('Saving school:', newSchool._id);
      console.log('Saving user:', adminUser._id);
      console.log('Saving academic year:', defaultYear._id);
      await Promise.all([newSchool.save({ session }), adminUser.save({ session }), defaultYear.save({ session })]);

      // Create trial subscription with required fields
      const subscription = new subscriptionSchema({
        schoolId: newSchool._id,
        planType: 'trial',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        durationDays: 30,
        originalAmount: 0,
        discountAmount: 0,
        finalAmount: 0,
      });
      console.log('Saving subscription:', subscription);
      await subscription.save({ session });

      // Update pending school if provided
      if (pendingSchoolId) {
        pendingSchool.status = 'completed';
        await pendingSchool.save({ session });
      }

      // Log school creation
      await new auditLogs({
        userId: req.user.id,
        action: 'create_school',
        details: { schoolId: newSchool._id, schoolName, latitude, longitude, pendingSchoolId },
      }).save({ session });

      res.status(201).json({
        message: 'Registration successful',
        data: {
          schoolId: newSchool._id,
          academicYear: defaultYear.name,
          userId: adminUser._id,
          subscriptionId: subscription._id,
          location: {
            latitude: latitude,
            longitude: longitude
          }
        },
      });
    });
  } catch (err) {
    console.error('Registration Error:', err);
    const status = err.status || 500;
    const message = err.message || 'Registration failed';
    res.status(status).json({
      message,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
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