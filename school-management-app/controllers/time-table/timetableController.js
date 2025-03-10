const Timetable = require('../../models/timetable');

// Add a timetable entry
const addTimetableEntry = async (req, res) => {
  const { classId, subject, day, time } = req.body;

  try {
    const timetable = new Timetable({ classId, subject, day, time, schoolId: req.user.schoolId });
    await timetable.save();

    res.status(201).json({ message: 'Timetable entry added successfully', timetable });
  } catch (err) {
    res.status(500).json({ message: 'Error adding timetable entry', error: err.message });
  }
};

// Get timetable for a class
const getTimetable = async (req, res) => {
  const { classId } = req.params;

  try {
    const timetable = await Timetable.find({ classId, schoolId: req.user.schoolId });
    res.status(200).json(timetable);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching timetable', error: err.message });
  }
};

module.exports = { addTimetableEntry, getTimetable };