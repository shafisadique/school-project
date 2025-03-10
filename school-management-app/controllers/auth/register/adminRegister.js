// const bcrypt = require('bcryptjs');
// const User = require('../../../models/user');
// const School = require('../../../models/school');
// const mongoose = require('mongoose');

// const registerAdmin = async (req, res) => {
//   const session = await mongoose.startSession(); // ✅ Start MongoDB transaction

//   try {
//     session.startTransaction(); // ✅ Begin transaction

//     const { 
//       schoolName,
//       address,
//       name,
//       username,
//       email,
//       password
//     } = req.body;

//     // ✅ Validate Required Fields
//     const requiredFields = ['schoolName', 'name', 'username', 'email', 'password', 'address'];
//     const missingFields = requiredFields.filter(field => !req.body[field]);

//     if (missingFields.length > 0) {
//       return res.status(400).json({
//         message: 'Missing required fields',
//         missing: missingFields
//       });
//     }

//     // ✅ Check if the email or username already exists
//     const [existingUser, existingSchool] = await Promise.all([
//       User.findOne({ $or: [{ email }, { username }] }).session(session),
//       School.findOne({ name: schoolName }).session(session)
//     ]);

//     if (existingUser) {
//       return res.status(409).json({ message: 'Email or username already exists' });
//     }

//     if (existingSchool) {
//       return res.status(409).json({ message: 'School name already registered' });
//     }

//     // ✅ Create the school
//     const newSchool = new School({
//       name: schoolName,
//       address,
//       schoolId: Math.floor(100000 + Math.random() * 900000), // Generate a unique schoolId
//     });

//     await newSchool.save({ session });

//     // ✅ Hash password & create admin
//     const hashedPassword = bcrypt.hashSync(password, 10);
//     const adminUser = new User({
//       name: name,
//       username,
//       email,
//       password: hashedPassword,
//       role: 'admin',
//       schoolId: newSchool._id // ✅ Link admin to school
//     });

//     await adminUser.save({ session });

//     // ✅ Link the school to the admin
//     newSchool.createdBy = adminUser._id;
//     await newSchool.save({ session });

//     // ✅ Commit transaction (save changes)
//     await session.commitTransaction();
//     session.endSession();

//     // ✅ Return response
//     res.status(201).json({
//       message: 'School & Admin registration successful',
//       school: {
//         id: newSchool.schoolId,
//         name: newSchool.name,
//         address: newSchool.address
//       },
//       admin: {
//         id: adminUser._id,
//         name: adminUser.name,
//         email: adminUser.email,
//         username: adminUser.username
//       }
//     });

//   } catch (err) {
//     await session.abortTransaction(); // ✅ Rollback changes on error
//     session.endSession();

//     res.status(500).json({
//       message: 'Registration failed',
//       error: process.env.NODE_ENV === 'development' ? err.message : 'Internal error'
//     });
//   }
// };

// module.exports = registerAdmin;
