const nodemailer = require('nodemailer');
const twilio = require('twilio');
const School = require('../models/school');
const logger = require('../config/logger');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

exports.deliver = async (notification, session = null) => {
  let deliverySuccess = false;

  try {
    console.log('Delivering notification:', notification._id, 'Type:', notification.type);

    const school = session
      ? await School.findById(notification.schoolId).session(session)
      : await School.findById(notification.schoolId);
    const schoolName = school?.name || 'Your School';
    const preferredChannel = school?.preferredChannel || 'sms';

    const recipientPhone = notification.data.recipientPhone; // Use phone from data
    if (!recipientPhone) {
      throw new Error('No recipient phone number available');
    }

    const message = notification.message.substring(0, 160); // Limit to 160 characters

    // SMS
    if ((preferredChannel === 'sms' || preferredChannel === 'both') && recipientPhone) {
      try {
        const smsResult = await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+${recipientPhone.replace(/[^0-9]/g, '')}` // Ensure E.164 format
        });
        console.log('SMS sent to:', recipientPhone, 'SID:', smsResult.sid);
        deliverySuccess = true;
      } catch (smsErr) {
        console.error('SMS failed to:', recipientPhone, 'Error:', smsErr.message);
      }
    }

    // WhatsApp (simplified for now)
    if ((preferredChannel === 'whatsapp' || preferredChannel === 'both')) {
      try {
        const whatsappResult = await twilioClient.messages.create({
          body: message,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:+${recipientPhone.replace(/[^0-9]/g, '')}`
        });
        console.log('WhatsApp sent to:', recipientPhone, 'SID:', whatsappResult.sid);
        deliverySuccess = true;
      } catch (whatsappErr) {
        console.error('WhatsApp failed to:', recipientPhone, 'Error:', whatsappErr.message);
      }
    }

    notification.status = deliverySuccess ? 'delivered' : 'failed';
    notification.error = deliverySuccess ? undefined : 'Some delivery channels failed';
    if (session) {
      await notification.save({ session });
    } else {
      await notification.save();
    }
  } catch (err) {
    console.error('Delivery error for notification:', notification._id, 'Error:', err.message);
    notification.status = 'failed';
    notification.error = err.message;
    if (session) {
      await notification.save({ session });
    } else {
      await notification.save();
    }
    throw err;
  }
};