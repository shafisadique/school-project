const Announcement = require('../../models/announcement');
const School = require('../../models/school'); // Adjust path to your School model
const User = require('../../models/user'); // Adjust path
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const moment = require('moment-timezone');
const logger = require('winston'); // Or console if not using Winston
const student =require('../../models/student');
const teacher = require ('../../models/teacher')
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const transporter = nodemailer.createTransport({
  // Your existing Gmail/SMTP config here
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  secure: false,
  tls: { rejectUnauthorized: false } // From prior fixes
});

// createAnnouncement (Updated)
const createAnnouncement = async (req, res) => {
  try {
    const { title, body, targetRoles = [], targetUsers = [] } = req.body;
    const schoolId = req.user.schoolId;
    const createdBy = req.user._id || req.user.id || req.user.userId;

    const announcement = new Announcement({
      title,
      body,
      schoolId,
      createdBy,
      roles: targetRoles
    });
    await announcement.save();

    // ✅ renamed variable & function
    const targetInfo = targetUsers.length > 0 ? { users: targetUsers } : { roles: targetRoles };
    notifyTargetsFn(announcement, schoolId, targetInfo).catch(err => logger.error('Notify error:', err));

    res.status(201).json({ message: 'Announcement created & sent', data: announcement });
  } catch (err) {
    logger.error('Create announcement error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


// notifyTargets (Updated for targetUsers)
const notifyTargetsFn = async (announcement, schoolId, targets) => {
  try {
    const school = await School.findById(schoolId).select('name smsPackActive remainingSms smsPlan smsExpiry smtpConfig email');
    if (!school) throw new Error(`School ${schoolId} not found`);

    const { active: packActive, remaining: remainingSms, plan, expired } = await getRemainingSmsPack(schoolId);
    if (!packActive || expired) {
      logger.warn(`SMS pack inactive/expired for school ${schoolId}. Portal only.`);
    }

    let allUsers = []; // Collect targets

    if (targets.users && targets.users.length > 0) {
      // Specific users: Fetch by IDs
      allUsers = await User.find({ _id: { $in: targets.users }, schoolId }).select('name email phone role').lean();
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
          roleUsers = await Teacher.find({ schoolId, status: true }).select('name email phone').lean();
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

    const smsEligibleCount = allUsers.filter(u => u.phone && /^\d{10}$/.test(u.phone)).length;
    let smsSent = 0, emailSent = 0, portalOnly = false;

    // All-or-Nothing SMS
    if (packActive && !expired && remainingSms >= smsEligibleCount && smsEligibleCount > 0) {
      const smsUsers = allUsers.filter(u => u.phone && /^\d{10}$/.test(u.phone));
      for (const user of smsUsers) {
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

// Get/Check Remaining SMS Pack (Includes Expiry)
const getRemainingSmsPack = async (schoolId) => {
  const school = await School.findById(schoolId).select('smsPackActive remainingSms smsExpiry smsPlan');
  if (!school) {
    logger.error(`School ${schoolId} not found`);
    return { active: false, remaining: 0, plan: 'trial', expired: false };
  }

  const today = moment.tz('Asia/Kolkata');
  const expired = school.smsExpiry && school.smsExpiry < today.toDate();
  if (expired) {
    school.smsPackActive = false;
    school.remainingSms = 0;
    await school.save();
    logger.warn(`SMS pack expired for school ${schoolId}`);
  }

  return {
    active: school.smsPackActive && !expired,
    remaining: school.remainingSms || 0,
    plan: school.smsPlan,
    expired
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


module.exports = { createAnnouncement, getAnnouncements, getSmsStatus };