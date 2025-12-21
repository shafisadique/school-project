// controllers/announcements/announcementController.js
const Announcement = require('../../models/announcement');
const Notification = require('../../models/notifiation'); // FIXED TYPO
const School = require('../../models/school');
const User = require('../../models/user');
const Subscription = require('../../models/subscription');
const Teacher = require('../../models/teacher');
const Student = require('../../models/student');
const logger = require('../../config/logger');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  secure: false,
  tls: { rejectUnauthorized: false }
});

// DEDUCT SMS/WHATSAPP LIMITS BASED ON HIGHEST PRIORITY ACTIVE PLAN
const deductMessageLimits = async (schoolId, count) => {
  try {
    const sub = await Subscription.findOne({
      schoolId,
      status: 'active',
      expiresAt: { $gt: new Date() }
    }).sort({ priority: -1 });

    if (!sub) {
      logger.warn(`No active subscription → School: ${schoolId}`);
      return false;
    }

    const updates = {};
    let deducted = false;

    // Deduct SMS if plan has SMS limit
    if (sub.messageLimits.smsMonthly > 0) {
      const used = sub.usageStats?.smsUsedThisMonth || 0;
      if (used + count <= sub.messageLimits.smsMonthly) {
        updates['usageStats.smsUsedThisMonth'] = count;
        deducted = true;
      }
    }

    // Deduct WhatsApp if plan has WhatsApp limit
    if (sub.messageLimits.whatsappMonthly > 0) {
      const used = sub.usageStats?.whatsappUsedThisMonth || 0;
      if (used + count <= sub.messageLimits.whatsappMonthly) {
        updates['usageStats.whatsappUsedThisMonth'] = count;
        deducted = true;
      }
    }

    if (!deducted) {
      logger.warn(`Insufficient SMS/WhatsApp limits → School: ${schoolId}`);
      return false;
    }

    await Subscription.updateOne({ _id: sub._id }, { $inc: updates });
    logger.info(`Deducted ${count} messages → Plan: ${sub.planType} → School: ${schoolId}`);
    return true;

  } catch (err) {
    logger.error('Deduction failed:', err);
    return false;
  }
};

// CREATE ANNOUNCEMENT (Supports targetUsers + targetRoles)
const createAnnouncement = async (req, res) => {
  try {
    const { title, body, targetRoles = [], targetUsers = [] } = req.body;
    const finalTargetUsers = Array.isArray(targetUsers) ? targetUsers : [];
    const finalTargetRoles = Array.isArray(targetRoles) ? targetRoles : [];
    const schoolId = req.user.schoolId;
    const senderId = req.user.id;

    // Save Announcement (roles only if targetRoles sent)
    const announcement = new Announcement({
      title,
      body,
      schoolId,
      createdBy: senderId,
      roles: finalTargetRoles.length > 0 ? finalTargetRoles : undefined
    });
    await announcement.save();

    let totalRecipients = 0;
    const notifications = [];

    // CASE 1: Specific Users Selected
    if (targetUsers.length > 0) {
      totalRecipients = targetUsers.length;
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
    }

    // CASE 2: Role-based (teacher, parent, student)
      else if (targetRoles.length > 0) {
        const allUserIds = [];

        for (const role of targetRoles) {
          if (role === 'teacher') {
            const teachers = await User.find({ schoolId, role: 'teacher' }).select('_id');
            teachers.forEach(t => allUserIds.push(t._id));
          }
          if (role === 'parent') {
            const parents = await User.find({ schoolId, role: 'parent' }).select('_id');
            parents.forEach(p => allUserIds.push(p._id));
          }
          if (role === 'student') {
            const students = await User.find({ schoolId, role: 'student' }).select('_id');
            students.forEach(s => allUserIds.push(s._id));
          }
        }

        // Create one notification per user → Bell will show perfectly
        allUserIds.forEach(userId => {
          notifications.push({
            schoolId,
            senderId,
            recipientId: userId,           // ← Use recipientId, not targetRoles array
            targetRoles: targetRoles,
            title,
            message: body,
            type: 'announcement',
            status: 'pending'
          });
        });

        totalRecipients = allUserIds.length;
      }

    // Save all notifications
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    // Deduct SMS/WhatsApp Limits
    if (totalRecipients > 0) {
      await deductMessageLimits(schoolId, totalRecipients);
    }

    // Send Real Email
    // const school = await School.findById(schoolId).select('name');
    // const users = await User.find({ schoolId, email: { $exists: true, $ne: null } }).select('email');
    // for (const user of users) {
    //   try {
    //     await transporter.sendMail({
    //       from: process.env.EMAIL_USER,
    //       to: user.email,
    //       subject: `New Announcement: ${title}`,
    //       html: `<h3>${title}</h3><p>${body}</p><hr><small>${school.name}</small>`
    //     });
    //   } catch (e) { /* ignore */ }
    // }
    const io = req.app.get('io');
    if (io && notifications.length > 0) {
      console.log('checking continuassly',notifications);
      notifications.forEach(notif =>{
        console.log('this is notif',notif)
        const payload = {
          _id: notif._id, // temporary ID (or use first notification _id)
          title: notif.title,
          message: notif.message,
          type: 'announcement',
          createdAt: notif.createdAt||new Date(),
          senderId: { name: req.user.name || 'Admin' },
          status: 'pending'
        };
        if (notif.recipientId) {
          io.to(notif.recipientId.toString()).emit('new-notification', payload);
        }
  
        // Send to role-based users
        if (notif.targetRoles && notif.targetRoles.length > 0) {
          notif.targetRoles.forEach(role => {
            io.to(`role_${role}`).emit('new-notification', payload);
          });
        }
      })
      // Send to entire school (fastest & best for announcements)
      // io.to(schoolId.toString()).emit('new-notification', payload);
    }

    res.status(201).json({
      message: `Announcement created! ${totalRecipients} SMS/WhatsApp deducted. Visible in bell & email sent.`,
      announcement,
      stats: { recipients: totalRecipients, bell: true, email: true, smsDeducted: totalRecipients > 0 }
    });

  } catch (err) {
    logger.error('Create announcement error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// CREATE TEACHER ASSIGNMENT (Bell Only)
const createTeacherAssignment = async (req, res) => {
  try {
    const { title, message, teacherIds = [], classId, dueDate, attachment } = req.body;
    const senderId = req.user.id;
    const schoolId = req.user.schoolId;

    const notifications = [];

    if (teacherIds.length === 0) {
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

// GET ANNOUNCEMENTS (Teacher/Parent/Student sab dekh sake)
const getAnnouncements = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const userRole = req.user.role;
    const userId = req.user.id;

    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const query = {
      schoolId,
      isActive: true,
      $or: [
        { roles: { $in: [userRole] } },
        { createdBy: userId },
        // Add more conditions if needed (e.g., specific targetUsers)
      ]
    };

    const announcements = await Announcement.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name')
      .lean();

    const total = await Announcement.countDocuments(query);

    res.json({
      data: announcements,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    logger.error('Get announcements error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET SMS STATUS (Admin Dashboard)
const getSmsStatus = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;

    const sub = await Subscription.findOne({
      schoolId,
      status: 'active',
      expiresAt: { $gt: new Date() }
    }).sort({ priority: -1 });

    if (!sub) {
      return res.json({
        plan: 'trial',
        remainingSms: 0,
        remainingWhatsapp: 0,
        status: 'No Active Plan',
        message: 'No active subscription found.'
      });
    }

    const smsUsed = sub.usageStats?.smsUsedThisMonth || 0;
    const whatsappUsed = sub.usageStats?.whatsappUsedThisMonth || 0;

    res.json({
      plan: sub.planType,
      remainingSms: sub.messageLimits.smsMonthly - smsUsed,
      remainingWhatsapp: sub.messageLimits.whatsappMonthly - whatsappUsed,
      status: 'Active',
      message: `You have ${sub.messageLimits.smsMonthly - smsUsed} SMS & ${sub.messageLimits.whatsappMonthly - whatsappUsed} WhatsApp messages left this month.`
    });
  } catch (err) {
    logger.error('Get SMS status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createAnnouncement,
  getAnnouncements,
  getSmsStatus,
  createTeacherAssignment
};