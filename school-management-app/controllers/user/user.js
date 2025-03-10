const User = require('../../models/user');

// Get all users in a school
const getUsers = async (req, res) => {
  try {
    const users = await User.find({ schoolId: req.user.schoolId });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
};

// Update a user
const updateUser = async (req, res) => {
  const { userId } = req.params;
  const { additionalInfo } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update additionalInfo
    user.additionalInfo = additionalInfo;
    await user.save();

    res.status(200).json({ message: 'User updated successfully', user });
  } catch (err) {
    res.status(500).json({ message: 'Error updating user', error: err.message });
  }
};

module.exports = { getUsers, updateUser };