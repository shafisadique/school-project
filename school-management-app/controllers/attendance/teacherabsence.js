const mongoose = require('mongoose');
const TeacherAbsence = require('../../models/teacherAbsence');
const Teacher = require('../../models/teacher');
const APIError = require('../../utils/apiError');

const markTeacherAbsence = async (req, res, next) => {
  try {
    const { teacherId, date, reason } = req.body;
    const schoolId = req.user.schoolId;

    if (!teacherId || !date) {
      throw new APIError('Teacher ID and date are required', 400);
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher || teacher.schoolId.toString() !== schoolId.toString()) {
      throw new APIError('Teacher not found or not in this school', 404);
    }

    const absenceDate = new Date(date);
    const startOfDay = new Date(absenceDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(absenceDate.setHours(23, 59, 59, 999));

    const existingAbsence = await TeacherAbsence.findOne({
      teacherId,
      date: { $gte: startOfDay, $lte: endOfDay },
      schoolId,
    });
    if (existingAbsence) {
      throw new APIError('Teacher absence already recorded for this date', 400);
    }

    const absence = new TeacherAbsence({
      teacherId,
      schoolId,
      date: startOfDay,
      reason,
      createdBy: req.user.id,
    });

    await absence.save();

    res.status(201).json({
      success: true,
      message: 'Teacher absence recorded successfully',
      data: absence,
    });
  } catch (error) {
    next(error);
  }
};

const getTeacherAbsences = async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const schoolId = req.user.schoolId;

    const absences = await TeacherAbsence.find({ teacherId, schoolId })
      .populate('teacherId', 'name')
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: absences,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { markTeacherAbsence, getTeacherAbsences };