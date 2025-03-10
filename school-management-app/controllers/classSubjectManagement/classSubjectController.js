const Class = require('../../models/class');
const Subject = require('../../models/subject');
const Teacher =require('../../models/teacher')
// ✅ Create Class
const createClass = async (req, res) => {
  const { name, sections, schoolId } = req.body;

  try {
    if (!name || !schoolId) {
      return res.status(400).json({ message: 'Class name and school ID are required' });
    }

    // ✅ Check if class already exists in the school
    const existingClass = await Class.findOne({ name, schoolId });

    if (existingClass) {
      return res.status(400).json({ message: 'Class already exists in this school' });
    }

    const newClass = new Class({ 
      name, 
      sections, 
      schoolId, 
      createdBy: req.user._id 
    });

    await newClass.save();
    res.status(201).json({ message: 'Class created successfully', class: newClass });

  } catch (err) {
    res.status(500).json({ message: 'Error creating class', error: err.message });
  }
};


// ✅ Get All Classes (For a Specific School)
const getClassesBySchool = async (req, res) => {
  try {
    const classes = await Class.find({ schoolId: req.params.schoolId }).populate('subjects');
    res.status(200).json(classes);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching classes', error: err.message });
  }
};

// ✅ Create Subject
const createSubject = async (req, res) => {
  const { name, classes, teachers, schoolId } = req.body;

  try {
    if (!name || !schoolId) {
      return res.status(400).json({ message: 'Subject name and school ID are required' });
    }

    // ✅ Check if subject already exists in the school
    const existingSubject = await Subject.findOne({ name, schoolId });

    if (existingSubject) {
      return res.status(400).json({ message: 'Subject already exists in this school' });
    }

    const newSubject = new Subject({ 
      name, 
      classes, 
      teachers, 
      schoolId, 
      createdBy: req.user._id 
    });

    await newSubject.save();
    res.status(201).json({ message: 'Subject created successfully', subject: newSubject });

  } catch (err) {
    res.status(500).json({ message: 'Error creating subject', error: err.message });
  }
};


// ✅ Get All Subjects (For a Specific School)
const getSubjectsBySchool = async (req, res) => {
  try {
    const subjects = await Subject.find({ schoolId: req.params.schoolId }).populate('classes teachers');
    res.status(200).json(subjects);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching subjects', error: err.message });
  }
};

const assignSubjectToClass = async (req, res) => {
  const { classId, subjectId, teacherId } = req.body;

  try {
    const classData = await Class.findById(classId);
    const subject = await Subject.findById(subjectId);
    const teacher = await Teacher.findById(teacherId);

    if (!classData || !subject || !teacher) {
      return res.status(404).json({ message: 'Class, Subject, or Teacher not found' });
    }

    // Ensure they belong to the same school
    if (classData.schoolId.toString() !== subject.schoolId.toString() ||
        subject.schoolId.toString() !== teacher.schoolId.toString()) {
      return res.status(400).json({ message: 'Class, Subject, and Teacher must belong to the same school' });
    }

    // Assign subject to class
    if (!classData.subjects.includes(subjectId)) {
      classData.subjects.push(subjectId);
    }

    // Assign teacher to the subject in that class
    subject.teachers = subject.teachers || [];
    if (!subject.teachers.includes(teacherId)) {
      subject.teachers.push(teacherId);
    }

    await classData.save();
    await subject.save();

    res.status(200).json({ message: 'Subject assigned to class successfully with teacher' });

  } catch (err) {
    res.status(500).json({ message: 'Error assigning subject to class', error: err.message });
  }
};
const getTeachersBySchoolId = async (req, res) => {
  try {
    const { schoolId } = req.params; // ✅ Get schoolId from request params

    const teachers = await Teacher.find({ schoolId }).select('-__v');

    if (!teachers.length) {
      return res.status(404).json({ message: 'No teachers found for this school' });
    }

    res.status(200).json(teachers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createClass,
  getClassesBySchool,
  createSubject,
  getSubjectsBySchool,
  assignSubjectToClass,
  getTeachersBySchoolId
};
