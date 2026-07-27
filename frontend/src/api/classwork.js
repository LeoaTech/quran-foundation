import client from './client';

// ── Classwork Assignment Per Class Session ───────────────────────────────────────────────────────

// ── New Classwork Sheet ────────────────────────────────────────────────────────

/**
 * Get classwork sheet context (topics up to session with subtopics, present students, and saved sheet).
 */
export const getClassworkSheet = (planId) =>
  client.get(`/class-sessions/${planId}/classwork-sheet`).then((r) => r.data);

/**
 * Save / Edit classwork sheet for a class-session.
 * { topic_id, subtopic_id, description, entries: [{ student_id, grade, comments }] }
 */
export const saveClassworkSheet = (planId, body) =>
  client.post(`/class-sessions/${planId}/classwork-sheet`, body).then((r) => r.data);

