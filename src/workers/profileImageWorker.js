require('dotenv').config();

const profileImageQueue = require('../jobs/profileImage');
const db = require('../db/knex');
const { uploadImage } = require('../services/bunny.service');
const { ssrfSafeDownload } = require('../utils/ssrfSafe');

// Magic bytes for image format verification
const IMAGE_SIGNATURES = [
  { ext: 'png',  bytes: [0x89, 0x50, 0x4E, 0x47] },
  { ext: 'jpg',  bytes: [0xFF, 0xD8] },
  { ext: 'gif',  bytes: [0x47, 0x49, 0x46] },
  { ext: 'webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

function isValidImage(buffer) {
  if (!buffer || buffer.length < 4) return false;
  return IMAGE_SIGNATURES.some(sig =>
    sig.bytes.every((b, i) => buffer[i] === b)
  );
}

// ── Worker ───────────────────────────────────────────────────────────────────
// Concurrency: 3 — parallel image downloads don't block each other.

profileImageQueue.process(3, async (job) => {
  const { userId, imageUrl, importJobId } = job.data;

  console.log(`[image-worker] Processing image for user ${userId}: ${imageUrl}`);

  // ── Validation # 1: User already has a valid profile picture ──────────────
  const user = await db('users').where({ id: userId }).first('metadata');
  let metadata = {};
  if (user && user.metadata) {
    if (typeof user.metadata === 'string') {
      try { metadata = JSON.parse(user.metadata); } catch { metadata = {}; }
    } else {
      metadata = user.metadata;
    }
  }
  metadata = metadata || {};

  if (metadata.profile_picture && metadata.profile_picture.startsWith('https://')) {
    console.log(`[image-worker] User ${userId} already has a profile picture. Skipping.`);
    await db('import_jobs').where({ id: importJobId }).increment('image_done', 1);
    return;
  }

  // ── Validation # 2: Image URL is already hosted on Bunny CDN ──────────────
  const cdnHost = process.env.BUNNY_CDN_HOSTNAME;
  if (cdnHost && imageUrl.includes(cdnHost)) {
    console.log(`[image-worker] Image URL is already hosted on Bunny CDN. Reusing URL directly.`);
    metadata.profile_picture = imageUrl;
    metadata.source_image_url = imageUrl;
    await db('users').where({ id: userId }).update({ metadata: JSON.stringify(metadata) });
    await db('import_jobs').where({ id: importJobId }).increment('image_done', 1);
    return;
  }

  // ── DEDUPLICATION CHECK: Check if exact same image URL was already uploaded ──
  const existingWithSameUrl = await db('users')
    .whereRaw("metadata->>'source_image_url' = ?", [imageUrl])
    .first('metadata');

  if (existingWithSameUrl) {
    let existingMeta = existingWithSameUrl.metadata;
    if (typeof existingMeta === 'string') {
      try { existingMeta = JSON.parse(existingMeta); } catch { existingMeta = {}; }
    }
    if (existingMeta?.profile_picture) {
      console.log(`[image-worker] ♻ Reusing existing Bunny CDN URL for duplicate image: ${imageUrl}`);
      metadata.profile_picture = existingMeta.profile_picture;
      metadata.source_image_url = imageUrl;
      await db('users').where({ id: userId }).update({ metadata: JSON.stringify(metadata) });
      await db('import_jobs').where({ id: importJobId }).increment('image_done', 1);
      return;
    }
  }

  // ── DOWNLOAD with SSRF protection ────────────────────────────────────────
  const { buffer } = await ssrfSafeDownload(imageUrl, {
    maxSizeBytes: 5 * 1024 * 1024,
    timeoutMs: 10000,
    maxRedirects: 2,
  });

  // ── VERIFY image content ─────────────────────────────────────────────────
  if (!isValidImage(buffer)) {
    throw new Error('Downloaded file is not a valid image (PNG/JPG/GIF/WebP).');
  }

  // ── UPLOAD to Bunny.net CDN ──────────────────────────────────────────────
  const cdnUrl = await uploadImage(buffer, 'student_profiles');
  if (!cdnUrl) {
    throw new Error('Bunny.net upload returned empty URL.');
  }

  // ── UPDATE user metadata ─────────────────────────────────────────────────
  metadata.profile_picture = cdnUrl;
  metadata.source_image_url = imageUrl;

  await db('users').where({ id: userId }).update({
    metadata: JSON.stringify(metadata),
  });

  // ── UPDATE import job counter ────────────────────────────────────────────
  await db('import_jobs').where({ id: importJobId }).increment('image_done', 1);

  console.log(`[image-worker] ✔ User ${userId} profile picture updated: ${cdnUrl}`);
});

// ── Event handlers ─────────────────────────────────────────────────────────

profileImageQueue.on('completed', (job) => {
  console.log(`[image-worker] Job ${job.id} completed.`);
});

profileImageQueue.on('failed', async (job, err) => {
  console.error(`[image-worker] Job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message);

  // Only log error on final failure (all retries exhausted)
  if (job.attemptsMade >= (job.opts.attempts || 3)) {
    const { userId, importJobId } = job.data;
    try {
      await db('import_jobs').where({ id: importJobId }).increment('image_failed', 1);
      await db('import_errors').insert({
        import_job_id: importJobId,
        sheet_name: 'Image',
        student_ref: userId,
        error_message: `Profile image upload failed after ${job.attemptsMade} attempts: ${err.message}`,
      });
    } catch (updateErr) {
      console.error(`[image-worker] Could not log image failure:`, updateErr.message);
    }
  }
});

console.log('[image-worker] Listening on queue: profile-image (concurrency: 3)');
