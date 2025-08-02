// scripts/seedTestData.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const School = require('./models/school');
const User = require('./models/user');
const Teacher = require('./models/teacher');
const AcademicYear = require('./models/academicyear');
const dotenv = require('dotenv');

dotenv.config();

async function seedTestData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB Atlas');

    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      // Create school
      const school = new School({
        name: 'Test School',
        email: 'testschool@example.com',
        mobileNo: '+919876543210',
        address: {
          street: '123 Test St',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          postalCode: '400001',
        },
        status: true,
      });

      // Create academic year
      const academicYear = new AcademicYear({
        schoolId: school._id,
        name: '2025-2026',
        startDate: new Date(2025, 2, 1),
        endDate: new Date(2026, 1, 28),
        isActive: true,
      });

      // Create admin
      const admin = new User({
        name: 'Test Admin',
        username: 'testadmin',
        email: 'admin@testschool.com',
        password: bcrypt.hashSync('test123', 10),
        role: 'admin',
        schoolId: school._id,
        additionalInfo: { createdBy: 'seed-script' },
      });

      // Create teacher user
      const teacherUser = new User({
        name: 'Test Teacher',
        username: 'testteacher',
        email: 'teacher@testschool.com',
        password: bcrypt.hashSync('test123', 10),
        role: 'teacher',
        schoolId: school._id,
      });

      // Create teacher
      const teacher = new Teacher({
        userId: teacherUser._id,
        schoolId: school._id,
        name: 'Test Teacher',
        email: 'teacher@testschool.com',
        status: true,
        leaveBalance: 10,
      });

      // Link relationships
      school.createdBy = admin._id;
      school.activeAcademicYear = academicYear._id;

      // Save all
      await Promise.all([
        school.save({ session }),
        academicYear.save({ session }),
        admin.save({ session }),
        teacherUser.save({ session }),
        teacher.save({ session }),
      ]);

      console.log('Test data seeded:');
      console.log('School ID:', school._id.toString());
      console.log('Admin ID:', admin._id.toString());
      console.log('Teacher ID:', teacher._id.toString());
      console.log('Academic Year ID:', academicYear._id.toString());
    });

    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding test data:', error);
    mongoose.connection.close();
  }
}

seedTestData();