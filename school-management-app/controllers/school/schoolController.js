const auditLogs = require('../../models/auditLogs');
const School = require('../../models/school');
const pendingSchool = require('../../models/pendingSchool');
const mongoose = require('mongoose'); // ✅ Added
const User = require('../../models/user'); // Added
const academicyear = require('../../models/academicyear');

// Lazy load Subscription to avoid circular dependency
let SubscriptionModel = null;

const addSchool = async (req, res) => {
  const { name, address, mobileNo, email, contactPerson, website, activeAcademicYear } = req.body;

  try {
    if (!name || !address || !mobileNo || !email || !activeAcademicYear) {
      return res.status(400).json({ message: 'Name, address, mobileNo, email, and activeAcademicYear are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(activeAcademicYear)) {
      return res.status(400).json({ message: 'Invalid activeAcademicYear ID' });
    }

    const existingSchool = await School.findOne({ email });
    if (existingSchool) {
      return res.status(400).json({ message: 'Email is already associated with another school' });
    }

    const academicYear = await AcademicYear.findById(activeAcademicYear);
    if (!academicYear) {
      return res.status(400).json({ message: 'Active academic year not found' });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const school = new School({ 
          name, 
          address,
          mobileNo,
          email,
          contactPerson: contactPerson || {},
          website: website || '',
          activeAcademicYear,
          createdBy: req.user._id,
          status: true
        });

        await school.save({ session });

        // Create a trial subscription automatically
        const SubscriptionModel = require('../../models/subscription');
        const subscription = new SubscriptionModel({
          schoolId: school._id,
          planType: 'trial',
          status: 'active',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30-day trial
        });
        await subscription.save({ session });

        res.status(201).json({ message: 'School added successfully', school, subscription });
      });
    } finally {
      await session.endSession();
    }
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
  const { name, address, adminEmail, adminName } = req.body;

  try {
    // Check if adminEmail exists or create a new user
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      admin = new User({
        name: adminName,
        email: adminEmail,
        role: 'pending-admin',
        password: 'temp_password',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await admin.save();
    } else if (admin.role !== 'pending-admin') {
      return res.status(400).json({ message: 'Email is already associated with another role' });
    }

    // Create school request
    const school = new School({
      name,
      address,
      adminId: admin._id,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await school.save();

    res.status(201).json({ message: 'School request submitted successfully', schoolId: school._id });
  } catch (err) {
    res.status(500).json({ message: 'Error requesting school', error: err.message });
  }
};

const updateSubscription = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { schoolId, planType, expiresAt } = req.body;
      if (!SubscriptionModel) SubscriptionModel = require('../../models/subscription'); // Load only if null

      if (!schoolId || !planType) {
        return res.status(400).json({ message: 'schoolId and planType are required' });
      }

      if (!mongoose.Types.ObjectId.isValid(schoolId)) {
        return res.status(400).json({ message: 'Invalid schoolId' });
      }

      if (!['trial', 'basic', 'premium'].includes(planType)) {
        return res.status(400).json({ message: 'Invalid plan type' });
      }

      const subscription = await SubscriptionModel.findOne({ schoolId }).session(session);
      if (!subscription) {
        return res.status(404).json({ message: 'Subscription not found' });
      }

      subscription.planType = planType;
      subscription.expiresAt = expiresAt ? new Date(expiresAt) : new Date(Date.now() + (planType === 'trial' ? 30 : planType === 'basic' ? 365 : 730) * 24 * 60 * 60 * 1000);
      subscription.status = 'active';
      await subscription.save({ session });

      await new auditLogs({
        userId: req.user.id,
        action: 'update_subscription',
        details: { schoolId, planType, expiresAt: subscription.expiresAt }
      }).save({ session });

      res.status(200).json({ message: 'Subscription updated successfully', subscription });
    });
  } catch (err) {
    console.error('Error updating subscription:', err);
    res.status(err.status || 500).json({ message: err.message || 'Error updating subscription' });
  } finally {
    await session.endSession();
  }
};

const approveSchoolRequest = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { pendingSchoolId, planType } = req.body;
      if (!SubscriptionModel) SubscriptionModel = require('../../models/subscription'); // Load only if null

      const pendingSchoolDoc = await pendingSchool.findById(pendingSchoolId).session(session);
      if (!pendingSchoolDoc || pendingSchoolDoc.status !== 'pending') {
        throw { status: 400, message: 'Invalid or already processed request' };
      }

      // Create School document
      const school = new School({
        name: pendingSchoolDoc.name,
        email: pendingSchoolDoc.email,
        mobileNo: pendingSchoolDoc.mobileNo,
        address: pendingSchoolDoc.address,
        createdBy: req.user.id,
        status: true
      });
      await school.save({ session });

      // Update pending school status
      pendingSchoolDoc.status = 'approved';
      await pendingSchoolDoc.save({ session });

      // Create trial subscription
      const subscription = new SubscriptionModel({
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
        details: { pendingSchoolId, schoolName: pendingSchoolDoc.name, planType, schoolId: school._id }
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
      contact: school.mobileNo,
      academicYear: school.activeAcademicYear ? school.activeAcademicYear.year : '',
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
    const { schoolName, address, mobileNo: contact, email, contactPerson, website, activeAcademicYear, status } = req.body;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid School ID' });
    }

    if (activeAcademicYear && !mongoose.Types.ObjectId.isValid(activeAcademicYear)) {
      return res.status(400).json({ message: 'Invalid AcademicYear ID' });
    }

    const updateData = {
      name: schoolName,
      address,
      mobileNo: contact,
      email,
      contactPerson: contactPerson || undefined,
      website: website || undefined,
      activeAcademicYear: activeAcademicYear || undefined,
      status: status !== undefined ? status : true
    };

    const updatedSchool = await School.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true, context: 'query' }
    );

    if (!updatedSchool) {
      return res.status(404).json({ message: 'School not found' });
    }

    res.status(200).json({ message: 'School updated successfully', school: updatedSchool });
  } catch (err) {
    console.error('Error updating school:', err.message);
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

    school.logo = `/uploads/${req.file.filename}`;
    await school.save();

    const logoUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    console.log('Generated logoUrl:', logoUrl);

    res.status(200).json({ message: 'Logo uploaded successfully', logoUrl });
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

const getSchoolByTeacher = async (req,res)=>{
   try {
    const schoolId = req.params.id;
    if (req.user.schoolId !== schoolId) {
      return res.status(403).json({ message: 'Access denied. You can only view your assigned school.' });
    }

    const school = await School.findById(schoolId).select('weeklyHolidayDay activeAcademicYear name');
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    res.status(200).json(school);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching school data', error: err.message });
  }
}

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
  requestSchool,
  updateSubscription,
  getSchoolByTeacher
};