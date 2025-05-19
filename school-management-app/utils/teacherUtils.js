const TeacherAbsence = require('../models/teacherAbsence');

const isTeacherAbsent = async (teacherId, date) => {
  const absenceDate = new Date(date);
  const startOfDay = new Date(absenceDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(absenceDate.setHours(23, 59, 59, 999));

  const absence = await TeacherAbsence.findOne({
    teacherId,
    date: { $gte: startOfDay, $lte: endOfDay },
  });

  return !!absence;
};

module.exports = { isTeacherAbsent };