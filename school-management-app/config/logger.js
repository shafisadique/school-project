const winston = require('winston');

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.printf(info => `${info.timestamp} [${info.level}]: ${info.message}`)
    )
  })
];

// ONLY LOG TO FILE IN LOCAL DEV
if (process.env.NODE_ENV !== 'production') {
  const fs = require('fs');
  const logDir = 'logs';
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }

  transports.push(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  );
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports
});

module.exports = logger;