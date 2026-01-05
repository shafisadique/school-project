const cron = require('node-cron');
const mongoose = require('mongoose');
const Teacher = require('../models/teacher');
const TeacherAttendance = require('../models/teacherAttendance');
const TeacherAbsence = require('../models/teacherAbsence');
const Holiday = require('../models/holiday');
const School = require('../models/school');
const User = require('../models/user');

// Helper to get academic year ID
async function getAcademicYearId(schoolId, session) {
  const school = await School.findById(schoolId).select('activeAcademicYear').session(session);
  if (!school) {
    console.error(`School not found: ${schoolId}`);
    throw new Error('School not found');
  }
  if (!school.activeAcademicYear) {
    console.error(`No active academic year for school: ${schoolId}`);
    throw new Error('No active academic year set for school');
  }
  console.log(`Using school's activeAcademicYear for school ${schoolId}: ${school.activeAcademicYear}`);
  return school.activeAcademicYear;
}

// Cron job: Runs daily at 3 PM IST
cron.schedule('* 15 * * *', async () => {
  console.log('Cron job started:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const istOffset = 5.5 * 60 * 60 * 1000;
      const todayIST = new Date(today.getTime() + istOffset);
      todayIST.setHours(0, 0, 0, 0);

      const schools = await School.find().select('_id activeAcademicYear').lean().session(session);
      if (!schools.length) {
        console.warn('No schools found in database');
        return;
      }

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

        let academicYearId;
        try {
          academicYearId = await getAcademicYearId(schoolId, session);
        } catch (err) {
          console.warn(`Skipping school ${schoolId}: ${err.message}`);
          continue;
        }

        const schoolDetails = await School.findById(schoolId).session(session);
        if (!schoolDetails) {
          console.warn(`School details not found for ${schoolId}. Skipping.`);
          continue;
        }

        const weeklyHolidayDay = schoolDetails.weeklyHolidayDay;
        const todayDay = todayIST.toLocaleDateString('en-US', { weekday: 'long' });
        if (todayDay === weeklyHolidayDay) {
          console.log(`Skipping school ${schoolId}: Today (${todayDay}) is a weekly holiday.`);
          continue;
        }

        const holiday = await Holiday.findOne({ schoolId, date: todayIST }).session(session);
        if (holiday) {
          console.log(`Skipping school ${schoolId}: Holiday found on ${todayIST}.`);
          continue;
        }

        const teachers = await Teacher.find({ schoolId, status: true }).session(session);
        if (!teachers.length) {
          console.warn(`No active teachers found for school ${schoolId}. Skipping.`);
          continue;
        }
        
        for (const teacher of teachers) {
          const attendance = await TeacherAttendance.findOne({
            teacherId: teacher._id,
            date: todayIST,
            academicYearId
          }).session(session);
          if (attendance) {
            console.log(`Skipping teacher ${teacher._id}: Attendance exists (${attendance.status}) on ${todayIST}.`);
            continue;
          }

          const approvedLeave = await TeacherAbsence.findOne({
            teacherId: teacher._id,
            schoolId,
            date: todayIST,
            status: 'Approved',
            isTeacherApplied: true,
            academicYearId
          }).session(session);
          if (approvedLeave) {
            console.log(`Skipping teacher ${teacher._id}: Approved leave found on ${todayIST}.`);
            continue;
          }

          console.log(`Creating absence records for teacher ${teacher._id} in school ${schoolId}`);
          await TeacherAttendance.create([{
            teacherId: teacher._id,
            schoolId,
            academicYearId,
            date: todayIST,
            status: 'Absent',
            remarks: 'Auto-marked as absent (no attendance recorded)',
            recordedBy: adminUser._id
          }], { session });

          await TeacherAbsence.create([{
            teacherId: teacher._id,
            schoolId,
            academicYearId,
            date: todayIST,
            reason: 'Unplanned absence (forgot to mark attendance)',
            status: 'Pending',
            leaveType: 'Unpaid',
            isTeacherApplied: false
          }], { session });

          console.log(`Created attendance and absence for teacher ${teacher._id} on ${todayIST}`);
        }
      }
    });
  } catch (error) {
    console.error('Cron job error:', error.message, error.stack);
  } finally {
    await session.endSession();
    console.log('Cron job completed:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  }
});

module.exports = cron;