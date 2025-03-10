const Notification = require('../../models/notifiation');

// Send a notification
const sendNotification = async (req, res) => {
  const { title, message, recipientId } = req.body;

  try {
    const notification = new Notification({ title, message, recipientId, schoolId: req.user.schoolId });
    await notification.save();

    res.status(201).json({ message: 'Notification sent successfully', notification });
  } catch (err) {
    res.status(500).json({ message: 'Error sending notification', error: err.message });
  }
};

// Get notifications for a user
const getNotifications = async (req, res) => {
  const { recipientId } = req.params;

  try {
    const notifications = await Notification.find({ recipientId, schoolId: req.user.schoolId });
    res.status(200).json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching notifications', error: err.message });
  }
};

module.exports = { sendNotification, getNotifications };