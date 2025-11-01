const twilio = require('twilio');
const School = require('../models/school');
const User = require('../models/user');
const logger = require('../config/logger');
require('dotenv').config();
const nodemailer = require('nodemailer');

// Validate environment variables
const requiredEnvVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'TWILIO_WHATSAPP_NUMBER',
  'TWILIO_VERIFY_SERVICE_SID',
  'EMAIL_USER',
  'EMAIL_PASS'
];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // e.g., shafisadique123@gmail.com
    pass: process.env.EMAIL_PASS  // e.g., ijes nlam jjdg pmqp (App Password)
  }
});

exports.deliver = async (notification, session = null) => {
  let deliverySuccess = false;
  let deliveryErrors = [];

  try {
    console.log('Delivering notification:', notification._id, 'Type:', notification.type);

    // Fetch school for preferredChannel
    const school = session
      ? await School.findById(notification.schoolId).session(session)
      : await School.findById(notification.schoolId);
    const schoolName = school?.name || 'Your School';
    const preferredChannel = school?.preferredChannel || 'sms';

    // Fetch recipient for phone number and email
    const recipient = session
      ? await User.findById(notification.recipientId).session(session)
      : await User.findById(notification.recipientId);
    if (!recipient) {
      throw new Error('Recipient not found');
    }
    const recipientPhone = notification.data.recipientPhone;
    const recipientEmail = recipient.email; // Assuming User model has an email field

    // Prepare messages
    const smsMessage = notification.message.substring(0, 160); // For SMS/WhatsApp
    const emailSubject = `Welcome to ${schoolName}!`;
    const emailText = notification.message; // Full message for email

    // SMS delivery
    if ((preferredChannel === 'sms' || preferredChannel === 'both') && recipientPhone) {
      try {
        const smsResult = await twilioClient.messages.create({
          body: smsMessage,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+${recipientPhone.replace(/[^0-9]/g, '')}`
        });
        logger.info(`SMS sent to ${recipientPhone}: SID ${smsResult.sid}`);
        console.log('SMS sent to:', recipientPhone, 'SID:', smsResult.sid);
        deliverySuccess = true;
      } catch (smsErr) {
        logger.error(`SMS failed to ${recipientPhone}: ${smsErr.message}`);
        console.error('SMS failed to:', recipientPhone, 'Error:', smsErr.message);
        deliveryErrors.push(`SMS: ${smsErr.message}`);
      }
    }

    // WhatsApp delivery
    if ((preferredChannel === 'whatsapp' || preferredChannel === 'both') && recipientPhone) {
      try {
        const whatsappResult = await twilioClient.messages.create({
          body: smsMessage,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:+${recipientPhone.replace(/[^0-9]/g, '')}`
        });
        logger.info(`WhatsApp sent to ${recipientPhone}: SID ${whatsappResult.sid}`);
        console.log('WhatsApp sent to:', recipientPhone, 'SID:', whatsappResult.sid);
        deliverySuccess = true;
      } catch (whatsappErr) {
        logger.error(`WhatsApp failed to ${recipientPhone}: ${whatsappErr.message}`);
        console.error('WhatsApp failed to:', recipientPhone, 'Error:', whatsappErr.message);
        deliveryErrors.push(`WhatsApp: ${whatsappErr.message}`);
      }
    }

    // Email delivery
    if (recipientEmail) {
      try {
        const emailOptions = {
          from: process.env.EMAIL_USER,
          to: recipientEmail,
          subject: emailSubject,
          text: emailText,
          html: `<p>${emailText.replace(/\n/g, '<br>')}</p>` // Convert to HTML for better formatting
        };
        const emailResult = await transporter.sendMail(emailOptions);
        logger.info(`Email sent to ${recipientEmail}: Message ID ${emailResult.messageId}`);
        console.log('Email sent to:', recipientEmail, 'Message ID:', emailResult.messageId);
        deliverySuccess = true;
      } catch (emailErr) {
        logger.error(`Email failed to ${recipientEmail}: ${emailErr.message}`);
        console.error('Email failed to:', recipientEmail, 'Error:', emailErr.message);
        deliveryErrors.push(`Email: ${emailErr.message}`);
      }
    }

    // Update notification status
    notification.status = deliverySuccess ? 'delivered' : 'failed';
    notification.error = deliveryErrors.length > 0 ? deliveryErrors.join('; ') : undefined;
    if (session) {
      await notification.save({ session });
    } else {
      await notification.save();
    }
  } catch (err) {
    logger.error(`Delivery error for notification ${notification._id}: ${err.message}`);
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