
const AcademicYear = require('../../models/academicyear');
const School = require('../../models/school');
const Student = require('../../models/student');

// ✅ 1. Create a New Academic Year
const createAcademicYear = async (req, res) => {
  try {
    const { name, startDate, endDate } = req.body;
    const schoolId = req.user.schoolId;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ message: 'Name, startDate, and endDate are required' });
    }

    // Ensure the school exists
    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    // Check if the academic year already exists
    const existingYear = await AcademicYear.findOne({ schoolId, name });
    if (existingYear) {
      return res.status(400).json({ message: 'Academic year already exists' });
    }

    // Create a new academic year
    const newAcademicYear = new AcademicYear({
      schoolId,
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    await newAcademicYear.save();

    res.status(201).json({ message: 'Academic year created successfully', data: newAcademicYear });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ 2. Get All Academic Years for a School
const getAcademicYearsBySchool = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const academicYears = await AcademicYear.find({ schoolId }).sort({ startDate: -1 });
    res.status(200).json(academicYears);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ 3. Set Active Academic Year
const setAcademicYear = async (req, res) => {
  try {
    const { academicYearId } = req.body;
    const schoolId = req.user.schoolId;

    const academicYearDoc = await AcademicYear.findById(academicYearId);
    if (!academicYearDoc) {
      return res.status(404).json({ message: 'Academic year not found' });
    }

    const school = await School.findByIdAndUpdate(
      schoolId,
      { activeAcademicYear: academicYearDoc._id },
      { new: true }
    );

    res.status(200).json({ message: 'Active academic year updated', school });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ 4. Update Active Academic Year
const updateAcademicYear = async (req, res) => {
  try {
    const { schoolId, newAcademicYearId } = req.body;

    const academicYear = await AcademicYear.findById(newAcademicYearId);
    if (!academicYear) {
      return res.status(404).json({ message: 'Academic year not found' });
    }

    await School.findByIdAndUpdate(schoolId, { activeAcademicYear: newAcademicYearId });

    res.status(200).json({ message: 'Academic year updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ 5. Get the Current Active Academic Year
const getActiveAcademicYear = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const school = await School.findById(schoolId)
      .populate('activeAcademicYear')
      .orFail(new Error('School not found'));

    if (!school.activeAcademicYear) {
      return res.status(404).json({ message: 'No active academic year set' });
    }

    res.status(200).json(school.activeAcademicYear);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ 6. Get Student's Past Academic Years
const getStudentAcademicYears = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId).populate('academicYearId');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.status(200).json({ studentName: student.name, academicYears: student.academicYearId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Add this new method to academicYearController.js
const activateAcademicYear = async (req, res) => {
    try {
      const { academicYearId } = req.body;
      const schoolId = req.user.schoolId;
  
      // 1. Deactivate all other years for the school
      await AcademicYear.updateMany(
        { schoolId, _id: { $ne: academicYearId } },
        { $set: { isActive: false } }
      );
  
      // 2. Activate the selected year
      const activatedYear = await AcademicYear.findByIdAndUpdate(
        academicYearId,
        { $set: { isActive: true } },
        { new: true }
      );
  
      // 3. Update school's active academic year reference
      await School.findByIdAndUpdate(
        schoolId,
        { activeAcademicYear: academicYearId }
      );
  
      res.status(200).json({
        success: true,
        message: 'Academic year activated successfully',
        data: activatedYear
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

module.exports = {
  createAcademicYear,
  getAcademicYearsBySchool,
  updateAcademicYear,
  getActiveAcademicYear,
  getStudentAcademicYears,
  setAcademicYear,
  activateAcademicYear
};
