const Holiday = require('../../models/holiday');
const TeacherAbsence = require('../../models/teacherAbsence');
const Teacher = require('../../models/teacher');
const APIError = require('../../utils/apiError');
const mongoose = require('mongoose')

exports.addHoliday = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { title, date, description, schoolId } = req.body;

      if (!title || !date || !schoolId) {
        throw new APIError('Missing required fields', 400);
      }

      const holidayDate = new Date(date);
      holidayDate.setHours(0, 0, 0, 0);

      const existingHoliday = await Holiday.findOne({ schoolId, date: holidayDate }).session(session);
      if (existingHoliday) {
        throw new APIError('A holiday already exists on this date', 400);
      }

      const holiday = await Holiday.create([{
        schoolId,
        title,
        date: holidayDate,
        description
      }], { session });

      const teachers = await Teacher.find({ schoolId }).session(session);
      const absenceRecords = teachers.map(teacher => ({
        teacherId: teacher._id,
        schoolId,
        date: holidayDate,
        reason: `Holiday: ${title}`,
        status: 'Approved',
        leaveType: 'Holiday',
        substituteTeacherId: null
      }));

      const attendanceRecords = teachers.map(teacher => ({
        teacherId: teacher._id,
        schoolId,
        date: holidayDate,
        status: 'Holiday',
        remarks: `Holiday: ${title}`,
        recordedBy: req.user.id
      }));

      await TeacherAbsence.insertMany(absenceRecords, { session });
      await TeacherAttendance.insertMany(attendanceRecords, { session });

      res.status(201).json(holiday[0]);
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

exports.getHolidays = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { startDate, endDate } = req.query;

    let query = { schoolId };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const holidays = await Holiday.find(query).sort({ date: 1 });
    res.status(200).json(holidays);
  } catch (error) {
    next(error);
  }
};
exports.checkHoliday = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { date } = req.query;

    if (!schoolId || !date) {
      throw new APIError('School ID and date are required', 400);
    }

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    const holiday = await Holiday.findOne({ schoolId, date: checkDate });
    res.status(200).json(holiday ? [holiday] : []);
  } catch (error) {
    next(error);
  }
};
exports.updateHoliday = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, date, description, schoolId } = req.body;

    if (!title || !date || !schoolId) {
      throw new APIError('Missing required fields', 400);
    }

    const holidayDate = new Date(date);
    holidayDate.setHours(0, 0, 0, 0);

    // Check if another holiday exists on the new date
    const existingHoliday = await Holiday.findOne({ schoolId, date: holidayDate, _id: { $ne: id } });
    if (existingHoliday) {
      throw new APIError('A holiday already exists on this date', 400);
    }

    const holiday = await Holiday.findOneAndUpdate(
      { _id: id, schoolId },
      { title, date: holidayDate, description },
      { new: true }
    );

    if (!holiday) {
      throw new APIError('Holiday not found or unauthorized', 404);
    }

    // Update absence records
    await TeacherAbsence.deleteMany({ schoolId, date: holiday.date, reason: { $regex: '^Holiday:' } });
    const teachers = await Teacher.find({ schoolId });
    const absenceRecords = teachers.map(teacher => ({
      teacherId: teacher._id,
      schoolId,
      date: holidayDate,
      reason: `Holiday: ${title}`,
      status: 'Approved',
      substituteTeacherId: null
    }));

    await TeacherAbsence.insertMany(absenceRecords);

    res.status(200).json(holiday);
  } catch (error) {
    next(error);
  }
};

exports.deleteHoliday = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.body;

    if (!schoolId) {
      throw new APIError('School ID is required', 400);
    }

    const holiday = await Holiday.findOneAndDelete({ _id: id, schoolId });

    if (!holiday) {
      throw new APIError('Holiday not found or unauthorized', 404);
    }

    // Delete associated absence records
    await TeacherAbsence.deleteMany({ schoolId, date: holiday.date, reason: { $regex: '^Holiday:' } });

    res.status(200).json({ message: 'Holiday deleted successfully' });
  } catch (error) {
    next(error);
  }
};