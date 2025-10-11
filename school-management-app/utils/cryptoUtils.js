// utils/cryptoUtils.js
const crypto = require('crypto');

// Encryption configuration
let ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16; // AES-256-CBC IV length

// Validate ENCRYPTION_KEY
if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `Invalid ENCRYPTION_KEY length: "${ENCRYPTION_KEY}". Using fallback key for development.`
    );
    ENCRYPTION_KEY = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f123';
  } else {
    throw new Error(
      `ENCRYPTION_KEY must be a 64-character hex string in .env. Current value: "${ENCRYPTION_KEY}"`
    );
  }
}

try {
  if (Buffer.from(ENCRYPTION_KEY, 'hex').length !== 32) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `Invalid ENCRYPTION_KEY buffer length: "${ENCRYPTION_KEY}". Using fallback key for development.`
      );
      ENCRYPTION_KEY = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f123';
    } else {
      throw new Error(
        `ENCRYPTION_KEY must produce a 32-byte buffer (64-character hex string) in .env. Current value: "${ENCRYPTION_KEY}"`
      );
    }
  }
} catch (err) {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `ENCRYPTION_KEY parsing failed: ${err.message}. Using fallback key for development.`
    );
    ENCRYPTION_KEY = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f123';
  } else {
    throw new Error(
      `ENCRYPTION_KEY parsing failed: ${err.message}. Ensure it is a 64-character hex string in .env. Current value: "${ENCRYPTION_KEY}"`
    );
  }
}

// Function to encrypt password
const encryptPassword = (text) => {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt password');
  }
};

// Function to decrypt password
const decryptPassword = (encryptedText) => {
  try {
    if (!encryptedText || typeof encryptedText !== 'string') {
      throw new Error('Invalid encrypted text');
    }
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted || ivHex.length !== 32) {
      throw new Error('Invalid encrypted text format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return null; // Return null for invalid decryption
  }
};

module.exports = { encryptPassword, decryptPassword };