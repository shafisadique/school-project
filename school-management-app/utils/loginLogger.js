// utils/loginLogger.js  ← ONLY THIS FILE DOES LOGGING

const LoginLog = require('../models/LoginLog');
const requestIp = require('request-ip');
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');

// THIS IS THE ONLY FUNCTION YOU WILL CALL
const logLoginAttempt = async (req, user = null, status, reason = null) => {
  try {
    const clientIp = requestIp.getClientIp(req) || 'Unknown';
    const userAgent = req.headers['user-agent'] || '';
    const parser = new UAParser(userAgent);
    const ua = parser.getResult();
    const geo = geoip.lookup(clientIp) || {};

    const email = req.body.email || req.body.username || 'unknown';
    const role = user?.role || 'unknown';

    await LoginLog.create({
      userId: user?._id || null,
      email,
      role,
      schoolId: user?.schoolId || null,

      ip: clientIp,
      city: geo.city || 'Unknown',
      country: geo.country || 'Unknown',
      device: ua.device.model || ua.device.type || 'Desktop',
      browser: `${ua.browser.name || 'Unknown'} ${ua.browser.major || ''}`.trim(),
      os: `${ua.os.name || 'Unknown'} ${ua.os.version || ''}`.trim(),

      status,        // 'success' or 'failed'
      reason,        // optional message
    });

    console.log(`Login ${status}: ${email} from ${clientIp} (${geo.city || 'Unknown'})`);
  } catch (err) {
    console.error('Failed to save login log:', err.message);
  }
};

module.exports = { logLoginAttempt };

