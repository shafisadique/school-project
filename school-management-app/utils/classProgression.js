// utils/classProgression.js
const Class = require('../models/class'); // Correct path relative to utils/

const referenceProgression = [
  'Pre-Nursery', 'Nursery', 'KG', 'Class I', 'Class II', 'Class III',
  'Class IV', 'Class V', 'Class VI', 'Class VII', 'Class VIII',
  'Class IX', 'Class X', 'Class XI', 'Class XII',
];

const sortClasses = (classes) => {
  return classes.sort((a, b) => {
    const indexA = referenceProgression.indexOf(a.name);
    const indexB = referenceProgression.indexOf(b.name);

    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    if (indexA === -1 && indexB !== -1) return 1;
    if (indexB === -1 && indexA !== -1) return -1;
    return a.name.localeCompare(b.name);
  });
};

const updateClassProgression = async (schoolId) => {
  try {
    // Fetch all classes for the school
    const schoolClasses = await Class.find({ schoolId });

    if (!schoolClasses.length) {
      console.log(`No classes found for school ${schoolId}. Skipping progression update.`);
      return;
    }

    // Sort the classes
    const sortedClasses = sortClasses(schoolClasses);

    // Update nextClass for each class
    for (let i = 0; i < sortedClasses.length - 1; i++) {
      const currentClass = sortedClasses[i];
      const nextClass = sortedClasses[i + 1];

      await Class.findByIdAndUpdate(
        currentClass._id,
        { nextClass: nextClass._id }, // Note: Ensure your Class schema has 'nextClass' field
        { new: true }
      );
      console.log(`Updated ${currentClass.name} to point to ${nextClass.name} in school ${schoolId}`);
    }

    // Set nextClass to null for the last class
    const lastClass = sortedClasses[sortedClasses.length - 1];
    await Class.findByIdAndUpdate(
      lastClass._id,
      { nextClass: null },
      { new: true }
    );
    console.log(`Set nextClass to null for ${lastClass.name} in school ${schoolId}`);
  } catch (error) {
    console.error(`Failed to update class progression for school ${schoolId}:`, error);
    throw error; // Re-throw the error to be caught by the caller
  }
};

module.exports = { referenceProgression, sortClasses, updateClassProgression };