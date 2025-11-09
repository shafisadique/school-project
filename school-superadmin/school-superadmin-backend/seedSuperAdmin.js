const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const SuperUser = require('./models/superuser');  // Adjust path if needed

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('DB connected for seeding');
    try {
      // Check if exists
      const existing = await SuperUser.findOne({ username: 'sadique_shafi' });
      if (existing) {
        console.log('✅ Superadmin already exists');
        process.exit(0);
      }

      const superAdmin = new SuperUser({
        name: 'Sadique Shafi',
        username: 'sadique_shafi',
        email: 'shafisadique123@gmail.com',
        password: 'SuperAdmin@123',  // Plain text—model pre-save will hash it
        role: 'superadmin'
      });

      await superAdmin.save();  // Triggers pre-save hook to hash
      console.log('✅ Superadmin created: username=sadique_shafi, email=shafisadique123@gmail.com, password=SuperAdmin@123');
    } catch (err) {
      console.error('❌ Seed error:', err);
    } finally {
      mongoose.connection.close();
    }
  })
  .catch(err => console.error('DB connect error:', err));