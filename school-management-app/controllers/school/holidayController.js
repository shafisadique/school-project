const Holiday = require('../../models/holiday');

// ✅ Add a Holiday
exports.addHoliday = async (req, res) => {
  try {
    const { schoolId, title, date, description } = req.body;

    if (!schoolId || !title || !date) {
      return res.status(400).json({ message: 'schoolId, title, and date are required' });
    }

    const newHoliday = new Holiday({ schoolId, title, date, description });
    await newHoliday.save();

    res.status(201).json({ message: 'Holiday added successfully', holiday: newHoliday });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add holiday', error: err.message });
  }
};

// ✅ Get All Holidays for a School
exports.getHolidays = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const holidays = await Holiday.find({ schoolId }).sort({ date: 1 });

    res.status(200).json({ message: 'Holidays retrieved successfully', holidays });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve holidays', error: err.message });
  }
};

// ✅ Delete a Holiday
exports.deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id);

    if (!holiday) {
      return res.status(404).json({ message: 'Holiday not found' });
    }

    res.status(200).json({ message: 'Holiday deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete holiday', error: err.message });
  }
};
