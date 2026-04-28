const { getRedis } = require('./redis');

// ── TTLs (seconds) ────────────────────────────────────────────────────────────

const TTL = {
  ORG_OVERVIEW:     300, // 5 min
  CENTER_OVERVIEW:  180, // 3 min
  STUDENT_SUMMARY:  120, // 2 min
};

// ── Keys ──────────────────────────────────────────────────────────────────────

const keys = {
  orgOverview:      ()           => 'report:org:overview',
  centerOverview:   (id, month)  => `report:center:${id}:${month || 'all'}`,
  studentSummary:   (id)         => `report:student:${id}`,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCached(key) {
  try {
    const redis = await getRedis();
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('[reportCache] get error:', err.message);
    return null;
  }
}

async function setCached(key, data, ttlSeconds) {
  try {
    const redis = await getRedis();
    await redis.set(key, JSON.stringify(data), { EX: ttlSeconds });
  } catch (err) {
    console.error('[reportCache] set error:', err.message);
  }
}

// ── Invalidation ──────────────────────────────────────────────────────────────

// Deletes org overview + all monthly variants for a given center.
async function invalidateCenterReports(centerId) {
  try {
    const redis = await getRedis();

    // Org overview is affected by any center change.
    await redis.del(keys.orgOverview());

    // Scan for all center:{id}:* keys and delete them.
    let cursor = 0;
    const toDelete = [];
    do {
      const result = await redis.scan(cursor, {
        MATCH: `report:center:${centerId}:*`,
        COUNT:  100,
      });
      cursor = result.cursor;
      toDelete.push(...result.keys);
    } while (cursor !== 0);

    if (toDelete.length > 0) {
      await redis.del(toDelete);
    }
  } catch (err) {
    console.error('[reportCache] invalidateCenterReports error:', err.message);
  }
}

// Deletes the cached summary for a specific student.
async function invalidateStudentReport(studentUserId) {
  try {
    const redis = await getRedis();
    await redis.del(keys.studentSummary(studentUserId));
  } catch (err) {
    console.error('[reportCache] invalidateStudentReport error:', err.message);
  }
}

module.exports = {
  TTL,
  keys,
  getCached,
  setCached,
  invalidateCenterReports,
  invalidateStudentReport,
};
