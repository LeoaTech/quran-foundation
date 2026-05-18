import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardHeader, CardBody } from '../../../components/Card';
import Button from '../../../components/Button';
import Can from '../../../components/Can';
import RTLInput from '../../../components/RTLInput';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { useToast } from '../../../hooks/useToast';
import { useCreateSession, useHomeworkCriteria, useClassEnrollments } from '../../../hooks/useProgress';
import { getClasses } from '../../../api/classes';
import { getTopics } from '../../../api/courses';
import { getStudentProgress } from '../../../api/progress';

const GRADES = [
  { value: 'excellent', label: 'Excellent',      bg: 'var(--emerald)',    color: 'white'  },
  { value: 'good',      label: 'Good',           bg: 'var(--blue)',       color: 'white'  },
  { value: 'average',   label: 'Average',        bg: 'var(--amber)',      color: 'white'  },
  { value: 'revision',  label: 'Needs Revision', bg: 'var(--red)',        color: 'white'  },
];

function today() { return new Date().toISOString().slice(0, 10); }

function pctColor(pct) {
  if (pct === null) return 'var(--ink-pale)';
  if (pct >= 80) return 'var(--emerald)';
  if (pct >= 60) return 'var(--amber)';
  return 'var(--red)';
}

// ── Simple confetti burst ─────────────────────────────────────────────────────
function ConfettiBurst({ active }) {
  if (!active) return null;
  const COLORS = ['var(--emerald)', 'var(--gold)', 'var(--blue)', 'var(--red)', 'var(--amber)'];
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999 }}>
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${10 + (i % 8) * 11}%`,
            top: `${20 + Math.floor(i / 8) * 15}%`,
            width: 8,
            height: 8,
            borderRadius: Math.random() > 0.5 ? '50%' : 2,
            background: COLORS[i % COLORS.length],
            animation: `confettiFall ${0.8 + (i % 4) * 0.2}s ease-out forwards`,
            animationDelay: `${(i % 6) * 0.05}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(120px) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Score row for a single criterion ─────────────────────────────────────────
function ScoreRow({ criterion, score, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const max  = criterion.max_marks;
  const val  = score?.marks ?? '';
  const note = score?.note_ur ?? '';

  const pct  = val !== '' && max > 0 ? Math.round((Number(val) / max) * 100) : null;

  function handleBlur(e) {
    const n = Number(e.target.value);
    if (e.target.value !== '' && (n < 0 || n > max)) {
      onChange(criterion.id, { ...score, marks: max });
    }
  }

  return (
    <div style={{ borderBottom: '1px solid var(--sand)', paddingBottom: 10, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', fontSize: 14, color: 'var(--ink)' }}>
            {criterion.label_ur || criterion.label}
          </div>
          {criterion.topic_title_ur && (
            <div style={{ fontSize: 10, color: 'var(--ink-pale)', direction: 'rtl', textAlign: 'right' }}>
              {criterion.topic_title_ur}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {pct !== null && (
            <span style={{ fontSize: 11, fontWeight: 600, color: pctColor(pct), minWidth: 34, textAlign: 'right' }}>
              {pct}%
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              className="f-input"
              type="number"
              min={0}
              max={max}
              value={val}
              onChange={(e) => onChange(criterion.id, { ...score, marks: e.target.value })}
              onBlur={handleBlur}
              style={{ width: 56, textAlign: 'center', padding: '6px 8px' }}
              placeholder="0"
            />
            <span style={{ fontSize: 11, color: 'var(--ink-pale)', whiteSpace: 'nowrap' }}>/ {max}</span>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-pale)', fontSize: 12, padding: '2px 4px' }}
            title="Add note"
          >
            {expanded ? '▲' : '✎'}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 6 }}>
          <RTLInput
            placeholder="نوٹ…"
            value={note}
            onChange={(e) => onChange(criterion.id, { ...score, note_ur: e.target.value })}
            style={{ fontSize: 12 }}
          />
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const EMPTY_CLASSWORK = { topic_id: '', subtopic_id: '', grade: '', note_ur: '', note_ar: '' };

export default function ProgressLogger({ prefillEnrollmentId } = {}) {
  const { user }    = useAuth();
  const toast       = useToast();
  const centerId    = user?.center_id;

  const [classId,      setClassId]      = useState('');
  const [enrollmentId, setEnrollmentId] = useState(prefillEnrollmentId ?? '');
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudents,  setShowStudents]  = useState(false);
  const [classwork,    setClasswork]    = useState(EMPTY_CLASSWORK);
  const [scores,       setScores]       = useState({}); // { criteriaId: { marks, note_ur } }
  const [hwDueDate,    setHwDueDate]    = useState('');
  const [hwNote,       setHwNote]       = useState('');
  const [showArabic,   setShowArabic]   = useState(false);
  const [confetti,     setConfetti]     = useState(false);
  const studentRef = useRef(null);

  const createSession = useCreateSession();

  const { data: classesRaw = [] } = useQuery({
    queryKey: ['classes', centerId],
    queryFn:  () => getClasses(centerId, { is_active: true }),
    staleTime: 5 * 60_000,
    enabled:  !!centerId,
  });
  const classes = classesRaw?.data ?? classesRaw ?? [];

  const selectedClass = classes.find((c) => c.id === classId);

  const { data: enrollmentsRaw = [] } = useClassEnrollments(classId);
  const enrollments = enrollmentsRaw?.data ?? enrollmentsRaw ?? [];

  // Filter enrollments for student search
  const filteredEnrollments = useMemo(() => {
    if (!studentSearch) return enrollments;
    const q = studentSearch.toLowerCase();
    return enrollments.filter((e) => {
      const n  = (e.full_name    ?? '').toLowerCase();
      const ur = (e.full_name_ur ?? '').toLowerCase();
      return n.includes(q) || ur.includes(q);
    });
  }, [enrollments, studentSearch]);

  const selectedEnrollment = enrollments.find((e) => e.id === enrollmentId || e.enrollment_id === enrollmentId);
  const studentId = selectedEnrollment?.student_user_id ?? selectedEnrollment?.id;

  // Last session for selected student
  const { data: lastProgressRaw } = useQuery({
    queryKey:  ['student-progress', studentId, classId, 'recent'],
    queryFn:   () => getStudentProgress(studentId, { class_id: classId, include: 'homework_scores' }),
    staleTime: 60_000,
    enabled:   !!studentId && !!classId,
  });
  const lastSessions = lastProgressRaw?.sessions ?? lastProgressRaw?.data?.sessions ?? [];
  const lastSession  = lastSessions[0];

  // Topics for this class's course
  const courseId = selectedClass?.course_id;
  const { data: topicsRaw = [] } = useQuery({
    queryKey:  ['topics', courseId],
    queryFn:   () => getTopics(courseId),
    staleTime: 5 * 60_000,
    enabled:   !!courseId,
  });
  const topics = topicsRaw?.data ?? topicsRaw ?? [];

  const { data: criteriaRaw = [] } = useHomeworkCriteria(classId);
  const allCriteria = criteriaRaw?.data ?? criteriaRaw ?? [];
  const criteria    = allCriteria.filter((c) => c.is_active);

  const selectedTopic   = topics.find((t) => t.id === classwork.topic_id);
  const subtopics       = selectedTopic?.subtopics ?? [];

  // Running total
  const { total, maxTotal } = useMemo(() => {
    let t = 0, m = 0;
    criteria.forEach((c) => {
      const s = scores[c.id];
      if (s?.marks !== '' && s?.marks != null) t += Number(s.marks);
      m += c.max_marks;
    });
    return { total: t, maxTotal: m };
  }, [scores, criteria]);
  const hwPct    = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : null;

  function handleScoreChange(criteriaId, update) {
    setScores((prev) => ({ ...prev, [criteriaId]: update }));
  }

  function resetForm() {
    setEnrollmentId('');
    setStudentSearch('');
    setClasswork(EMPTY_CLASSWORK);
    setScores({});
    setHwDueDate('');
    setHwNote('');
    setShowArabic(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!enrollmentId) { toast.error('Select a student.'); return; }
    if (!classwork.grade) { toast.error('Select a classwork grade.'); return; }

    const scoresArr = criteria.map((c) => ({
      criteria_id:    c.id,
      marks_obtained: scores[c.id]?.marks != null ? Number(scores[c.id].marks) : 0,
      ...(scores[c.id]?.note_ur ? { note_ur: scores[c.id].note_ur } : {}),
    }));

    const payload = {
      enrollment_id:   enrollmentId,
      student_user_id: studentId,
      class_id:        classId,
      session_date:    today(),
      classwork: {
        topic_id:    classwork.topic_id    || undefined,
        subtopic_id: classwork.subtopic_id || undefined,
        grade:       classwork.grade,
        note_ur:     classwork.note_ur     || undefined,
        note_ar:     classwork.note_ar     || undefined,
      },
      homework: {
        due_date:        hwDueDate        || undefined,
        overall_note_ur: hwNote           || undefined,
        scores:          scoresArr,
      },
    };

    try {
      await createSession.mutateAsync(payload);
      toast.success('Progress logged successfully.');
      setConfetti(true);
      setTimeout(() => setConfetti(false), 1200);
      resetForm();
    } catch (err) {
      const msgUr = err.response?.data?.error?.message_ur;
      const msg   = err.response?.data?.error?.message ?? 'Failed to save progress.';
      toast.error(msgUr ? `${msg} — ${msgUr}` : msg);
    }
  }

  const hasStudent = !!enrollmentId && !!selectedEnrollment;

  return (
    <>
      <ConfettiBurst active={confetti} />

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
          Log progress
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          Record classwork and homework scores for a student.
        </p>
      </div>

      {/* ── Step 1: select student ── */}
      <Card style={{ marginBottom: 20 }}>
        <CardHeader><span className="card-title">Select student</span></CardHeader>
        <CardBody>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="f-group" style={{ flex: '0 0 220px' }}>
              <label className="f-label">Class</label>
              <select
                className="f-select"
                value={classId}
                onChange={(e) => { setClassId(e.target.value); setEnrollmentId(''); setStudentSearch(''); }}
              >
                <option value="">— Select class —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {classId && (
              <div className="f-group" style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                <label className="f-label">Student</label>
                <input
                  ref={studentRef}
                  className="f-input"
                  placeholder="Search by name…"
                  value={hasStudent ? (selectedEnrollment?.full_name ?? '') : studentSearch}
                  onFocus={() => { if (hasStudent) { setEnrollmentId(''); setStudentSearch(''); } setShowStudents(true); }}
                  onBlur={() => setTimeout(() => setShowStudents(false), 150)}
                  onChange={(e) => { setStudentSearch(e.target.value); setEnrollmentId(''); }}
                />
                {showStudents && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', zIndex: 50, maxHeight: 240, overflowY: 'auto', marginTop: 4 }}>
                    {filteredEnrollments.length === 0 ? (
                      <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--ink-pale)' }}>No students found.</div>
                    ) : filteredEnrollments.map((en) => (
                      <div
                        key={en.id ?? en.enrollment_id}
                        onMouseDown={() => { setEnrollmentId(en.id ?? en.enrollment_id); setStudentSearch(''); setShowStudents(false); }}
                        style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--sand)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sand)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                      >
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{en.full_name ?? '—'}</div>
                        {en.full_name_ur && (
                          <div style={{ fontSize: 11, color: 'var(--ink-pale)', fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right' }}>{en.full_name_ur}</div>
                        )}
                        {en.last_session_date && (
                          <div style={{ fontSize: 11, color: 'var(--ink-pale)', marginTop: 2 }}>Last session: {en.last_session_date}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Last session summary */}
          {hasStudent && lastSession && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--sand-light)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--ink-soft)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>Last session: <strong>{lastSession.session_date}</strong></span>
              {lastSession.cw_topic_title_ur && <span>Topic: <strong style={{ fontFamily: 'var(--font-display)' }}>{lastSession.cw_topic_title_ur}</strong></span>}
              {lastSession.cw_grade && <span>Grade: <strong>{lastSession.cw_grade}</strong></span>}
            </div>
          )}
        </CardBody>
      </Card>

      {hasStudent && (
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start', marginBottom: 80 }}>

            {/* ── Left: classwork ── */}
            <Card>
              <CardHeader><span className="card-title">Today's classwork</span></CardHeader>
              <CardBody>
                {/* Topic */}
                <div className="f-group" style={{ marginBottom: 14 }}>
                  <label className="f-label">Topic</label>
                  <select
                    className="f-select"
                    value={classwork.topic_id}
                    onChange={(e) => setClasswork((f) => ({ ...f, topic_id: e.target.value, subtopic_id: '' }))}
                  >
                    <option value="">— Select topic —</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>{t.title_ur ? `${t.title_ur} / ${t.title}` : t.title}</option>
                    ))}
                  </select>
                </div>

                {/* Subtopic */}
                {subtopics.length > 0 && (
                  <div className="f-group" style={{ marginBottom: 14 }}>
                    <label className="f-label">Subtopic (optional)</label>
                    <select
                      className="f-select"
                      value={classwork.subtopic_id}
                      onChange={(e) => setClasswork((f) => ({ ...f, subtopic_id: e.target.value }))}
                    >
                      <option value="">— None —</option>
                      {subtopics.map((s) => (
                        <option key={s.id} value={s.id}>{s.title_ur || s.title}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Grade buttons */}
                <div className="f-group" style={{ marginBottom: 14 }}>
                  <label className="f-label">Classwork grade</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {GRADES.map((g) => {
                      const active = classwork.grade === g.value;
                      return (
                        <button
                          key={g.value}
                          type="button"
                          onClick={() => setClasswork((f) => ({ ...f, grade: g.value }))}
                          style={{
                            padding: '10px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: active ? 'none' : '1.5px solid var(--sand-deep)',
                            background: active ? g.bg : 'var(--white)',
                            color: active ? g.color : 'var(--ink-soft)',
                            fontWeight: active ? 700 : 500,
                            fontSize: 12,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-body)',
                            transition: 'all 0.15s',
                          }}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Urdu note */}
                <div className="f-group" style={{ marginBottom: 10 }}>
                  <label className="f-label">Teacher note — اردو</label>
                  <RTLInput
                    multiline
                    rows={3}
                    placeholder="مثلاً: مخارج بہتر ہو رہے ہیں"
                    value={classwork.note_ur}
                    onChange={(e) => setClasswork((f) => ({ ...f, note_ur: e.target.value }))}
                  />
                </div>

                {/* Arabic note (collapsible) */}
                <button
                  type="button"
                  onClick={() => setShowArabic((v) => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--emerald)', padding: 0, marginBottom: showArabic ? 10 : 0 }}
                >
                  {showArabic ? '▲ Hide Arabic note' : '+ Add Arabic note (عربي)'}
                </button>
                {showArabic && (
                  <RTLInput
                    multiline
                    rows={2}
                    placeholder="ملاحظة بالعربية…"
                    value={classwork.note_ar}
                    onChange={(e) => setClasswork((f) => ({ ...f, note_ar: e.target.value }))}
                  />
                )}
              </CardBody>
            </Card>

            {/* ── Right: homework ── */}
            <Card>
              <CardHeader><span className="card-title">Homework scores</span></CardHeader>
              <CardBody>
                {criteria.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--ink-pale)', textAlign: 'center', padding: '20px 0' }}>
                    No homework criteria defined for this class.
                    <br />Go to Classes → Homework Criteria to add some.
                  </p>
                ) : (
                  <>
                    {criteria.map((c) => (
                      <ScoreRow
                        key={c.id}
                        criterion={c}
                        score={scores[c.id]}
                        onChange={handleScoreChange}
                      />
                    ))}

                    {/* Running total */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 0', marginTop: 4, borderTop: '2px solid var(--sand-mid)',
                    }}>
                      <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Total</span>
                      <span style={{ fontWeight: 700, fontSize: 16, color: pctColor(hwPct) }}>
                        {total} / {maxTotal}
                        {hwPct !== null && (
                          <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 6 }}>({hwPct}%)</span>
                        )}
                      </span>
                    </div>
                  </>
                )}

                <hr style={{ border: 'none', borderTop: '1px solid var(--sand-mid)', margin: '14px 0' }} />

                <div className="f-group" style={{ marginBottom: 14 }}>
                  <label className="f-label">Homework due date</label>
                  <input
                    className="f-input"
                    type="date"
                    value={hwDueDate}
                    onChange={(e) => setHwDueDate(e.target.value)}
                  />
                </div>

                <div className="f-group">
                  <label className="f-label">Overall note — اردو</label>
                  <RTLInput
                    multiline
                    rows={2}
                    placeholder="کل دوبارہ پڑھ کر آئیں"
                    value={hwNote}
                    onChange={(e) => setHwNote(e.target.value)}
                  />
                </div>
              </CardBody>
            </Card>
          </div>

          {/* ── Sticky submit bar ── */}
          <div style={{
            position: 'fixed', bottom: 0, left: 'var(--sidebar-w)', right: 0,
            background: 'var(--white)', borderTop: '1px solid var(--sand-mid)',
            padding: '12px 28px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            zIndex: 40,
          }}>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              <strong style={{ color: 'var(--ink)' }}>{selectedEnrollment?.full_name ?? '—'}</strong>
              {' · '}{selectedClass?.name ?? ''}
              {' · '}<span style={{ color: 'var(--ink-pale)' }}>{today()}</span>
            </span>
            <Can permission="progress.create">
              <Button
                type="submit"
                variant="primary"
                disabled={createSession.isPending || !classwork.grade}
                style={{ padding: '10px 28px', fontSize: 14 }}
              >
                {createSession.isPending ? 'Saving…' : 'Save progress log'}
              </Button>
            </Can>
          </div>
        </form>
      )}
    </>
  );
}
