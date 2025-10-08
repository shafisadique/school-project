// src/controllers/parentController.js
const bcrypt = require('bcrypt');

const registerParent = async (req, res) => {
  const { name, username, email, password, schoolId, studentId } = req.body;

  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only Admins can create Parent portals' });
    }

    // Validate required fields
    if (!name || !username || !email || !password || !schoolId || !studentId) {
      return res.status(400).json({ message: 'All fields (name, username, email, password, schoolId, studentId) are required' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const parent = new User({
      name,
      username,
      email,
      password: hashedPassword,
      role: 'parent',
      schoolId,
      additionalInfo: { studentId } // Link parent to their student(s)
    });

    await parent.save();
    res.status(201).json({ message: 'Parent portal created successfully', parent });
  } catch (err) {
    res.status(500).json({ message: 'Error creating parent portal', error: err.message });
  }
};

module.exports = registerParent;