const Teacher = require('../../models/teacher');
const User = require('../../models/user');
const School = require('../../models/school');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configure upload directory
const uploadDir = path.join(__dirname, '../../uploads');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// Configure Multer with validation
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPG, and JPEG allowed'), false);
    }
  }
});

exports.upload = upload;

// Controller Methods

// 1. Add New Teacher
exports.addTeacher = async (req, res) => {
  try {
    // Extract fields from request body
    const { name, email, phone, designation, subjects, gender } = req.body;
    const adminId = req.user.id;

    // Validate subjects format
    let parsedSubjects;
    try {
      parsedSubjects = typeof subjects === 'string' ? JSON.parse(subjects) : subjects;
    } catch (error) {
      return res.status(400).json({ message: 'Invalid subjects format' });
    }

    if (!Array.isArray(parsedSubjects)) {
      return res.status(400).json({ message: 'Subjects should be an array' });
    }

    // Validate admin permissions
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Admin privileges required' });
    }

    // Find associated school
    const school = await School.findOne({ createdBy: adminId });
    if (!school) {
      return res.status(404).json({ message: 'No school found for this admin' });
    }

    // Handle profile image
    const profileImagePath = req.file ? `/uploads/${req.file.filename}` : '';

    // Create and save teacher
    const newTeacher = new Teacher({
      name,
      email,
      phone,
      designation,
      subjects: parsedSubjects,
      gender,
      schoolId: school._id,
      createdBy: adminId,
      profileImage: profileImagePath
    });

    await newTeacher.save();
    res.status(201).json({ message: 'Teacher added successfully', teacher: newTeacher });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Get All Teachers for School
exports.getTeachersBySchool = async (req, res) => {
  try {
    const adminId = req.user.id;
    
    // Verify admin status
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    // Find school and teachers
    const school = await School.findOne({ createdBy: adminId });
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    const teachers = await Teacher.find({ schoolId: school._id }).select('-__v');
    res.status(200).json(teachers);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Get Single Teacher
exports.getTeacherById = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const teacher = await Teacher.findById(teacherId);

    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    res.status(200).json(teacher);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Upload Profile Image
exports.uploadTeacherPhoto = async (req, res) => {
  try {
    const { teacherId } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    teacher.profileImage = `/uploads/${req.file.filename}`;
    await teacher.save();

    res.status(200).json({ 
      message: 'Profile photo updated', 
      imagePath: teacher.profileImage 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};