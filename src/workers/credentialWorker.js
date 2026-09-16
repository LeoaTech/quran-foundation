require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const twilio = require('twilio');
const credentialQueue = require('../jobs/credential');
const db = require('../db/knex');

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateSecureTempPassword() {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  let password = '';
  const randomBytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  return password;
}

// ── Worker Processor ────────────────────────────────────────────────────────

credentialQueue.process(1, async (job) => {
  const { userId } = job.data;

  if (!userId) {
    throw new Error('[credential-worker] Job data missing userId.');
  }

  console.log(`[credential-worker] Processing credential job for user ${userId}`);

  // 1. Atomic Compare-And-Swap (Double-send prevention)
  // Only the job that flips status from 'pending_invite' -> 'processing' proceeds.
  const updatedCount = await db('users')
    .where({ id: userId, status: 'pending_invite' })
    .update({ status: 'processing', updated_at: db.fn.now() });

  if (updatedCount === 0) {
    const existingUser = await db('users').where({ id: userId }).first();
    console.log(
      `[credential-worker] CAS check skipped user ${userId}. Current status: '${existingUser?.status || 'not_found'}'`
    );
    return;
  }

  // 2. Fetch User & Linked Minor Students (if guardian)
  const user = await db('users').where({ id: userId }).first();
  if (!user) {
    throw new Error(`User ${userId} not found in database.`);
  }

  const targetPhone = user.whatsapp || user.phone;
  if (!targetPhone) {
    throw new Error(`User ${user.full_name} (${userId}) has no phone/WhatsApp number.`);
  }

  const linkedStudents = await db('guardians as g')
    .join('users as u', 'g.student_user_id', 'u.id')
    .where({ 'g.guardian_user_id': userId })
    .select('u.id', 'u.full_name', 'u.full_name_ur', 'u.status');

  // 3. Generate Cryptographically Secure Password & Hash
  const tempPassword = generateSecureTempPassword();
  const passHash = await bcrypt.hash(tempPassword, 10);

  await db('users')
    .where({ id: userId })
    .update({
      password_hash: passHash,
      must_reset_password: true,
      updated_at: db.fn.now(),
    });

  // 4. Dispatch WhatsApp Message
  let studentDisplay = user.full_name;
  if (linkedStudents.length > 0) {
    studentDisplay = linkedStudents.map((s) => s.full_name_ur || s.full_name).join(', ');
  }

  const messageText =
    `*Quran Foundation LMS Credentials*\n\n` +
    `User: ${user.full_name}\n` +
    `Linked Student(s): ${studentDisplay}\n` +
    `Phone Number: ${targetPhone}\n ` +
    `Temp Password: ${tempPassword}\n\n` +
    `Instructions: Please log in to Quran Foundation LMS and change your password on first login.`;

  console.log(`[credential-worker] Preparing to send message via Twilio to ${targetPhone}`);

  try {
    const rawFrom = (process.env.TWILIO_WHATSAPP_FROM || '').replace(/^whatsapp:/i, '').trim();
    const formattedFrom = rawFrom.startsWith('+') ? rawFrom : '+' + rawFrom;
    const formattedPhone = targetPhone.startsWith('+') ? targetPhone : '+' + targetPhone;

    console.log(`[credential-worker] Dispatching message from whatsapp:${formattedFrom} to whatsapp:${formattedPhone}`);

    const twilioMessage = await twilioClient.messages.create({
      body: messageText,
      from: `whatsapp:${formattedFrom}`,
      to: `whatsapp:${formattedPhone}`
    });
    console.log(`[credential-worker] WhatsApp message sent! SID: ${twilioMessage.sid}`);
  } catch (error) {
    console.error(`[credential-worker] Failed to send WhatsApp message to ${targetPhone}:`, error);
    throw new Error(`Failed to send WhatsApp message via Twilio: ${error.message}`);
  }

  // 5. Update Status to 'invited' on Success
  await db('users')
    .where({ id: userId })
    .update({
      status: 'invited',
      credentials_sent_at: db.fn.now(),
      invite_error: null,
      updated_at: db.fn.now(),
    });

  if (linkedStudents.length > 0) {
    const minorStudentIds = linkedStudents.map((s) => s.id);
    await db('users')
      .whereIn('id', minorStudentIds)
      .whereIn('status', ['pending_invite', 'processing'])
      .update({
        status: 'invited',
        credentials_sent_at: db.fn.now(),
        invite_error: null,
        updated_at: db.fn.now(),
      });
  }

  console.log(`[credential-worker] Successfully dispatched credentials for user ${userId} (${user.full_name})`);
});

// ── Event Handlers ──────────────────────────────────────────────────────────

credentialQueue.on('completed', (job) => {
  console.log(`[credential-worker] Job ${job.id} completed successfully.`);
});

credentialQueue.on('failed', async (job, err) => {
  const maxAttempts = job.opts?.attempts || 3;
  console.error(`[credential-worker] Job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}):`, err.message);

  if (job.attemptsMade >= maxAttempts) {
    const { userId } = job.data || {};
    if (userId) {
      console.error(`[credential-worker] Max attempts reached for user ${userId}. Marking status as 'invite_failed'.`);
      await db('users')
        .where({ id: userId })
        .update({
          status: 'invite_failed',
          invite_error: err.message,
          updated_at: db.fn.now(),
        });

      const linkedStudents = await db('guardians')
        .where({ guardian_user_id: userId })
        .select('student_user_id');

      if (linkedStudents.length > 0) {
        const minorStudentIds = linkedStudents.map((s) => s.student_user_id);
        await db('users')
          .whereIn('id', minorStudentIds)
          .whereIn('status', ['pending_invite', 'processing'])
          .update({
            status: 'invite_failed',
            invite_error: err.message,
            updated_at: db.fn.now(),
          });
      }
    }
  }
});

console.log('[credential-worker] Listening on queue: credential-dispatch');
