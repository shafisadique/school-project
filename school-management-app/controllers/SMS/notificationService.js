const axios = require('axios');

const sendSMS = async (phoneNumber, messageData) => {
  try {
    // Construct the SMS message
    const message = `Dear ${messageData.studentName}, a fee of ₹${messageData.amount} for ${messageData.month} is due by ${new Date(messageData.dueDate).toLocaleDateString()}. Pay now: ${messageData.paymentLink}. Regards, ${messageData.schoolName}`;
    const truncatedMessage = message.length > 160 ? message.substring(0, 157) + '...' : message; // Truncate to 160 chars

    // SMSCountry API endpoint and parameters (replace with your credentials)
    const apiUrl = 'https://api.smscountry.com/SMSCwebservice_bulk.aspx';
    const params = new URLSearchParams({
      User: process.env.SMSCOUNTRY_USERNAME, // Your SMSCountry username
      Password: process.env.SMSCOUNTRY_PASSWORD, // Your SMSCountry password
      Message: truncatedMessage,
      MobileNumbers: phoneNumber, // e.g., +919876543210
      SenderID: process.env.SMSCOUNTRY_SENDER_ID, // Your registered Sender ID
      Format: 'json'
    });

    const response = await axios.post(apiUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (response.data.ErrorCode === '000') {
      console.log(`SMS sent successfully to ${phoneNumber}:`, response.data);
      return response.data;
    } else {
      console.error(`SMS failed for ${phoneNumber}:`, response.data.ErrorMessage);
      throw new Error(response.data.ErrorMessage);
    }
  } catch (error) {
    console.error(`Failed to send SMS: ${error.message}`);
    throw error;
  }
};

module.exports = { sendSMS };