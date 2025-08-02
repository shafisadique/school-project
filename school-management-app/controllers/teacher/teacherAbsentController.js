const TeacherAbsence = require('../../models/teacherAbsence');
const Holiday = require('../../models/holiday');
const APIError = require('../../utils/apiError');
const School = require('../../models/school');
const mongoose =require('mongoose')

exports.addAbsence = async (req, res, next) => {
  try {
    const { teacherId, date, reason, substituteTeacherId, status } = req.body;
    const schoolId = req.body.schoolId || req.user.schoolId; // Use user schoolId if not provided

    if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) {
      throw new APIError('Valid teacherId is required', 400);
    }
    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      throw new APIError('Valid schoolId is required', 400);
    }

    const absenceDate = new Date(date);
    absenceDate.setHours(0, 0, 0, 0);

    // Check weekly holiday
    const school = await School.findById(schoolId);
    if (!school) throw new APIError('School not found', 404);
    const weeklyHolidayDay = school.weeklyHolidayDay;
    const absenceDay = absenceDate.toLocaleDateString('en-US', { weekday: 'long' });
    if (absenceDay === weeklyHolidayDay) {
      throw new APIError(`Cannot apply for absence on ${weeklyHolidayDay} as it is a weekly holiday`, 400);
    }

    // Check specific holiday
    const holiday = await Holiday.findOne({ schoolId, date: absenceDate });
    if (holiday) {
      throw new APIError('Cannot apply for absence on a holiday', 400);
    }

    const absence = new TeacherAbsence({
      teacherId: new mongoose.Types.ObjectId(teacherId),
      schoolId: new mongoose.Types.ObjectId(schoolId),
      date: absenceDate,
      reason,
      substituteTeacherId: substituteTeacherId ? new mongoose.Types.ObjectId(substituteTeacherId) : null,
      status: status || 'Pending' // Default to Pending if not provided
    });

    const savedAbsence = await absence.save();
    res.status(201).json(savedAbsence);
  } catch (error) {
    next(error);
  }
};

exports.getAbsences = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const { startDate, endDate, teacherId } = req.query;

    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      throw new APIError('Invalid schoolId format', 400);
    }

    const matchStage = { schoolId: new mongoose.Types.ObjectId(schoolId) };
    if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) {
      matchStage.teacherId = new mongoose.Types.ObjectId(teacherId);
    }
    if (startDate && endDate) {
      matchStage.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const absences = await TeacherAbsence.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'teachers',
          localField: 'teacherId',
          foreignField: '_id',
          as: 'teacherDetails'
        }
      },
      {
        $lookup: {
          from: 'teachers',
          localField: 'substituteTeacherId',
          foreignField: '_id',
          as: 'substituteDetails'
        }
      },
      {
        $project: {
          _id: 1,
          teacherId: { $arrayElemAt: ['$teacherDetails.name', 0] },
          schoolId: 1,
          date: 1,
          reason: 1,
          substituteTeacherId: { $arrayElemAt: ['$substituteDetails.name', 0] },
          status: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      { $sort: { date: 1 } }
    ]);

    console.log('Aggregated absences:', absences);
    res.status(200).json(absences);
  } catch (error) {
    next(error);
  }
};
// old code
// exports.updateAbsence = async (req, res, next) => {
//   try {
//     const { id } = req.params;
//     const { teacherId, date, reason, schoolId, substituteTeacherId, status } = req.body;

//     if (!teacherId || !date || !reason || !schoolId) {
//       throw new APIError('Missing required fields', 400);
//     }

//     const absenceDate = new Date(date);
//     absenceDate.setHours(0, 0, 0, 0);

//     // Check weekly holiday
//     const school = await School.findById(schoolId);
//     if (!school) throw new APIError('School not found', 404);
//     const weeklyHolidayDay = school.weeklyHolidayDay;
//     const absenceDay = absenceDate.toLocaleDateString('en-US', { weekday: 'long' });
//     if (absenceDay === weeklyHolidayDay) {
//       throw new APIError(`Cannot update absence on ${weeklyHolidayDay} as it is a weekly holiday`, 400);
//     }

//     // Check specific holiday
//     const holiday = await Holiday.findOne({ schoolId, date: absenceDate });
//     if (holiday) {
//       throw new APIError('Cannot update absence on a holiday', 400);
//     }

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//       const absence = await TeacherAbsence.findOneAndUpdate(
//         { _id: id, schoolId },
//         { teacherId, date: absenceDate, reason, substituteTeacherId: substituteTeacherId || null, status },
//         { new: true, session }
//       );

//       if (!absence) {
//         throw new APIError('Absence not found or unauthorized', 404);
//       }

//       if (status === 'Approved' && absence.status !== 'Approved') {
//         const teacher = await Teacher.findById(teacherId).session(session);
//         if (!teacher) throw new APIError('Teacher not found', 404);

//         const leaveDays = 1;
//         if (teacher.leaveBalance < leaveDays) {
//           throw new APIError('Insufficient leave balance', 400);
//         }

//         teacher.leaveBalance -= leaveDays;
//         await teacher.save({ session });
//       }

//       await session.commitTransaction();
//       res.status(200).json(absence);
//     } catch (error) {
//       await session.abortTransaction();
//       throw error;
//     } finally {
//       session.endSession();
//     }
//   } catch (error) {
//     next(error);
//   }
// };

// new code

exports.updateAbsence = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Only status is required
    const schoolId = req.body.schoolId || req.user.schoolId; // Use user schoolId if not provided

    if (!status) {
      throw new APIError('Status is required', 400);
    }
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      throw new APIError('Valid schoolId is required', 400);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Fetch the current absence to check previous status
      const absence = await TeacherAbsence.findOne({ _id: id, schoolId }).session(session);
      if (!absence) {
        throw new APIError('Absence not found or unauthorized', 404);
      }

      // Update only the status (other fields remain unchanged unless provided)
      const updatedAbsence = await TeacherAbsence.findOneAndUpdate(
        { _id: id, schoolId },
        { status },
        { new: true, runValidators: true, session }
      );

      if (!updatedAbsence) {
        throw new APIError('Failed to update absence', 400);
      }

      // Handle leave balance deduction for Approved status change
      if (status === 'Approved' && absence.status !== 'Approved') {
        const Teacher = require('../../models/teacher'); // Import Teacher model
        const teacher = await Teacher.findById(absence.teacherId).session(session);
        if (!teacher) throw new APIError('Teacher not found', 404);

        const leaveDays = 1;
        if (teacher.leaveBalance < leaveDays) {
          throw new APIError('Insufficient leave balance', 400);
        }

        teacher.leaveBalance -= leaveDays;
        await teacher.save({ session });
      }

      await session.commitTransaction();
      res.status(200).json(updatedAbsence);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    next(error);
  }
};

exports.deleteAbsence = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.body;

    if (!schoolId) {
      throw new APIError('School ID is required', 400);
    }

    const absence = await TeacherAbsence.findOneAndDelete({ _id: id, schoolId });

    if (!absence) {
      throw new APIError('Absence not found or unauthorized', 404);
    }

    res.status(200).json({ message: 'Absence deleted successfully' });
  } catch (error) {
    next(error);
  }
};


exports.getPendingAbsences = async (req, res, next) => {
  try {
    const { schoolId } = req.user; // Assuming schoolId is in req.user from authMiddleware
    const { startDate, endDate, teacherId } = req.query;

    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      throw new APIError('Valid schoolId is required', 400);
    }

    const matchStage = { schoolId: new mongoose.Types.ObjectId(schoolId), status: 'Pending' };
    if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) {
      matchStage.teacherId = new mongoose.Types.ObjectId(teacherId);
    }
    if (startDate && endDate) {
      matchStage.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const absences = await TeacherAbsence.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'teachers',
          localField: 'teacherId',
          foreignField: '_id',
          as: 'teacherDetails'
        }
      },
      {
        $lookup: {
          from: 'teachers',
          localField: 'substituteTeacherId',
          foreignField: '_id',
          as: 'substituteDetails'
        }
      },
      {
        $project: {
          _id: 1,
          teacherId: { $arrayElemAt: ['$teacherDetails.name', 0] },
          schoolId: 1,
          date: 1,
          reason: 1,
          substituteTeacherId: { $arrayElemAt: ['$substituteDetails.name', 0] },
          status: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      { $sort: { date: 1 } }
    ]);

    console.log('Pending absences:', absences);
    res.status(200).json({
      success: true,
      count: absences.length,
      data: absences
    });
  } catch (error) {
    next(error);
  }
};