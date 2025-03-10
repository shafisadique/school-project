const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/user'); // Adjust the path based on your project

mongoose.connect('mongodb+srv://School:Patanahi%40123@cluster0.bawv9.mongodb.net/SchoolDB?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const createSuperAdmin = async () => {
  try {
    const hashedPassword = bcrypt.hashSync("SuperAdmin@123", 10);
    
    const superAdmin = new User({
      name: "Super Admin",
      username: "superadmin",
      email: "superadmin@example.com",
      password: hashedPassword,
      role: "superadmin",
      schoolId: null
    });

    await superAdmin.save();
    console.log("✅ SuperAdmin Created Successfully");
    mongoose.connection.close();
  } catch (err) {
    console.error("❌ Error Creating SuperAdmin:", err);
    mongoose.connection.close();
  }
};

createSuperAdmin();
// const jwt = require('jsonwebtoken');
// const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2N2JkODA0NDhlZmE0YzcyZmU2Zjg3MTMiLCJyb2xlIjoic3VwZXJhZG1pbiIsImlhdCI6MTc0MDQ3MjM5NiwiZXhwIjoxNzQwNDc1OTk2fQ.xwaJrkr0zeewNVhcPRLdGJXjDE8E_Tm14zhDq_66RZU";
// const decoded = jwt.decode(token, { complete: true });
// console.log(decoded);
