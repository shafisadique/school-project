const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({  // <-- Fixed: createTransport
  service: 'gmail',
  auth: {
    user: process.env.NODEMAILER_EMAIL,
    pass: process.env.NODEMAILER_PASS
  }
});

exports.sendEmail = (to, subject, text) => {
  return transporter.sendMail({ 
    from: process.env.NODEMAILER_EMAIL, 
    to, 
    subject, 
    text 
  });
};