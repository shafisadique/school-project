const jwt = require('jsonwebtoken');
// const User = require('../models/superuser');  // Confirm path: If models/superuser.js, this is ok
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

exports.login = async (req, res) => {
  const { email, username, password } = req.body;  // Add username support

  try {
    console.log(username, email, password);
    // Validate input
    if (!password ||  (!email && !username)) {
      return res.status(400).json({ error: 'Email/Username and password required' });
    }
    const superUser = await prisma.superUser.findFirst({
      where: {
        OR: [
          username ? { username } : null,
          email ? { email } : null
        ].filter(Boolean)
      }
    });
    console.log('Found superUser:', superUser);  // Temp debug

    // Query by email OR username
    // const query = email ? { email } : { username };

    // const user = await User.findOne(query);

    if (!superUser) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // const match = await superUser.comparePassword(password);
    // console.log('Password match:', match);  // Temp

    const match = await bcrypt.compare(password, superUser.password);

    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Fix: Use JWT_SECRET_SUPER from .env
const token = jwt.sign(
      { 
        id: superUser.id,           // ← Prisma uses `id` (string UUID), not _id
        role: superUser.role 
      },
      process.env.JWT_SECRET_SUPER,
      { expiresIn: '7d' }
    );
    res.json({ 
      token, 
      user: { 
        id: superUser.id, 
        email: superUser.email, 
        username: superUser.username, 
        role: superUser.role 
      } 
    });
  } catch (error) {
    console.error('Login error details:', error.message, error.stack);  // Better error log
    res.status(500).json({ error: 'Login failed' });
  }
};