// utils/fileUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

exports.createUploadMiddleware = (folder, maxSize, allowedTypes) => {
  const uploadDir = path.join(__dirname, `../uploads/${folder}`);
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}${ext}`);
    }
  });

  return multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: (req, file, cb) => {
      allowedTypes.includes(file.mimetype) 
        ? cb(null, true)
        : cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
    }
  });
};