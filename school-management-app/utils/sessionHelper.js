const AcademicYear = require('../../models/academicYear');

exports.getCurrentAcademicYear = async (schoolId) => {
  return AcademicYear.findOne({ 
    schoolId,
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() },
    isActive: true // Changed from false to true
  });
};

exports.validateMonthInAcademicYear = (month, academicYear) => {
    const [year, monthNumber] = month.split('-').map(Number);
    const monthDate = new Date(year, monthNumber - 1);
    
    return monthDate >= academicYear.startDate && 
           monthDate <= academicYear.endDate;
  };
  