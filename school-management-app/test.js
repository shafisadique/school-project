// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');
// const User = require('./models/user'); // Adjust path to your User model

// async function createSuperadmin() {
//   try {

//     // Connect to MongoDB
//     await mongoose.connect(`mongodb+srv://School:Patanahi%40123@cluster0.bawv9.mongodb.net/SchoolDB?retryWrites=true&w=majority`, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     console.log('Connected to MongoDB');

//     // Define superadmin credentials
//     const username = 'superadmin';
//     const password = 'Patanahiwipro@123';
//     const email = 'superadmin@example.com'; // Adjust if needed
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // Check if superadmin already exists
//     const existingUser = await User.findOne({ role: 'superadmin' });

//     if (existingUser) {
//       // Update existing superadmin
//       const result = await User.updateOne(
//         { role: 'superadmin' },
//         {
//           $set: {
//             username,
//             email,
//             password: hashedPassword,
//             role: 'superadmin',
//             schoolId: null
//           }
//         }
//       );
//       console.log('Superadmin updated:', result.modifiedCount > 0 ? 'Success' : 'No changes made');
//     } else {
//       // Create new superadmin
//       const newSuperadmin = new User({
//         username,
//         email,
//         password: hashedPassword,
//         role: 'superadmin',
//         schoolId: null
//       });
//       await newSuperadmin.save();
//       console.log('Superadmin created successfully');
//     }

//     // Disconnect from MongoDB
//     await mongoose.disconnect();
//   } catch (err) {
//     console.error('Error:', err);
//   }
// }

// createSuperadmin();














const mongoose = require('mongoose');

// Define the Class schema
const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sections: [{ type: String }],
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attendanceTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    default: null,
  },
  substituteAttendanceTeachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }],
  nextClass: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    default: null,
  },
}, { timestamps: true });

// Define the Subject schema
const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }],
  teacherAssignments: [
    {
      teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
      academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    },
  ],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

// Register the models
const Class = mongoose.model('Class', classSchema);
const Subject = mongoose.model('Subject', subjectSchema);

async function cleanDuplicateAssignments() {
  try {
    // Connect to the database
    await mongoose.connect(`mongodb+srv://School:Patanahi%40123@cluster0.bawv9.mongodb.net/SchoolDB?retryWrites=true&w=majority`);
    console.log('Connected to MongoDB');

    // Fetch all subjects with populated classes
    const subjects = await Subject.find().populate({
      path: 'classes',
      select: 'name _id',
    });

    console.log(`Found ${subjects.length} subjects`);

    for (const subject of subjects) {
      const assignmentsByClassAndYear = {};

      // Group assignments by academic year and class
      for (const assignment of subject.teacherAssignments || []) {
        // Create a key for each class and academic year combination
        const classIds = subject.classes.map(cls => cls._id.toString()).join('_');
        const key = `${assignment.academicYearId}_${classIds}`;
        
        if (!assignmentsByClassAndYear[key]) {
          assignmentsByClassAndYear[key] = [];
        }
        assignmentsByClassAndYear[key].push(assignment);
      }

      // Process duplicates
      for (const key in assignmentsByClassAndYear) {
        const assignments = assignmentsByClassAndYear[key];
        if (assignments.length > 1) {
          console.log(`Found ${assignments.length} duplicates for subject "${subject.name}", key: ${key}`);
          // Keep the first assignment (or modify to select based on other criteria, e.g., most recent)
          const keepAssignment = assignments[0];
          const removeAssignments = assignments.slice(1);

          // Remove duplicate assignments
          subject.teacherAssignments = subject.teacherAssignments.filter(
            (ta) => !removeAssignments.some((ra) => ra._id.equals(ta._id))
          );

          console.log(
            `Keeping assignment: Teacher ${keepAssignment.teacherId}, Academic Year ${keepAssignment.academicYearId}`
          );
          console.log(`Removing ${removeAssignments.length} duplicate assignments`);
        }
      }

      // Save the updated subject
      await subject.save();
      console.log(`Updated subject "${subject.name}"`);
    }

    console.log('Duplicate cleanup completed successfully');
  } catch (error) {
    console.error('Error cleaning duplicates:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

cleanDuplicateAssignments();