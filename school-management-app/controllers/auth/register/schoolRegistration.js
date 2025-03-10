const bcrypt = require('bcryptjs');
const User = require('../../../models/user');
const School = require('../../../models/school');

const registerSchool = async (req, res) => {
  const { 
    schoolName,
    address,
    adminName,
    username,
    email,
    password
  } = req.body;

  try {
    // Validate request
    const requiredFields = [
      'schoolName', 'adminName', 'username', 
      'email', 'password', 'address'
    ];
    
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        message: 'Missing required fields',
        missing: missingFields
      });
    }

    // Check existing users/schools
    const [existingUser, existingSchool] = await Promise.all([
      User.findOne({ $or: [{ email }, { username }] }),
      School.findOne({ name: schoolName })
    ]);

    if (existingUser) {
      return res.status(409).json({ message: 'Email or username already exists' });
    }

    if (existingSchool) {
      return res.status(409).json({ message: 'School name already registered' });
    }

    // Create school first
    const newSchool = new School({
      name: schoolName,
      address
    });

    // Create admin user
    const hashedPassword = bcrypt.hashSync(password, 10);
    const adminUser = new User({
      name: adminName,
      username,
      email,
      password: hashedPassword,
      role: 'admin',
      schoolId: newSchool._id
    });

    // Link school to admin
    newSchool.createdBy = adminUser._id;

    // Save both in transaction
    await Promise.all([newSchool.save(), adminUser.save()]);

    // Return response
    const response = {
      school: {
        id: newSchool.schoolId,
        name: newSchool.name,
        address: newSchool.address
      },
      admin: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        username: adminUser.username
      }
    };

    res.status(201).json({
      message: 'School registration successful',
      data: response
    });

  } catch (err) {
    res.status(500).json({ 
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal error'
    });
  }
};

const getSchoolById = async (req, res) => {
  try {
    const schoolId = req.params.id;
    
    // Check if schoolId is valid
    if (!schoolId) {
      return res.status(400).json({ message: 'School ID is required' });
    }

    // Find school by ID
    const school = await School.findById(schoolId);
    
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    res.status(200).json({ 
      message: 'School details retrieved successfully',
      school 
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Failed to fetch school details', 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

module.exports = getSchoolById;
module.exports = registerSchool;