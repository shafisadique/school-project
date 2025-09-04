const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/user'); // Adjust path to your User model

async function createSuperadmin() {
  try {

    // Connect to MongoDB
    await mongoose.connect(`mongodb+srv://School:Patanahi%40123@cluster0.bawv9.mongodb.net/SchoolDB?retryWrites=true&w=majority`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Define superadmin credentials
    const username = 'superadmin';
    const password = 'Patanahiwipro@123';
    const email = 'superadmin@example.com'; // Adjust if needed
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if superadmin already exists
    const existingUser = await User.findOne({ role: 'superadmin' });

    if (existingUser) {
      // Update existing superadmin
      const result = await User.updateOne(
        { role: 'superadmin' },
        {
          $set: {
            username,
            email,
            password: hashedPassword,
            role: 'superadmin',
            schoolId: null
          }
        }
      );
      console.log('Superadmin updated:', result.modifiedCount > 0 ? 'Success' : 'No changes made');
    } else {
      // Create new superadmin
      const newSuperadmin = new User({
        username,
        email,
        password: hashedPassword,
        role: 'superadmin',
        schoolId: null
      });
      await newSuperadmin.save();
      console.log('Superadmin created successfully');
    }

    // Disconnect from MongoDB
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

createSuperadmin();