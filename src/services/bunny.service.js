const { v4: uuidv4 } = require('uuid');

/**
 * Bunny.net Storage upload service.
 *
 * Uploads files to a Bunny.net Storage Zone via HTTP PUT and returns
 * the public CDN URL served through the connected Pull Zone.
 *
 * Add Required environment variables in .env file:
 *   BUNNY_STORAGE_ZONE     – Storage Zone name
 *   BUNNY_STORAGE_PASSWORD – Storage Zone password (AccessKey)
 *   BUNNY_STORAGE_REGION   – Storage API hostname (e.g. storage.bunnycdn.com)
 *   BUNNY_CDN_HOSTNAME     – Pull Zone CDN hostname (e.g. your-zone.b-cdn.net)
 */

const STORAGE_ZONE   = () => process.env.BUNNY_STORAGE_ZONE;
const STORAGE_PASS   = () => process.env.BUNNY_STORAGE_PASSWORD;
const STORAGE_REGION = () => process.env.BUNNY_STORAGE_REGION || 'storage.bunnycdn.com';
const CDN_HOST       = () => process.env.BUNNY_CDN_HOSTNAME;

/**
 * Check whether Bunny.net is fully configured.
 */
function isBunnyConfigured() {
  return !!(STORAGE_ZONE() && STORAGE_PASS() && CDN_HOST());
}

/**
 * Detect image extension from buffer magic bytes.
 * Falls back to '.jpg' if detection fails.
 */
function detectImageExt(buffer) {
  if (!buffer || buffer.length < 4) return '.jpg';
  const head = buffer.slice(0, 4);

  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47) return '.png';
  if (head[0] === 0xFF && head[1] === 0xD8) return '.jpg';
  if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return '.gif';
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) return '.webp';

  return '.jpg';
}

/**
 * Detect audio extension from originalName or mimeType.
 * Falls back to '.webm'.
 */
function detectAudioExt(originalName, mimeType) {
  const path = require('path');
  const ext = path.extname(originalName || '');
  if (ext) return ext;

  if (!mimeType) return '.webm';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return '.mp3';
  if (mimeType.includes('wav')) return '.wav';
  if (mimeType.includes('ogg')) return '.ogg';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return '.m4a';
  if (mimeType.includes('webm')) return '.webm';
  return '.webm';
}

/**
 * Core upload function — sends a buffer to Bunny.net Storage via HTTP PUT.
*/
async function uploadToStorage(fileBuffer, remotePath, contentType = 'application/octet-stream') {
  const url = `https://${STORAGE_REGION()}/${STORAGE_ZONE()}/${remotePath}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'AccessKey': STORAGE_PASS(),
      'Content-Type': contentType,
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Bunny.net upload failed (${response.status}): ${body}`);
  }

  return `https://${CDN_HOST()}/${remotePath}`;
}

/**
 * Uploads an image buffer to Bunny.net Storage.
 *
*/
async function uploadImage(fileBuffer, folder = 'profiles') {
  if (!isBunnyConfigured()) {
    console.warn('Bunny.net is not configured. Skipping image upload and returning empty string.');
    return '';
  }

  const ext = detectImageExt(fileBuffer);
  const fileName = `${uuidv4()}${ext}`;
  const remotePath = `${folder}/${fileName}`;

  return uploadToStorage(fileBuffer, remotePath, `image/${ext.replace('.', '')}`);
}

/**
 * Uploads an audio buffer to Bunny.net Storage.
 **/
async function uploadAudio(fileBuffer, originalName = 'audio.webm', mimeType = 'audio/webm') {
  if (!isBunnyConfigured()) {
    throw new Error('Bunny.net is not configured.');
  }

  const ext = detectAudioExt(originalName, mimeType);
  const fileName = `${uuidv4()}${ext}`;
  const remotePath = `homework_audio/${fileName}`;

  return uploadToStorage(fileBuffer, remotePath, mimeType || 'audio/webm');
}

module.exports = {
  uploadImage,
  uploadAudio,
  isBunnyConfigured,
};
