// utils/smsProvider.js
const https = require('https');  // Native Node.js (no axios needed)

const sendSMS = async (phone, message, senderName = null) => {
  return new Promise((resolve, reject) => {
    try {
      // Parse template vars: "dkf;lqqqq|3400|Children's Public School"
      const [name, amount, school] = message.split('|');
      if (!name || !amount || !school) {
        return reject(new Error('Message must be in format: Name|Amount|SchoolName'));
      }

      // Format phone
      let mobile = phone.toString().trim();
      if (mobile.length === 10) mobile = '91' + mobile;
      if (!mobile.startsWith('91') || mobile.length !== 12) {
        return reject(new Error('Invalid Indian mobile number'));
      }

      // Get template ID from env
      const templateId = process.env.MSG91_DEF_TEMPLATE_ID;
      if (!templateId) {
        return reject(new Error('MSG91_DEF_TEMPLATE_ID missing in .env'));
      }

      // Sender (fallback to env)
      const sender = senderName?.trim().substring(0, 6).toUpperCase() || process.env.MSG91_SENDER_ID || 'EDGLOBE';

      // Payload as per official sample (JSON string)
      const payload = JSON.stringify({
        template_id: templateId,
        short_url: 0,  // Off (no short URLs needed)
        short_url_expiry: 0,  // Not used
        realTimeResponse: 1,  // Enable for instant feedback
        recipients: [
          {
            mobiles: mobile,
            VAR1: name.trim(),
            VAR2: amount.trim(),
            VAR3: school.trim()
          }
        ]
      });

      const options = {
        method: 'POST',
        hostname: 'control.msg91.com',
        port: 443,  // HTTPS
        path: '/api/v5/flow',
        headers: {
          accept: 'application/json',
          authkey: process.env.MSG91_AUTH_KEY,  // Your authkey
          'content-type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString();
          console.log('MSG91 Full Response:', body);  // Debug: See exact output

          try {
            const response = JSON.parse(body);
            if (response.type === 'success' || response.message_id) {  // Success indicators
              console.log(`SMS Sent Successfully to ${mobile} | Sender: ${sender} | Message ID: ${response.message_id || 'N/A'}`);
              resolve(true);
            } else {
              reject(new Error(`MSG91 Failed: ${response.message || 'Unknown error'}`));
            }
          } catch (parseErr) {
            reject(new Error(`Invalid response: ${body}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('HTTPS Request Error:', error.message);
        reject(error);
      });

      req.write(payload);
      req.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { sendSMS };