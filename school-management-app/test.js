require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = new twilio(accountSid, authToken);

const sendSMS = async (toNumber, message) => {
  try {
    const response = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: `+91${toNumber}` // Indian number
    });
    console.log(`SMS sent successfully. SID: ${response.sid}`);
  } catch (error) {
    console.error(`Failed to send SMS: ${error.message}`);
  }
};

// Test with your number
const testNumber = '8271340110'; // Your Indian number
const testMessage = 'Hello world this message';
sendSMS(testNumber, testMessage);