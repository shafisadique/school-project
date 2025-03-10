const Exam = require('../../models/exam');

// Add exam result for a student
const addExamResult = async (req, res) => {
  const { studentId, subject, marks } = req.body;

  try {
    const exam = new Exam({ studentId, subject, marks, schoolId: req.user.schoolId });
    await exam.save();

    res.status(201).json({ message: 'Exam result added successfully', exam });
  } catch (err) {
    res.status(500).json({ message: 'Error adding exam result', error: err.message });
  }
};

// Get exam results for a student
const getExamResults = async (req, res) => {
  const { studentId } = req.params;

  try {
    const exams = await Exam.find({ studentId, schoolId: req.user.schoolId });
    res.status(200).json(exams);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching exam results', error: err.message });
  }
};

module.exports = { addExamResult, getExamResults };