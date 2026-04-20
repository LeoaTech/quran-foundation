require('dotenv').config();

const notifyGuardianQueue = require('../jobs/notifyGuardian');

// ── Worker ────────────────────────────────────────────────────────────────────
// Processes 'notify-guardian' jobs one at a time (concurrency 1).
// TODO: Replace console.log stubs with WhatsApp Business API calls.

notifyGuardianQueue.process(1, async (job) => {
  const {
    student_name,
    student_name_ur,
    session_date,
    cw_grade,
    homework_total,
    homework_max,
    homework_pct,
    guardians,
    session_id,
  } = job.data;

  const display = student_name_ur || student_name;

  for (const guardian of guardians) {
    const dest = guardian.whatsapp || guardian.phone;
    if (!dest) {
      console.warn(`[whatsapp-worker] guardian "${guardian.full_name}" has no phone/whatsapp — skipping`);
      continue;
    }

    // TODO: replace with actual WhatsApp API call
    // Bilingual message (primary: Urdu for Pakistani context)
    console.log(
      `[whatsapp-worker] → ${dest} (${guardian.relation}, preferred_lang=${guardian.preferred_lang})\n` +
      `  session=${session_id} date=${session_date}\n` +
      `  student: ${display}\n` +
      `  classwork grade: ${cw_grade ?? '—'}\n` +
      `  homework: ${homework_total}/${homework_max} (${homework_pct}%)`,
    );
  }
});

notifyGuardianQueue.on('completed', (job) => {
  console.log(`[whatsapp-worker] job ${job.id} completed`);
});

notifyGuardianQueue.on('failed', (job, err) => {
  console.error(`[whatsapp-worker] job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message);
});

console.log('[whatsapp-worker] listening on queue: notify-guardian');
