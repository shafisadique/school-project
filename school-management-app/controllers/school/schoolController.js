const auditLogs = require('../../models/auditLogs');
const pendingSchool = require('../../models/pendingSchool');
const School = require('../../models/school');
const mongoose = require('mongoose'); // ✅ Added
const subscription = require('../../models/subscription');

// ✅ Add a new school
const addSchool = async (req, res) => {
  const { name, address, mobileNo, email, contactPerson, website, activeAcademicYear } = req.body;

  try {
    // Validate required fields
    if (!name || !address || !mobileNo || !email || !activeAcademicYear) {
      return res.status(400).json({ message: 'Name, address, mobileNo, email, and activeAcademicYear are required' });
    }

    const school = new School({ 
      name, 
      address,
      mobileNo,
      email,
      contactPerson: contactPerson || {}, // Optional, defaults to empty object
      website: website || '', // Optional
      activeAcademicYear,
      createdBy: req.user._id,
      status: true // Default to active
    });

    await school.save();
    res.status(201).json({ message: 'School added successfully', school });
  } catch (err) {
    res.status(500).json({ message: 'Error adding school', error: err.message });
  }
};

// ✅ Get all schools
const getSchools = async (req, res) => {
  try {
    const schools = await School.find({ status: true }); // Only active schools
    res.status(200).json(schools);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching schools', error: err.message });
  }
};

// ✅ Get a single school by ID
const getSchoolById = async (req, res) => {
  try {
    const school = await School.findById(req.params.id).where('status').equals(true);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }
    res.status(200).json(school);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching school', error: err.message });
  }
};

const requestSchool = async (req, res) => {
  try {
    const { name, email, mobileNo, address } = req.body;
    const pendingSchool = new pendingSchool({ name, email, mobileNo, address });
    await pendingSchool.save();
    res.status(201).json({ message: 'School request submitted', data: { id: pendingSchool._id } });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting request', error: err.message });
  }
};

const approveSchoolRequest = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { pendingSchoolId, planType } = req.body;
      const pendingSchool = await PendingSchool.findById(pendingSchoolId).session(session);
      if (!pendingSchool || pendingSchool.status !== 'pending') {
        throw { status: 400, message: 'Invalid or already processed request' };
      }

      // Create School document
      const school = new School({
        name: pendingSchool.name,
        email: pendingSchool.email,
        mobileNo: pendingSchool.mobileNo,
        address: pendingSchool.address,
        createdBy: req.user.id,
        status: true
      });
      await school.save({ session });

      // Update pending school status
      pendingSchool.status = 'approved';
      await pendingSchool.save({ session });

      // Create trial subscription
      const subscription = new Subscription({
        schoolId: school._id,
        planType: planType || 'trial',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
      await subscription.save({ session });

      // Log approval action
      await new auditLogs({
        userId: req.user.id,
        action: 'approve_school_request',
        details: { pendingSchoolId, schoolName: pendingSchool.name, planType, schoolId: school._id }
      }).save({ session });

      res.status(200).json({ message: 'School request approved', data: { id: pendingSchoolId, schoolId: school._id } });
    });
  } catch (err) {
    console.error('Error approving school request:', err);
    res.status(err.status || 500).json({ message: err.message || 'Error approving request' });
  } finally {
    await session.endSession();
  }
};

// ✅ Get School By User ID
const getSchoolByUser = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Searching for school with createdBy:', userId);
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const school = await School.findOne({ createdBy: userId, status: true }).populate('activeAcademicYear');
    if (!school) {
      return res.status(404).json({ message: 'School not found for this user' });
    }

    res.status(200).json({
      _id: school._id,
      name: school.name,
      address: school.address,
      contact: school.mobileNo, // Match frontend 'contact'
      academicYear: school.activeAcademicYear ? school.activeAcademicYear.year : '', // Adjust if year field exists
      logo: school.logo || ''
    });
  } catch (err) {
    console.error('Error in getSchoolByUser:', err.message);
    res.status(500).json({ message: 'Failed to fetch school details', error: err.message });
  }
};



// ✅ Update School
const updateSchool = async (req, res) => {
  try {
    const { schoolName, address, mobileNo: contact, email, contactPerson, website, activeAcademicYear, status } = req.body; // Map contact to mobileNo
    const { id } = req.params;

    // 1️⃣ Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid School ID' });
    }

    // 2️⃣ Validate academicYear as ObjectId
    if (activeAcademicYear && !mongoose.Types.ObjectId.isValid(activeAcademicYear)) {
      return res.status(400).json({ message: 'Invalid AcademicYear ID' });
    }

    // 3️⃣ Prepare update data
    const updateData = {
      name: schoolName,
      address,
      mobileNo: contact, // Use mobileNo as per schema
      email,
      contactPerson: contactPerson || undefined,
      website: website || undefined,
      activeAcademicYear: activeAcademicYear || undefined,
      status: status !== undefined ? status : true
    };

    // 4️⃣ Update the school
    const updatedSchool = await School.findByIdAndUpdate(
      id,
      { $set: updateData }, // Use $set to update only provided fields
      { new: true, runValidators: true, context: 'query' } // Ensure validators run
    );

    if (!updatedSchool) {
      return res.status(404).json({ message: 'School not found' });
    }

    res.status(200).json({ message: 'School updated successfully', school: updatedSchool });
  } catch (err) {
    console.error('Error updating school:', err.message); // Log the error for debugging
    res.status(500).json({ message: 'Error updating school', error: err.message });
  }
};

// ✅ Set Academic Year
const setAcademicYear = async (req, res) => {
  try {
    const { schoolId, academicYear } = req.body;

    if (!schoolId || !academicYear) {
      return res.status(400).json({ message: 'schoolId and academicYear are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(academicYear)) {
      return res.status(400).json({ message: 'Invalid schoolId or academicYear ID' });
    }

    const school = await School.findById(schoolId).where('status').equals(true);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    school.activeAcademicYear = academicYear;
    await school.save();

    res.status(200).json({ message: 'Academic year updated', academicYear });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update academic year', error: err.message });
  }
};

const uploadSchoolLogo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid School ID' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const maxSize = 2 * 1024 * 1024;
    if (req.file.size > maxSize) {
      return res.status(400).json({ message: 'File too large (max 2MB)' });
    }
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(req.file.mimetype)) {
      return res.status(400).json({ message: 'Only JPEG, JPG, and PNG files are allowed' });
    }

    const school = await School.findById(id).where('status').equals(true);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    school.logo = `/uploads/${req.file.filename}`; // Store relative path
    await school.save();

    const logoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`; // Full URL
    console.log('Generated logoUrl:', logoUrl); // Debug log

    res.status(200).json({ 
      message: 'Logo uploaded successfully', 
      logoUrl: logoUrl 
    });
  } catch (err) {
    console.error('Error uploading logo:', err.message);
    res.status(500).json({ message: 'Error uploading logo', error: err.message });
  }
};

const updateSchoolStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (status === undefined) {
      return res.status(400).json({ message: 'Status is required' });
    }
    const updatedSchool = await School.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!updatedSchool) {
      return res.status(404).json({ message: 'School not found' });
    }
    res.status(200).json({ message: 'School status updated successfully', school: updatedSchool });
  } catch (err) {
    res.status(500).json({ message: 'Error updating school status', error: err.message });
  }
};

module.exports = { 
  addSchool, 
  getSchoolByUser,
  getSchools, 
  getSchoolById,
  updateSchool,
  setAcademicYear,
  uploadSchoolLogo,
  updateSchoolStatus,
  approveSchoolRequest,
  requestSchool
};