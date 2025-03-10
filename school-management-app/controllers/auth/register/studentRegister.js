const registerStudent = async (req, res) => {
    const { name, username, email, password, schoolId, className, rollNumber } = req.body;
  
    try {
      if (!['admin', 'teacher'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Only Admins or Teachers can create Students' });
      }
  
      const hashedPassword = bcrypt.hashSync(password, 10);
  
      const student = new User({
        name,
        username,
        email,
        password: hashedPassword,
        role: 'student',
        schoolId,
        additionalInfo: { className, rollNumber }
      });
  
      await student.save();
      res.status(201).json({ message: 'Student registered successfully', student });
  
    } catch (err) {
      res.status(500).json({ message: 'Error registering student', error: err.message });
    }
  };
  
  module.exports = registerStudent;
  