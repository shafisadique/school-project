const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../../../models/user');
const School = require('../../../models/school');
const AcademicYear = require('../../../models/academicyear');

const registerSchool = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      const { schoolName, address, adminName, username, email, password } = req.body;

      // Validate required fields
      const requiredFields = ['schoolName', 'adminName', 'username', 'email', 'password', 'address'];
      const missingFields = requiredFields.filter(field => !req.body[field]);
      
      if (missingFields.length > 0) {
        throw { status: 400, message: 'Missing required fields', missing: missingFields };
      }

      // Check for existing entities
      const [existingUser, existingSchool] = await Promise.all([
        User.findOne({ $or: [{ email }, { username }] }).session(session),
        School.findOne({ name: schoolName }).session(session)
      ]);

      if (existingUser || existingSchool) {
        throw { 
          status: 409, 
          message: existingUser ? 'Email/username exists' : 'School name exists' 
        };
      }

      // Create school first
      const newSchool = new School({
        name: schoolName,
        address
      });

      // Create academic year
      const defaultYear = new AcademicYear({
        schoolId: newSchool._id,
        name: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
        startDate: new Date(new Date().getFullYear(), 2, 1),
        endDate: new Date(new Date().getFullYear() + 1, 1, 28)
      });

      // Create admin user
      const adminUser = new User({
        name: adminName,
        username,
        email,
        password: bcrypt.hashSync(password, 10),
        role: 'admin',
        schoolId: newSchool._id
      });

      // Link relationships
      newSchool.activeAcademicYear = defaultYear._id;
      newSchool.createdBy = adminUser._id;

      // Save all documents
      await newSchool.save({ session });
      await adminUser.save({ session });
      await defaultYear.save({ session });

      res.status(201).json({
        message: 'Registration successful',
        data: {
          schoolId: newSchool._id,
          academicYear: defaultYear.name
        }
      });
    });
  } catch (err) {
    console.error('Registration Error:', err);
    const status = err.status || 500;
    const message = err.message || 'Registration failed';
    res.status(status).json({ 
      message,
      error: process.env.NODE_ENV === 'development' ? err : undefined
    });
  } finally {
    await session.endSession();
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
      data: {
        ...school.toObject(),
        address: JSON.parse(school.address)
      }
    });
  } catch (err) {
    res.status(500).json({
      message: 'Failed to fetch school details',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};
// Keep getSchoolById as previous
module.exports = { registerSchool, getSchoolById };