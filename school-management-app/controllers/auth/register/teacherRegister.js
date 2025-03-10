const registerTeacher = async (req, res) => {
    const { name, username, email, password, schoolId, subjects, classes } = req.body;
  
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only Admins can create Teachers' });
      }
  
      const hashedPassword = bcrypt.hashSync(password, 10);
  
      const teacher = new User({
        name,
        username,
        email,
        password: hashedPassword,
        role: 'teacher',
        schoolId,
        additionalInfo: { subjects, classes }
      });
  
      await teacher.save();
      res.status(201).json({ message: 'Teacher registered successfully', teacher });
  
    } catch (err) {
      res.status(500).json({ message: 'Error registering teacher', error: err.message });
    }
  };
  
  module.exports = registerTeacher;
  