const School = require('../../models/school');
const mongoose = require('mongoose'); // ✅ Add this line

// ✅ Add a new school
const addSchool = async (req, res) => {
  const { name, address, contactEmail, contactPhone } = req.body;

  try {
    const school = new School({ 
      name, 
      address, 
      contactEmail, 
      contactPhone, 
      createdBy: req.user._id 
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
    const schools = await School.find();
    res.status(200).json(schools);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching schools', error: err.message });
  }
};

// ✅ Get a single school by ID
const getSchoolById = async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }
    res.status(200).json(school);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching school', error: err.message });
  }
};

// ✅ Get School By User ID
const getSchoolByUser = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const school = await School.findOne({ createdBy: userId });
    if (!school) {
      return res.status(404).json({ message: 'School not found for this user' });
    }

    res.status(200).json(school);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch school details', error: err.message });
  }
};

// ✅ Update School
const updateSchool = async (req, res) => {
  try {
    const { schoolName, address, contact, academicYear } = req.body;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'School ID is required' });
    }

    const updatedSchool = await School.findByIdAndUpdate(
      id,
      { name: schoolName, address, contact, academicYear },
      { new: true, runValidators: true }
    );

    if (!updatedSchool) {
      return res.status(404).json({ message: 'School not found' });
    }

    res.status(200).json({ message: 'School updated successfully', updatedSchool });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update school', error: err.message });
  }
};

// ✅ Set Academic Year
const setAcademicYear = async (req, res) => {
  try {
    const { schoolId, academicYear } = req.body;

    if (!schoolId || !academicYear) {
      return res.status(400).json({ message: 'schoolId and academicYear are required' });
    }

    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    school.academicYear = academicYear;
    await school.save();

    res.status(200).json({ message: 'Academic year updated', academicYear });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update academic year', error: err.message });
  }
};

// ✅ Upload School Logo
const uploadSchoolLogo = async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ Validate if `id` is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid School ID' });
    }

    // ✅ Check if file is uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // ✅ Find school by ID
    const school = await School.findById(id);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    // ✅ Update logo path
    school.logo = req.file.path;
    await school.save();

    res.status(200).json({ message: 'Logo uploaded successfully', logo: req.file.path });
  } catch (err) {
    res.status(500).json({ message: 'Error uploading logo', error: err.message });
  }
};

module.exports = { 
  addSchool, 
  getSchoolByUser,
  getSchools, 
  getSchoolById,
  updateSchool,
  setAcademicYear,
  uploadSchoolLogo
};
