const Attendance = require('../models/Attendance');

// Mark attendance for a student
const markAttendance = async (req, res) => {
  const { studentId, date, status } = req.body;

  try {
    const attendance = new Attendance({ studentId, date, status, schoolId: req.user.schoolId });
    await attendance.save();

    res.status(201).json({ message: 'Attendance marked successfully', attendance });
  } catch (err) {
    res.status(500).json({ message: 'Error marking attendance', error: err.message });
  }
};

// Get attendance for a student
const getAttendance = async (req, res) => {
  const { studentId } = req.params;

  try {
    const attendance = await Attendance.find({ studentId, schoolId: req.user.schoolId });
    res.status(200).json(attendance);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching attendance', error: err.message });
  }
};

module.exports = { markAttendance, getAttendance };