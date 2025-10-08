const twilio = require('twilio');
const logger = require('winston');
require('dotenv').config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

exports.sendSMS = async (phoneNumber, notification, schoolName) => {
  try {
    let message = notification.message;
    if (notification.type === 'fee-alert') {
      message = `Dear Parent, a fee of ₹${notification.data.amount || 'N/A'} for ${notification.data.month || 'N/A'} is due by ${new Date(notification.data.dueDate).toLocaleDateString() || 'N/A'}. Pay now: ${notification.data.paymentLink || 'N/A'}. Regards, ${schoolName}.`;
    } else if (notification.type === 'absence') {
      message = `Dear Parent, your child was absent today. Please provide reason. ${notification.message} Regards, ${schoolName}.`;
    } else if (notification.type === 'welcome') {
      message = `Welcome to ${schoolName}! Your school is registered. Username: ${notification.data.username}, Password: ${notification.data.password}. Login: ${notification.data.loginUrl}`;
    }
    const truncatedMessage = message.length > 160 ? message.substring(0, 157) + '...' : message;

    await client.messages.create({
      body: truncatedMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    logger.info(`SMS sent to ${phoneNumber}`);
  } catch (error) {
    logger.error(`Failed to send SMS to ${phoneNumber}: ${error.message}`);
  }
};

exports.sendWhatsApp = async (whatsappNumber, notification, schoolName) => {
  try {
    let message = notification.message;
    if (notification.type === 'fee-alert') {
      message = `Dear Parent, a fee of ₹${notification.data.amount || 'N/A'} for ${notification.data.month || 'N/A'} is due by ${new Date(notification.data.dueDate).toLocaleDateString() || 'N/A'}. Pay now: ${notification.data.paymentLink || 'N/A'}. Regards, ${schoolName}.`;
    } else if (notification.type === 'absence') {
      message = `Dear Parent, your child was absent today. Please provide reason. ${notification.message} Regards, ${schoolName}.`;
    } else if (notification.type === 'progress-report') {
      message = `${notification.message}\nView details: ${notification.data.reportUrl || 'N/A'}\nRegards, ${schoolName}.`;
    } else if (notification.type === 'welcome') {
      message = `Welcome to ${schoolName}! Your school is registered. Username: ${notification.data.username}, Password: ${notification.data.password}. Login: ${notification.data.loginUrl}`;
    }

    await client.messages.create({
      body: message,
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:${whatsappNumber}`
    });
    logger.info(`WhatsApp sent to ${whatsappNumber}`);
  } catch (error) {
    logger.error(`Failed to send WhatsApp to ${whatsappNumber}: ${error.message}`);
  }
};