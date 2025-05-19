// migration-script.js
const School = require("./models/school");
const AcademicYear = require("./models/academicyear");

async function fixAcademicYearReferences() {
  const schools = await School.find({ academicYear: { $type: "string" } });

  for (const school of schools) {
    const academicYear = await AcademicYear.findOne({
      schoolId: school._id,
      year: school.academicYear,
    });

    if (academicYear) {
      school.academicYear = academicYear._id;
      await school.save();
      console.log(`Updated school ${school._id}`);
    }
  }
}

fixAcademicYearReferences();