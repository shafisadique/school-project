const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Class = require('../models/class');
const { updateClassProgression } = require('../utils/classProgression');

// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB using the MONGODB_URI from .env
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ Connected to MongoDB for migration'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

const migrateClasses = async () => {
  try {
    console.log('Starting class migration...');

    // Fetch all unique schoolIds from classes
    const schools = await Class.aggregate([
      { $group: { _id: '$schoolId' } },
    ]);

    if (!schools.length) {
      console.log('No schools found with classes to migrate.');
      mongoose.connection.close();
      return;
    }

    // Update class progression for each school
    for (const school of schools) {
      const schoolId = school._id;
      await updateClassProgression(schoolId);
      console.log(`Completed class progression update for school ${schoolId}`);
    }

    console.log('Migration completed successfully!');
    mongoose.connection.close();
  } catch (error) {
    console.error('Migration failed:', error);
    mongoose.connection.close();
    process.exit(1);
  }
};

// Execute the migration
migrateClasses();