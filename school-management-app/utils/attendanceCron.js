const cron = require('node-cron');
const mongoose = require('mongoose');
const Teacher = require('../models/teacher');
const TeacherAttendance = require('../models/teacherAttendance');
const Holiday = require('../models/holiday');
const TeacherAbsence = require('../models/teacherAbsence');
const School = require('../models/school');
const User = require('../models/user');

cron.schedule('*/10 * * * *', async () => { // Runs every 10 minutes
  console.log('Cron job started:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const istOffset = 5.5 * 60 * 60 * 1000;
      const todayIST = new Date(today.getTime() + istOffset);
      todayIST.setHours(0, 0, 0, 0);
      console.log('Processing date:', todayIST);

      const schools = await School.find().select('_id').lean().session(session);
      for (const school of schools) {
        const schoolId = school._id;
        console.log('Processing school:', schoolId.toString());

        const adminUser = await User.findOne({ schoolId, role: 'admin' })
          .select('_id')
          .lean()
          .session(session);
        if (!adminUser) {
          console.warn(`No admin found for school ${schoolId}. Skipping.`);
          continue;
        }
        console.log('Admin found:', adminUser._id.toString());

        const schoolDetails = await School.findById(schoolId).session(session);
        const weeklyHolidayDay = schoolDetails.weeklyHolidayDay;
        const todayDay = todayIST.toLocaleDateString('en-US', { weekday: 'long' });

        if (todayDay === weeklyHolidayDay) {
          console.log(`Skipping attendance for school ${schoolId} as today (${todayDay}) is a weekly holiday.`);
          continue;
        }

        const holiday = await Holiday.findOne({ schoolId, date: todayIST }).session(session);
        if (holiday) {
          console.log(`Holiday found for school ${schoolId} on ${todayIST}. Skipping.`);
          continue;
        }

        const teachers = await Teacher.find({ schoolId, status: true }).session(session);
        for (const teacher of teachers) {
          const attendance = await TeacherAttendance.findOne({
            teacherId: teacher._id,
            date: todayIST,
          }).session(session);
          if (attendance) {
            console.log(`Attendance already exists for teacher ${teacher._id} on ${todayIST}: ${attendance.status}`);
            continue;
          }

          const approvedLeave = await TeacherAbsence.findOne({
            teacherId: teacher._id,
            schoolId,
            date: todayIST,
            status: 'Approved',
          }).session(session);
          if (approvedLeave) {
            console.log(`Approved leave found for teacher ${teacher._id} on ${todayIST}. Skipping.`);
            continue;
          }

          console.log(`Marking absence for teacher ${teacher._id} in school ${schoolId}`);
          await TeacherAttendance.create(
            [{
              teacherId: teacher._id,
              schoolId,
              date: todayIST,
              status: 'Absent',
              remarks: 'Auto-marked as absent (no attendance recorded)',
              recordedBy: adminUser._id,
            }],
            { session }
          );
          await TeacherAbsence.create(
            [{
              teacherId: teacher._id,
              schoolId,
              date: todayIST,
              reason: 'Unplanned absence',
              status: 'Pending',
              leaveType: 'Unpaid',
            }],
            { session }
          );
          const teacherDoc = await Teacher.findById(teacher._id).session(session);
          if (teacherDoc && teacherDoc.leaveBalance > 0) {
            teacherDoc.leaveBalance -= 1;
            await teacherDoc.save({ session });
          }
        }
      }
    });
    console.log('Cron job completed successfully');
  } catch (error) {
    console.error('Cron job error:', error);
  } finally {
    await session.endSession();
  }
});

module.exports = cron;