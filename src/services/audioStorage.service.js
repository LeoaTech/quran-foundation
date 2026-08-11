const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { cloudinary } = require('./cloudinary.service');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'audio');

/**
 * Ensures local upload directory exists
 */
function ensureUploadDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Uploads an audio buffer to Cloudinary or falls back to local disk storage
 */
async function uploadAudio(fileBuffer, originalName = 'audio.webm', mimeType = 'audio/webm') {
  // 1. Try Cloudinary if configured
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
    try {
      const url = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'homework_audio',
            resource_type: 'auto',
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result.secure_url);
          }
        );
        uploadStream.end(fileBuffer);
      });
      if (url) return url;
    } catch (err) {
      console.warn('Cloudinary audio upload failed, falling back to local storage:', err.message);
    }
  }

  // 2. Fallback to Local Disk Storage
  ensureUploadDir();
  const ext = path.extname(originalName) || getExtFromMime(mimeType) || '.webm';
  const fileName = `${uuidv4()}${ext}`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  await fs.promises.writeFile(filePath, fileBuffer);
  return `/uploads/audio/${fileName}`;
}

function getExtFromMime(mimeType) {
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return '.mp3';
  if (mimeType.includes('wav')) return '.wav';
  if (mimeType.includes('ogg')) return '.ogg';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return '.m4a';
  if (mimeType.includes('webm')) return '.webm';
  return '.webm';
}

module.exports = {
  uploadAudio,
};
