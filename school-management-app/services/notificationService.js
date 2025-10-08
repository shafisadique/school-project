const nodemailer = require('nodemailer');
const twilio = require('twilio');
const User = require('../models/user');
const School = require('../models/school');
const logger = require('../config/logger'); // Use custom Winston logger
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // Temporary workaround for SSL issue
  }
});

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

exports.deliver = async (notification, session = null) => {
  let deliverySuccess = false; // Track if any channel succeeds

  try {
    console.log('Delivering notification:', notification._id, 'Type:', notification.type);

    const user = session
      ? await User.findById(notification.recipientId).session(session)
      : await User.findById(notification.recipientId);
    if (!user) {
      console.error('User not found for notification:', notification.recipientId);
      throw new Error(`User not found for notification ${notification._id}`);
    }

    const school = session
      ? await School.findById(notification.schoolId).session(session)
      : await School.findById(notification.schoolId);
    const schoolName = school?.name || 'Your School';
    const preferredChannel = school?.preferredChannel || 'sms';

    console.log('User found:', user._id, 'Email:', user.email, 'Phone:', user.phoneNumber, 'WhatsApp:', user.whatsappNumber, 'OptIn:', user.whatsappOptIn);

    // Email
    if (['progress-report', 'fee-alert', 'welcome'].includes(notification.type) && user.email) {
      try {
        const mailOptions = {
          from: `${schoolName} <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: notification.title
        };

        if (notification.type === 'welcome') {
          mailOptions.html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
              <h2 style="color: #1a73e8;">Welcome to ${schoolName}!</h2>
              <p>Dear ${user.name},</p>
              <p>Congratulations! Your school, <strong>${schoolName}</strong>, has been successfully registered.</p>
              <h3 style="color: #333;">Your Login Credentials:</h3>
              <ul>
                <li><strong>Username:</strong> ${notification.data.username}</li>
                <li><strong>Set Password:</strong> <a href="${notification.data.loginUrl}" style="color: #1a73e8;">Click here to set your password</a></li>
              </ul>
              <p>You can now manage your school's operations, including attendance, fees, and notifications.</p>
              <p>For assistance, contact our support team at <a href="mailto:support@example.com" style="color: #1a73e8;">support@example.com</a>.</p>
              <p style="margin-top: 20px;">Best regards,<br><strong>The SchoolSync Team</strong></p>
              <hr style="border-top: 1px solid #e0e0e0;">
              <p style="font-size: 12px; color: #666;">This is an automated message. Please do not reply directly to this email.</p>
            </div>
          `;
        } else {
          mailOptions.text = notification.message + (notification.data ? `\nDetails: ${JSON.stringify(notification.data)}` : '');
        }

        const emailResult = await transporter.sendMail(mailOptions);
        console.log('Email sent to:', user.email, 'Message ID:', emailResult.messageId);
        deliverySuccess = true;
      } catch (err) {
        console.error('Email failed to:', user.email, 'Error:', err.message);
      }
    }

    // SMS/WhatsApp
    if (['absence', 'fee-alert', 'progress-report', 'welcome'].includes(notification.type)) {
      const message = notification.type === 'welcome'
        ? `Welcome to ${schoolName}! Your school is registered. Username: ${notification.data.username}. Set password: ${notification.data.loginUrl}`
        : notification.message;

      if ((preferredChannel === 'sms' || preferredChannel === 'both') && user.phoneNumber) {
        try {
          const smsResult = await twilioClient.messages.create({
            body: message.substring(0, 160),
            from: process.env.TWILIO_PHONE_NUMBER,
            to: user.phoneNumber
          });
          console.log('SMS sent to:', user.phoneNumber, 'SID:', smsResult.sid);
          deliverySuccess = true;
        } catch (smsErr) {
          console.error('SMS failed to:', user.phoneNumber, 'Error:', smsErr.message);
        }
      }

      if ((preferredChannel === 'whatsapp' || preferredChannel === 'both') && user.whatsappNumber && user.whatsappOptIn) {
        try {
            const whatsappResult = await twilioClient.messages.create({
            body: message,
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`, // Dynamic
            to: `whatsapp:${user.whatsappNumber}`
            });
            console.log('WhatsApp sent to:', user.whatsappNumber, 'SID:', whatsappResult.sid);
            deliverySuccess = true;
        } catch (whatsappErr) {
            console.error('WhatsApp failed to:', user.whatsappNumber, 'Error:', whatsappErr.message);
        }
        }
    }

    if (notification.type === 'progress-report' && user.role === 'parent') {
      const message = `Progress Report from ${schoolName}: ${notification.message} for student ${notification.studentId}. Details: ${JSON.stringify(notification.data)}`;

      // SMS
      if ((preferredChannel === 'sms' || preferredChannel === 'both') && user.phoneNumber) {
        try {
          const smsResult = await twilioClient.messages.create({
            body: message.substring(0, 160), // Limit to 160 characters
            from: process.env.TWILIO_PHONE_NUMBER,
            to: user.phoneNumber
          });
          console.log('SMS sent to:', user.phoneNumber, 'SID:', smsResult.sid);
          deliverySuccess = true;
        } catch (smsErr) {
          console.error('SMS failed:', smsErr.message);
        }
      }

      // WhatsApp (if opted in and sandbox joined)
      if ((preferredChannel === 'whatsapp' || preferredChannel === 'both') && user.whatsappNumber && user.whatsappOptIn) {
        try {
          const whatsappResult = await twilioClient.messages.create({
            body: message,
            from: 'whatsapp:+14155238886',
            to: `whatsapp:${user.whatsappNumber}`
          });
          console.log('WhatsApp sent to:', user.whatsappNumber, 'SID:', whatsappResult.sid);
          deliverySuccess = true;
        } catch (whatsappErr) {
          console.error('WhatsApp failed:', whatsappErr.message);
        }
      }
    }

    // Update notification status
    notification.status = deliverySuccess ? 'delivered' : 'failed';
    notification.error = deliverySuccess ? undefined : 'Some delivery channels failed';
    if (session) {
      await notification.save({ session });
    } else {
      await notification.save();
    }
    console.log('Notification status updated:', notification._id, 'Status:', notification.status);
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