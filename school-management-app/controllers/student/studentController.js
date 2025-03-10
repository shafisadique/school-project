const Student = require('../../models/student');
const User = require('../../models/user');
const School = require('../../models/school');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configure upload directory
const uploadDir = path.join(__dirname, '');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];
    allowedTypes.includes(file.mimetype) 
      ? cb(null, true)
      : cb(new Error('Invalid file type. Only PNG, JPG, and JPEG allowed'));
  }
});

// Generate unique admission number
async function generateAdmissionNo(schoolId) {
  const counter = await Student.countDocuments({ schoolId }) + 1;
  return `${schoolId.toString().slice(-6)}-${counter.toString().padStart(4, '0')}`;
}

exports.addStudent = async (req, res) => {
  try {
    const { name, email, phone, className, address, gender,currentSession } = req.body;
    const adminId = req.user.id;

    // Validate required fields
    if (!name || !className || !address || !gender|| !currentSession) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify admin and school
    const [admin, school] = await Promise.all([
      User.findById(adminId),
      School.findOne({ createdBy: adminId })
    ]);

    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ message: 'Admin privileges required' });
    }
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    // Generate unique admission number
    const admissionNo = await generateAdmissionNo(school._id);

    // Check for existing admission number
    const existingStudent = await Student.findOne({ admissionNo });
    if (existingStudent) {
      return res.status(409).json({ message: 'Admission number conflict' });
    }

    // Create new student
    const newStudent = new Student({
      name,
      email,
      phone,
      address,
      className,
      gender,
      currentSession,
      admissionNo,
      profileImage: req.file ? `/uploads/students/${req.file.filename}` : '',
      schoolId: school._id,
      createdBy: adminId
    });

    await newStudent.save();
    res.status(201).json({
      message: 'Student created successfully',
      data: newStudent
    });

  } catch (err) {
    console.error('Error creating student:', err);
    res.status(500).json({ 
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


// ✅ **2. Get All Students for Admin’s School**
exports.getStudentsBySchool = async (req, res) => {
  try {
    const adminId = req.user.id;

    // ✅ Ensure Admin Exists
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can view students' });
    }

    // ✅ Find School
    const school = await School.findOne({ createdBy: adminId });
    if (!school) {
      return res.status(400).json({ message: 'No school found for this admin' });
    }

    // ✅ Get Students in the School
    const students = await Student.find({ schoolId: school._id }).select('-password');
    res.status(200).json(students);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ **3. Get Single Student Details**
exports.getStudentById = async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await Student.findById(studentId).select('-password');
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.status(200).json(student);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ **4. Upload Student Profile Image**
exports.uploadStudentPhoto = async (req, res) => {
  try {
    const { studentId } = req.params;

    // ✅ Check if file is provided
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // ✅ Find Student by ID
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // ✅ Update Student Profile Image
    student.profileImage = `/uploads/students/${req.file.filename}`;
    await student.save();

    res.status(200).json({ message: 'Profile photo uploaded successfully', imagePath: student.profileImage });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ✅ Add Student Search Endpoint
exports.searchStudents = async (req, res) => {
  try {
    const { schoolId, query } = req.query;
    console.log('working')
    // Validate input parameters
    if (!schoolId || !query) {
      return res.status(400).json({ 
        message: 'Both schoolId and query parameters are required' 
      });
    }

    // Create search regex
    const searchRegex = new RegExp(query, 'i');

    // Search students
    const students = await Student.find({
      schoolId,
      $or: [
        { name: { $regex: searchRegex } },
        { admissionNo: { $regex: searchRegex } },
        { phone: { $regex: searchRegex } }
      ]
    }).select('-password -__v');

    res.status(200).json(students);

  } catch (err) {
    res.status(500).json({ 
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
exports.upload = upload;
