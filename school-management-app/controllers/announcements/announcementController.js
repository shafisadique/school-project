// controllers/announcements/announcementController.js
const Announcement = require('../../models/announcement');
const Notification = require('../../models/notifiation'); // ← CORRECT IMPORT (no typo!)
const School = require('../../models/school');
const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const nodemailer = require('nodemailer');
const moment = require('moment-timezone');
const logger = require('../../config/logger'); // ← Use your fixed logger
const User = require('../../models/user'); 
const Subscription = require('../../models/subscription');
const teacher = require('../../models/teacher');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  secure: false,
  tls: { rejectUnauthorized: false }
});

const createAnnouncement = async (req, res) => {
  try {
    const { title, body, targetRoles = [], targetUsers = [] } = req.body;
    const schoolId = req.user.schoolId;
    const senderId = req.user.id;

    // 1. Save Announcement
    const announcement = new Announcement({
      title,
      body,
      schoolId,
      createdBy: senderId,  // ← FIXED
      roles: targetRoles.length > 0 ? targetRoles : undefined
    });
    await announcement.save();

    // 2. Create Bell Notifications
    const notifications = [];

    if (targetUsers.length > 0) {
      targetUsers.forEach(userId => {
        notifications.push({
          schoolId,
          senderId,
          recipientId: userId,
          title,
          message: body,
          type: 'announcement',
          status: 'pending'
        });
      });
    } else if (targetRoles.length > 0) {
      notifications.push({
        schoolId,
        senderId,
        targetRoles,
        title,
        message: body,
        type: 'announcement',
        status: 'pending'
      });
    }

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    // 3. Send SMS + Email
    const targetInfo = targetUsers.length > 0 ? { users: targetUsers } : { roles: targetRoles };
    console.log(targetInfo,'this is target info')
    notifyTargetsFn(announcement, schoolId, targetInfo).catch(err => 
      logger.error('SMS/Email failed:', err)
    );

    res.status(201).json({
      message: 'Announcement created + sent + visible in bell!',
      announcement
    });

  } catch (err) {
    logger.error('Create announcement error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// 2. Send Assignment to Teachers (Bell Icon Only)
const createTeacherAssignment = async (req, res) => {
  try {
    const { title, message, teacherIds = [], classId, dueDate, attachment } = req.body;
    const senderId = req.user.id;
    const schoolId = req.user.schoolId;

    const notifications = [];

    if (teacherIds.length === 0) {
      // All teachers
      notifications.push({
        schoolId,
        senderId,
        targetRoles: ['teacher'],
        title,
        message,
        type: 'assignment',
        data: { classId, dueDate, attachment },
        status: 'pending'
      });
    } else {
      // Specific teachers
      teacherIds.forEach(id => {
        notifications.push({
          schoolId,
          senderId,
          recipientId: id,
          title,
          message,
          type: 'assignment',
          data: { classId, dueDate, attachment },
          status: 'pending'
        });
      });
    }

    await Notification.insertMany(notifications);
    res.json({ message: 'Assignment sent to teachers (visible in bell)!' });
  } catch (error) {
    res.status(500).json({ message: 'Failed' });
  }
};


// notifyTargets (Updated for targetUsers)
const notifyTargetsFn = async (announcement, schoolId, targets) => {
  try {
    const school = await School.findById(schoolId).select('name smsPackActive remainingSms smsPlan smsExpiry smtpConfig email');
    console.log(school)
    if (!school) throw new Error(`School ${schoolId} not found`);

    const { active, remaining, plan, expired } = await getRemainingSmsPack(schoolId);
    const packActive = active;
    const remainingSms = remaining;
    console.log('this is active',active,'this is remaining',remainingSms,plan,expired)
    if (!packActive || expired) {
      logger.warn(`SMS pack inactive/expired for school ${schoolId}. Portal only.`);
    }

    let allUsers = []; // Collect targets
    console.log(targets)
    if (targets.users && targets.users.length > 0) {
      // Specific users: Fetch by IDs
      allUsers = await User.find({ _id: { $in: targets.users }, schoolId }).select('name email phone role').lean();
      console.log(allUsers)
    } else if (targets.roles && targets.roles.length > 0) {
      // Bulk roles (as before)
      for (const role of targets.roles) {
        let roleUsers;
        if (role === 'student') {
          const students = await Student.find({ schoolId, status: true }).select('name email parents classId').lean();
          roleUsers = students.map(s => ({
            _id: s._id,
            name: s.name,
            email: s.email,
            phone: s.parents?.fatherPhone || s.parents?.motherPhone
          })).filter(u => u.phone);
        } else if (role === 'teacher') {
          roleUsers = await teacher.find({ schoolId, status: true }).select('name email phone').lean();
        } else if (role === 'parent') {
          const students = await Student.find({ schoolId, status: true }).select('name email parents').lean();
          const parentMap = new Map();
          students.forEach(s => {
            const father = s.parents.fatherPhone ? { name: `Father of ${s.name}`, email: s.email, phone: s.parents.fatherPhone } : null;
            const mother = s.parents.motherPhone ? { name: `Mother of ${s.name}`, email: s.email, phone: s.parents.motherPhone } : null;
            if (father) parentMap.set(father.phone, father);
            if (mother) parentMap.set(mother.phone, mother);
          });
          roleUsers = Array.from(parentMap.values());
        }
        allUsers.push(...roleUsers);
      }
    }

    if (allUsers.length === 0) return;
    console.log(allUsers)
    const smsEligibleCount = allUsers.filter(u => u.phone && /^\d{10}$/.test(u.phone)).length;
    let smsSent = 0, emailSent = 0, portalOnly = false;
    console.log(packActive,expired,remainingSms,smsEligibleCount,'checking sms ')
    // All-or-Nothing SMS
    if (packActive && !expired && remainingSms >= smsEligibleCount && smsEligibleCount > 0) {
      const smsUsers = allUsers.filter(u => u.phone && /^\d{10}$/.test(u.phone));
      for (const user of smsUsers) {
        console.log('is this sms working ')
        console.log(user);
        const message = `New Announcement: ${announcement.title}\n${announcement.body}`;
        try {
          await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE,
            to: `+91${user.phone}`
          });
          smsSent++;
          await School.findByIdAndUpdate(schoolId, { $inc: { remainingSms: -1 } });
        } catch (smsError) {
          logger.error(`SMS failed: ${smsError.message}`);
        }
      }
    } else if (smsEligibleCount > 0) {
      portalOnly = true;
      logger.warn(`SMS skipped: Need ${smsEligibleCount}, have ${remainingSms}`);
    }

    // Emails
    for (const user of allUsers) {
      if (user.email) {
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: `Announcement: ${announcement.title}`,
            html: `<h2>${announcement.title}</h2><p>${announcement.body}</p>`
          });
          emailSent++;
        } catch (emailErr) {
          logger.error(`Email failed: ${emailErr.message}`);
        }
      }
    }

    logger.info(`Notified ${allUsers.length} users: ${smsSent} SMS, ${emailSent} emails`);
  } catch (err) {
    logger.error('Notify error:', err);
  }
};

// Get Filtered Announcements (Paginated)
const getAnnouncements = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const role = req.user.role; // From auth
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const announcements = await Announcement.find({
      schoolId,
      roles: { $in: [role] }, // Only show if targeted to user's role
      isActive: true
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('createdBy', 'name') // Who sent it
    .lean();

    const total = await Announcement.countDocuments({ 
      schoolId, 
      roles: { $in: [role] }, 
      isActive: true 
    });

    res.json({ 
      data: announcements, 
      pagination: { page, limit, total, pages: Math.ceil(total / limit) } 
    });
  } catch (err) {
    logger.error('Get announcements error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getRemainingSmsPack = async (schoolId) => {
  // First check active subscription
  const activeSub = await Subscription.findOne({
    schoolId,
    status: 'active',
    expiresAt: { $gt: new Date() }
  }).sort({ priority: -1 });
  console.log(activeSub)

  if (activeSub && activeSub.messageLimits?.smsMonthly > 0) {
    return {
      active: true,
      remaining: activeSub.messageLimits.smsMonthly - (activeSub.usageStats?.smsUsedThisMonth || 0),
      plan: activeSub.planType,
      expired: false
    };
  }

  // Fallback to old school fields (for backward compatibility)
  const school = await School.findById(schoolId);
  return {
    active: school?.smsPackActive || false,
    remaining: school?.remainingSms || 0,
    plan: 'trial',
    expired: true
  };
};

// Get SMS Status (For Admin Dashboard)
const getSmsStatus = async (req, res) => {
  try {
    const { active, remaining, plan, expired } = await getRemainingSmsPack(req.user.schoolId);
    const status = expired ? 'Expired' : active ? 'Active' : 'Inactive';
    res.json({
      plan,
      remainingSms: remaining,
      status,
      message: `Your ${plan} plan has ${remaining} SMS credits${expired ? ' (expired—renew to activate)' : ''}.`
    });
  } catch (err) {
    logger.error('Get SMS status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


module.exports = { createAnnouncement, getAnnouncements, getSmsStatus,createTeacherAssignment };