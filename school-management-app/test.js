// const express = require('express');
// const app = express();
// require('dotenv').config(); // Load environment variables

// app.post('/api/assignments/create', (req, res) => res.json({ test: 'OK' }));
// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   }
// });
// app.get('/test-email', async (req, res) => {
//   try {
//     console.log('Transporter config:', transporter.options);
//     await transporter.sendMail({
//       from: process.env.EMAIL_USER,
//       to: 'munnaartdesigner123@gmail.com',
//       subject: 'Test Email',
//       text: 'This is a test email.'
//     });
//     console.log('Email sent successfully');
//     res.status(200).json({ message: 'Test email sent' });
//   } catch (err) {
//     console.error('Test email error:', err.message, err.stack);
//     res.status(500).json({ message: 'Test email failed', error: err.message });
//   }
// });

// const PORT = 3000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// router.get('/test-razorpay', async (req, res) => {
//   try {
//     const order = await rzp.orders.create({
//       amount: 100, // 1 INR in paise
//       currency: 'INR',
//       receipt: 'test_receipt',
//       notes: { test: 'true' }
//     });
//     res.status(200).json({ order });
//   } catch (err) {
//     console.error('Razorpay test error:', err);
//     res.status(500).json({ message: 'Razorpay test failed', error: err.message });
//   }
// });



const mongoose = require('mongoose');
const School = require('./models/school'); // Adjust path to your School model

// Connect to your DB (update URI)
mongoose.connect('mongodb://localhost:27017/mongodb+srv://School:Patanahi%40123@cluster0.bawv9.mongodb.net/SchoolDB?retryWrites=true&w=majority')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Connection error:', err));

// Hardcoded updates for your two schools
const updates = [
  {
    _id: '68ff85ad3ea707c4fe02ee07',  // New Indus
    code: 'NIPS'  // Customize
  },
  {
    _id: '68ba8180e6bfbddacdf786d5',  // Rainbow
    code: 'RPS'   // Customize
  }
];

async function migrate() {
  for (const update of updates) {
    try {
      const result = await School.updateOne(
        { _id: update._id },
        { $set: { code: update.code.toUpperCase() } }
      );
      if (result.matchedCount > 0) {
        console.log(`Updated school ${update._id} with code: ${update.code}`);
      } else {
        console.log(`School ${update._id} not found`);
      }
    } catch (err) {
      console.error(`Error updating ${update._id}:`, err.message);
      if (err.code === 11000) {
        console.log(`Code ${update.code} already exists—choose another.`);
      }
    }
  }

  // Verify
  const schools = await School.find({ _id: { $in: updates.map(u => u._id) } }, { name: 1, code: 1 });
  console.log('Updated schools:', JSON.stringify(schools, null, 2));

  mongoose.disconnect();
  console.log('Migration complete!');
}

migrate();