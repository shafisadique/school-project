const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs/promises');
const path = require('path');

// Configuration (replace with your actual values or load from .env)
const accountId = 'd2f862fe76c0a1277cd156c6db37a7f5';
const accessKeyId = '290358e45f19422f399d49e02f3dcf23'; // Use the correct token
const secretAccessKey = '1b33777899434b6f960647b79317e670112756ab78bc114843bf23de87edd480'; // Use the correct token
const bucketName = 'school-bucket';

// S3 Client configuration for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

// Function to upload image
async function uploadImage(filePath) {
  try {
    // Read the file
    const fileBuffer = await fs.readFile(filePath);
    const fileName = `${Date.now()}-${path.basename(filePath).replace(/[^a-zA-Z0-9.-]/g, '_')}`; // Unique and sanitized file name

    console.log(`Uploading file: ${fileName}`);

    // Upload parameters
    const params = {
      Bucket: bucketName,
      Key: fileName,
      Body: fileBuffer,
      ContentType: 'image/jpeg', // Adjust based on your file type (e.g., 'image/png')
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    const imageUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${fileName}`;
    console.log(`Image uploaded successfully! URL: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error('Upload error:', error.message, error.stack);
    throw error;
  }
}

// Example usage
const imagePath = path.join(__dirname, 'incoce.jpg'); // Replace with your image path

// Verify file existence before upload
fs.access(imagePath)
  .then(() => uploadImage(imagePath))
  .catch((err) => console.error('File not found or inaccessible:', err.message));