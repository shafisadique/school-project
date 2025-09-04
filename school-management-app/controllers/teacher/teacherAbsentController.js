const TeacherAbsence = require('../../models/teacherAbsence');
const Holiday = require('../../models/holiday');
const APIError = require('../../utils/apiError');
const School = require('../../models/school');
const mongoose =require('mongoose');
const teacherSchema = require('../../models/teacher');
const teacherAttendance = require('../../models/teacherAttendance');
exports.addAbsence = async (req, res, next) => {
  try {
    const { teacherId, date, reason, substituteTeacherId, status } = req.body;
    const schoolId = req.body.schoolId || req.user.schoolId;

    if (!teacherId || !mongoose.Types.ObjectId.isValid(teacherId)) {
      throw new APIError('Valid teacherId is required', 400);
    }
    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      throw new APIError('Valid schoolId is required', 400);
    }

    const absenceDate = new Date(date);
    absenceDate.setHours(0, 0, 0, 0);

    const school = await School.findById(schoolId);
    if (!school) throw new APIError('School not found', 404);
    const weeklyHolidayDay = school.weeklyHolidayDay;
    const absenceDay = absenceDate.toLocaleDateString('en-US', { weekday: 'long' });
    if (absenceDay === weeklyHolidayDay) {
      throw new APIError(`Cannot apply for absence on ${weeklyHolidayDay} as it is a weekly holiday`, 400);
    }

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
      status: status || 'Pending',
      isTeacherApplied: true // Explicitly set
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
    const { status } = req.body;
    const schoolId = req.body.schoolId || req.user.schoolId;

    if (!status) {
      throw new APIError('Status is required', 400);
    }
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      throw new APIError('Valid schoolId is required', 400);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const absence = await TeacherAbsence.findOne({ _id: id, schoolId }).session(session);
      if (!absence) {
        throw new APIError('Absence not found or unauthorized', 404);
      }

      if (absence.isTeacherApplied) {
        // Teacher-applied leave: Update status and deduct leave balance if Approved
        const updatedAbsence = await TeacherAbsence.findOneAndUpdate(
          { _id: id, schoolId },
          { status },
          { new: true, runValidators: true, session }
        );

        if (status === 'Approved' && absence.status !== 'Approved') {
          const teacher = await teacherSchema.findById(absence.teacherId).session(session);
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
      } else {
        // Auto-generated absence (forgot to mark attendance)
        if (status === 'Approved') {
          // Teacher was present but forgot to mark attendance
          const attendance = await teacherAttendance.findOne({
            teacherId: absence.teacherId,
            schoolId,
            date: absence.date,
          }).session(session);
          if (attendance) {
            attendance.status = 'Present';
            attendance.remarks = 'Manually approved by admin (forgot to mark attendance)';
            await attendance.save({ session });
          } else {
            throw new APIError('Corresponding attendance record not found', 404);
          }

          // Delete the absence record since the teacher was present
          await TeacherAbsence.deleteOne({ _id: id, schoolId }).session(session);
        } else if (status === 'Rejected') {
          // Confirm absence, mark as Approved with Unpaid leave
          const updatedAbsence = await TeacherAbsence.findOneAndUpdate(
            { _id: id, schoolId },
            { status: 'Approved', leaveType: 'Unpaid', reason: 'Confirmed absence (forgot to mark attendance)' },
            { new: true, runValidators: true, session }
          );

          const teacher = await teacherSchema.findById(absence.teacherId).session(session);
          if (!teacher) throw new APIError('Teacher not found', 404);

          const leaveDays = 1;
          if (teacher.leaveBalance < leaveDays) {
            throw new APIError('Insufficient leave balance', 400);
          }

          teacher.leaveBalance -= leaveDays;
          await teacher.save({ session });
        } else {
          throw new APIError('Invalid status for auto-generated absence', 400);
        }

        await session.commitTransaction();
        res.status(200).json({ message: `Absence ${status.toLowerCase()} successfully` });
      }
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


// exports.getPendingTeacherLeaveApplications = async (req, res, next) => {

//   try {
//     const { schoolId } = req.user; // Assuming schoolId is in req.user from authMiddleware
//     const { startDate, endDate, teacherId } = req.query;

//     if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
//       throw new APIError('Valid schoolId is required', 400);
//     }

//     const matchStage = { schoolId: new mongoose.Types.ObjectId(schoolId), status: 'Pending' };
//     if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) {
//       matchStage.teacherId = new mongoose.Types.ObjectId(teacherId);
//     }
//     if (startDate && endDate) {
//       matchStage.date = {
//         $gte: new Date(startDate),
//         $lte: new Date(endDate)
//       };
//     }

//     const absences = await TeacherAbsence.aggregate([
//       { $match: matchStage },
//       {
//         $lookup: {
//           from: 'teachers',
//           localField: 'teacherId',
//           foreignField: '_id',
//           as: 'teacherDetails' 
//         }
//       },
//       {
//         $lookup: {
//           from: 'teachers',
//           localField: 'substituteTeacherId',
//           foreignField: '_id',
//           as: 'substituteDetails'
//         }
//       },
//       {
//         $project: {
//           _id: 1,
//           teacherId: { $arrayElemAt: ['$teacherDetails', 0] }, // Return full teacher object
//           schoolId: 1,
//           date: 1,
//           reason: 1,
//           substituteTeacherId: { $arrayElemAt: ['$substituteDetails', 0] }, // Return full substitute teacher object
//           status: 1,
//           createdAt: 1,
//           updatedAt: 1
//         }
//       },
//       { $sort: { date: 1 } }
//     ]);

//     console.log('Pending teacher leave applications:', absences);
//     res.status(200).json({
//       success: true,
//       count: absences.length,
//       data: absences
//     });
//   } catch (error) {
//     next(error);
//   }
// };

exports.getPendingTeacherLeaveApplications = async (req, res, next) => {
  try {
    const { schoolId } = req.user; // Assuming schoolId is in req.user from authMiddleware
    const { startDate, endDate, teacherId } = req.query;

    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      throw new APIError('Valid schoolId is required', 400);
    }

    const matchStage = { 
      schoolId: new mongoose.Types.ObjectId(schoolId), 
      status: 'Pending',
      isTeacherApplied: true // Only teacher-applied leaves
    };
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
          teacherId: {
            _id: { $arrayElemAt: ['$teacherDetails._id', 0] },
            name: { $arrayElemAt: ['$teacherDetails.name', 0] },
            email: { $arrayElemAt: ['$teacherDetails.email', 0] }
          },
          schoolId: 1,
          date: 1,
          reason: 1,
          substituteTeacherId: {
            $cond: {
              if: { $gt: [{ $size: '$substituteDetails' }, 0] },
              then: {
                _id: { $arrayElemAt: ['$substituteDetails._id', 0] },
                name: { $arrayElemAt: ['$substituteDetails.name', 0] },
                email: { $arrayElemAt: ['$substituteDetails.email', 0] }
              },
              else: null
            }
          },
          status: 1,
          isTeacherApplied: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      { $sort: { date: 1 } }
    ]);

    console.log('Pending teacher-applied leaves:', absences);
    res.status(200).json({
      success: true,
      count: absences.length,
      data: absences
    });
  } catch (error) {
    next(error);
  }
};

// New endpoint for auto-generated absences
exports.getPendingAutoAbsences = async (req, res, next) => {
  try {
    const { schoolId } = req.user;
    const { startDate, endDate, teacherId } = req.query;

    if (!schoolId || !mongoose.Types.ObjectId.isValid(schoolId)) {
      throw new APIError('Valid schoolId is required', 400);
    }

    const matchStage = {
      schoolId: new mongoose.Types.ObjectId(schoolId),
      status: 'Pending',
      isTeacherApplied: false,
    };
    if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) {
      matchStage.teacherId = new mongoose.Types.ObjectId(teacherId);
    }
    if (startDate && endDate) {
      matchStage.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const absences = await TeacherAbsence.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'teachers', // Matches Teacher model collection name
          localField: 'teacherId',
          foreignField: '_id',
          as: 'teacherDetails',
        },
      },
      {
        $match: {
          teacherDetails: { $ne: [] }, // Exclude records with no matching teacher
        },
      },
      {
        $lookup: {
          from: 'teachers',
          localField: 'substituteTeacherId',
          foreignField: '_id',
          as: 'substituteDetails',
        },
      },
      {
        $project: {
          _id: 1,
          teacherId: {
            _id: { $arrayElemAt: ['$teacherDetails._id', 0] },
            name: { $arrayElemAt: ['$teacherDetails.name', 0] },
            email: { $arrayElemAt: ['$teacherDetails.email', 0] },
          },
          schoolId: 1,
          date: 1,
          reason: 1,
          substituteTeacherId: {
            $cond: {
              if: { $gt: [{ $size: '$substituteDetails' }, 0] },
              then: {
                _id: { $arrayElemAt: ['$substituteDetails._id', 0] },
                name: { $arrayElemAt: ['$substituteDetails.name', 0] },
                email: { $arrayElemAt: ['$substituteDetails.email', 0] },
              },
              else: null,
            },
          },
          status: 1,
          isTeacherApplied: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      { $sort: { date: 1 } },
    ]);

    // Log absences with invalid teacherId for debugging
    const invalidAbsences = await TeacherAbsence.find({
      ...matchStage,
      teacherId: { $nin: await mongoose.model('Teacher').distinct('_id') },
    });
    if (invalidAbsences.length > 0) {
      console.warn('Found absences with invalid teacherId:', invalidAbsences.map(a => ({
        _id: a._id,
        teacherId: a.teacherId,
        date: a.date,
      })));
    }

    console.log('Pending auto-generated absences:', absences);
    res.status(200).json({
      success: true,
      count: absences.length,
      data: absences,
    });
  } catch (error) {
    console.error('Error in getPendingAutoAbsences:', error);
    next(error);
  }
};