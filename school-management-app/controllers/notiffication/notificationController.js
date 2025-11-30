const Notification = require('../../models/notifiation');
const { sendSMS } = require('../../services/smsService'); // Your existing SMS
const notificationService = require('../../services/notificationService'); // New service for email/push
const Joi = require('joi');
const logger = require('winston'); // Logging
const APIError = require('../../utils/apiError'); // Import APIError
// Validation schema
const createNotificationSchema = Joi.object({
  type: Joi.string().valid('progress-report', 'absence', 'fee-alert', 'general').required(),
  title: Joi.string().required(),
  message: Joi.string().required(),
  recipientId: Joi.string().required(),
  studentId: Joi.string().required(),
  data: Joi.object().optional()
});

// Create/Send Notification
exports.sendNotification = async (req, res) => {
  const { error } = createNotificationSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const notification = new Notification({
      schoolId: req.user.schoolId, // From auth middleware
      senderId: req.user._id, // From auth
      ...req.body
    });
    await notification.save();
    const io = req.app.get('io');
    if (io) {
      io.to(notification.recipientId.toString()).emit('new-notification', {
        _id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt,
        senderId: { name: req.user.name },
        status: 'pending'
      });
      io.to(req.user.schoolId.toString()).emit('new-notification', {
        _id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt,
        senderId: { name: req.user.name || 'Admin' },
        status: 'pending'
      });
    }
    // Trigger deliveries based on type
    await notificationService.deliver(notification);

    res.status(201).json({ message: 'Notification sent successfully', notification });
  } catch (err) {
    logger.error('Error sending notification:', err);
    res.status(500).json({ message: 'Error sending notification', error: err.message });
  }
};

// Get Notifications (with pagination and type filter)
exports.getNotifications = async (req, res) => {
  const { page = 1, limit = 10, type } = req.query;
  const skip = (page - 1) * limit;
  const filter = { schoolId: req.user.schoolId };

  try {
    // Check if user is a parent
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'parent') {
      // For parents, filter by their linked studentId
      const studentId = user.additionalInfo?.parentOfStudentId;
      if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(200).json({ notifications: [], total: 0, page, pages: 0 });
      }
      filter.studentId = studentId;
      filter.recipientId = req.user._id; // Ensure notifications are for the parent
    } else {
      // For other roles, filter by recipientId or senderId
      filter.$or = [
        { recipientId: req.user._id },
        { senderId: req.user._id }
      ];
    }

    if (type) filter.type = type;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('studentId', 'name admissionNo')
      .populate('senderId', 'name');

    const total = await Notification.countDocuments(filter);
    res.status(200).json({ notifications, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    logger.error('Error fetching notifications:', err);
    res.status(500).json({ message: 'Error fetching notifications', error: err.message });
  }
};

// Mark as Read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, recipientId: req.user._id, schoolId: req.user.schoolId });
    if (!notification) return res.status(404).json({ message: 'Notification not found' });

    notification.status = 'read';
    await notification.save();
    res.status(200).json(notification);
  } catch (err) {
    logger.error('Error marking as read:', err);
    res.status(500).json({ message: 'Error marking as read', error: err.message });
  }
};