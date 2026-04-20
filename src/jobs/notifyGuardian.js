const Bull = require('bull');

// Job data shape (for reference by the worker):
// {
//   session_id:        uuid
//   student_user_id:   uuid
//   student_name:      string
//   student_name_ur:   string | null
//   class_id:          uuid
//   session_date:      'YYYY-MM-DD'
//   cw_grade:          'excellent' | 'good' | 'average' | 'revision' | null
//   homework_entry_id: uuid
//   homework_total:    number
//   homework_max:      number
//   homework_pct:      number   // 0–100
//   guardians: Array<{
//     full_name: string, full_name_ur: string | null,
//     phone: string | null, whatsapp: string | null,
//     preferred_lang: string, relation: string, is_primary: boolean
//   }>
// }

const notifyGuardianQueue = new Bull('notify-guardian', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

module.exports = notifyGuardianQueue;
