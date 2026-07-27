import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import Badge from '../../../components/Badge';
import { useToast } from '../../../hooks/useToast';
import { getClassworkSheet, saveClassworkSheet } from '../../../api/classwork';

// ── Grade & Emoji Helpers ───────────────────────────────────────────────────
/**
 * Rating Emojis based on marks out of 10:
 * 9 to 10 -> 🌞
 * 7 to 8  -> 🌟
 * 5 to 6  -> ⭐
 * Below 5 -> 🌙
 */
export function getGradeRating(gradeVal) {
  const num = parseFloat(gradeVal);
  if (isNaN(num)) {
    return { emoji: '⭐', label: 'Not Graded', color: '#6b7280', bg: '#f3f4f6' };
  }
  if (num >= 9) {
    return { emoji: '🌞', label: 'Excellent (9-10)', color: '#d97706', bg: '#fef3c7', border: '#fde68a' };
  }
  if (num >= 7) {
    return { emoji: '🌟', label: 'Very Good (7-8)', color: '#059669', bg: '#d1fae5', border: '#a7f3d0' };
  }
  if (num >= 5) {
    return { emoji: '⭐', label: 'Good (5-6)', color: '#2563eb', bg: '#dbeafe', border: '#bfdbfe' };
  }
  return { emoji: '🌙', label: 'Needs Practice (<5)', color: '#7c3aed', bg: '#f3e8ff', border: '#ddd6fe' };
}

// ── Style Tokens ──────────────────────────────────────────────────────────────
const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16, height: '100%' },
  headerCard: {
    background: 'var(--surface-1, #f9fafb)',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 'var(--radius-md, 8px)',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  fGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  fLabel: { fontSize: 12, fontWeight: 600, color: 'var(--ink, #374151)' },
  fSelect: {
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid var(--border, #d1d5db)',
    fontSize: 13,
    background: 'var(--white, #fff)',
    color: 'var(--ink, #111827)',
    outline: 'none',
  },
  fTextArea: {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--border, #d1d5db)',
    fontSize: 13,
    fontFamily: 'inherit',
    background: 'var(--white, #fff)',
    color: 'var(--ink, #111827)',
    outline: 'none',
    resize: 'vertical',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--ink, #111827)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  scrollList: {
    overflowY: 'auto',
    maxHeight: '52vh',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    paddingRight: 4,
  },
  studentCard: {
    background: 'var(--white, #ffffff)',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 'var(--radius-md, 10px)',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    transition: 'all 0.15s ease',
  },
  studentHeader: {
    display: 'flex',
    justify: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottom: '1px dashed var(--border, #e5e7eb)',
  },
  studentInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'var(--emerald-light, #ecfdf5)',
    color: 'var(--emerald, #059669)',
    border: '1px solid #a7f3d0',
    display: 'flex',
    alignItems: 'center',
    justify: 'center',
    fontWeight: 700,
    fontSize: 13,
  },
  gridTwo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12,
  },
  gridInputs: {
    display: 'grid',
    gridTemplateColumns: '1fr 140px',
    gap: 12,
  },
  ratingBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid transparent',
  },
  viewDetailRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 12,
    background: 'var(--surface-1, #f9fafb)',
    borderRadius: 8,
    padding: '10px 14px',
    border: '1px solid var(--border, #f3f4f6)',
  },
  footer: {
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    justify: 'space-between',
    gap: 12,
    paddingTop: 12,
    borderTop: '1px solid var(--border, #e5e7eb)',
  },
};

/**
 * Teacher & Manager Classwork Sheet Modal
 *
 * Per-Student Assessment Workflow:
 * 1. Present/Late Students loaded for the class session.
 * 2. Each student gets individual Topic selection & dynamic Subtopic selection.
 * 3. Detailed comments/description (rules tested, specific weaknesses, errors, corrections).
 * 4. Grade / Marks out of 10 with live Rating Emoji (🌞, 🌟, ⭐, 🌙).
 * 5. Structured View Layout for Center Managers and Student Portals.
 */
export default function TeacherClassworkModal({
  open,
  onClose,
  classId,
  session,
  enrolledStudents = [],
  courseId,
  readOnly = false,
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const planId = session?.plan_id; // class_session_plans.id

  // ── Form State ──────────────────────────────────────────────────────────────
  const [description, setDescription] = useState('');
  const [entriesMap, setEntriesMap] = useState(new Map());

  // ── Fetch Context Data ──────────────────────────────────────────────────────
  const {
    data: contextData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['classwork-sheet', planId],
    queryFn: () => getClassworkSheet(planId),
    enabled: !!planId && open,
    staleTime: 0,
  });

  const noPlan = open && !planId;
  const topics = contextData?.topics || [];
  const presentStudents = contextData?.present_students?.length
    ? contextData.present_students
    : enrolledStudents.map((s) => ({
        student_id: s.student_user_id ?? s.student_id ?? s.id,
        full_name: s.full_name,
        full_name_ur: s.full_name_ur,
        attendance_status: 'unmarked',
      }));

  // ── Sync loaded sheet data into form ───────────────────────────────────────
  useEffect(() => {
    if (!contextData) return;

    const sheet = contextData.sheet;
    const defaultTopicId = session?.plan_topic_id || session?.topic_id || (topics[0]?.id ?? '');
    const defaultTopicObj = topics.find((t) => t.id === defaultTopicId);
    const defaultSubtopicId = defaultTopicObj?.subtopics?.[0]?.id || '';

    if (sheet) {
      setDescription(sheet.description || '');

      const map = new Map();
      (sheet.entries || []).forEach((entry) => {
        map.set(entry.student_id, {
          topic_id: entry.topic_id || defaultTopicId,
          subtopic_id: entry.subtopic_id || defaultSubtopicId,
          grade: entry.grade ?? '',
          comments: entry.comments ?? '',
          topic_title: entry.topic_title,
          topic_title_ur: entry.topic_title_ur,
          subtopic_title: entry.subtopic_title,
          subtopic_title_ur: entry.subtopic_title_ur,
        });
      });
      setEntriesMap(map);
    } else {
      setDescription('');
      const map = new Map();
      presentStudents.forEach((stu) => {
        map.set(stu.student_id, {
          topic_id: defaultTopicId,
          subtopic_id: defaultSubtopicId,
          grade: '',
          comments: '',
        });
      });
      setEntriesMap(map);
    }
  }, [contextData, session, open]);

  // Handle Per-Student Topic selection change
  const handleStudentTopicChange = (studentId, newTopicId) => {
    const matchedTopic = topics.find((t) => t.id === newTopicId);
    const firstSubtopicId = matchedTopic?.subtopics?.[0]?.id || '';

    setEntriesMap((prev) => {
      const next = new Map(prev);
      const current = next.get(studentId) || { grade: '', comments: '' };
      next.set(studentId, {
        ...current,
        topic_id: newTopicId,
        subtopic_id: firstSubtopicId,
      });
      return next;
    });
  };

  // Handle Per-Student field updates
  const handleStudentEntryChange = (studentId, field, value) => {
    setEntriesMap((prev) => {
      const next = new Map(prev);
      const current = next.get(studentId) || { topic_id: '', subtopic_id: '', grade: '', comments: '' };
      next.set(studentId, { ...current, [field]: value });
      return next;
    });
  };

  // ── Save Classwork Sheet Mutation ───────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: () => {
      const entries = presentStudents.map((stu) => {
        const entry = entriesMap.get(stu.student_id) || {};
        return {
          student_id: stu.student_id,
          topic_id: entry.topic_id || null,
          subtopic_id: entry.subtopic_id || null,
          grade: entry.grade !== undefined && entry.grade !== '' ? String(entry.grade) : null,
          comments: entry.comments || null,
        };
      });

      // Default sheet-level topic to first entry's topic or session topic
      const firstTopicId = entries[0]?.topic_id || session?.plan_topic_id || session?.topic_id || null;

      return saveClassworkSheet(planId, {
        topic_id: firstTopicId,
        subtopic_id: null,
        description: description || null,
        entries,
      });
    },
    onSuccess: () => {
      toast.success('Classwork sheet saved successfully!');
      queryClient.invalidateQueries(['classwork-sheet', planId]);
      refetch();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to save classwork sheet.');
    },
  });

  if (!open) return null;

  const sessionLabel =
    session?.display_topic_title ||
    session?.topic_title ||
    `Session ${session?.session_number ?? ''}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Classwork Sheet${readOnly ? ' (View)' : ''} — ${sessionLabel}`}
      size="xl"
    >
      <div style={S.wrap}>
        {noPlan ? (
          <EmptyState
            icon="📅"
            title="No Session Plan"
            description="This session doesn't have a topic plan attached yet."
          />
        ) : isLoading ? (
          <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
            <LoadingSpinner size={32} />
          </div>
        ) : (
          <>
            {/* ── Session General Notes Header ── */}
            <div style={S.headerCard}>
              <div style={S.fGroup}>
                <label style={S.fLabel}>Class Session Notes / General Activity</label>
                {readOnly ? (
                  <div style={{ fontSize: 13, color: 'var(--ink, #1f2937)', fontStyle: description ? 'normal' : 'italic' }}>
                    {description || 'No general lesson notes recorded for this class session.'}
                  </div>
                ) : (
                  <textarea
                    style={S.fTextArea}
                    rows={2}
                    placeholder="General summary of session activities or practice rules covered..."
                    value={description}
                    disabled={saveMut.isPending}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                )}
              </div>
            </div>

            {/* ── Students Evaluation List ── */}
            <div>
              <div style={S.sectionHeader}>
                <span>Student Assessments ({presentStudents.length} Students)</span>
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-pale, #6b7280)' }}>
                  Evaluated for present / active students
                </span>
              </div>
            </div>

            {presentStudents.length === 0 ? (
              <EmptyState
                icon=""
                title="No Present Students Found"
                description="There are no present or active students to assess for this session."
              />
            ) : (
              <div style={S.scrollList}>
                {presentStudents.map((stu) => {
                  const entry = entriesMap.get(stu.student_id) || {
                    topic_id: '',
                    subtopic_id: '',
                    grade: '',
                    comments: '',
                  };

                  const currentStudentTopicId = entry.topic_id || topics[0]?.id || '';
                  const currentStudentTopicObj = topics.find((t) => t.id === currentStudentTopicId);
                  const studentSubtopics = currentStudentTopicObj?.subtopics || [];

                  const rating = getGradeRating(entry.grade);
                  const initials = (stu.full_name || 'S')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  // ── READ ONLY / VIEW MODE LAYOUT ─────────────────────────────
                  if (readOnly) {
                    const matchedTopic = topics.find((t) => t.id === entry.topic_id);
                    const matchedSubtopic = matchedTopic?.subtopics?.find((s) => s.id === entry.subtopic_id);

                    const topicName = entry.topic_title || matchedTopic?.title || '—';
                    const topicUr = entry.topic_title_ur || matchedTopic?.title_ur;
                    const subtopicName = entry.subtopic_title || matchedSubtopic?.title || '—';
                    const subtopicUr = entry.subtopic_title_ur || matchedSubtopic?.title_ur;

                    return (
                      <div key={stu.student_id} style={S.studentCard}>
                        <div style={S.studentHeader}>
                          <div style={S.studentInfo}>
                            <div style={S.avatar}>{initials}</div>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink, #111827)' }}>
                                {stu.full_name}
                              </span>
                              {stu.full_name_ur && (
                                <span
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--ink-pale)',
                                    marginLeft: 8,
                                    fontFamily: 'var(--font-arabic, serif)',
                                  }}
                                >
                                  ({stu.full_name_ur})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Grade & Rating Emoji Badge */}
                          <div
                            style={{
                              ...S.ratingBadge,
                              background: rating.bg,
                              color: rating.color,
                              borderColor: rating.border,
                            }}
                          >
                            <span style={{ fontSize: 16 }}>{rating.emoji}</span>
                            <span>
                              {entry.grade !== '' && entry.grade !== null
                                ? `${entry.grade} / 10`
                                : 'Not Graded'}
                            </span>
                            <span style={{ fontSize: 11, opacity: 0.85 }}>({rating.label})</span>
                          </div>
                        </div>

                        {/* View details grid: Topic, Subtopic, Description */}
                        <div style={S.viewDetailRow}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-pale, #6b7280)', textTransform: 'uppercase' }}>
                              Topic
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink, #1f2937)', marginTop: 2 }}>
                              {topicName} {topicUr ? `(${topicUr})` : ''}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-pale, #6b7280)', textTransform: 'uppercase' }}>
                              Subtopic
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink, #1f2937)', marginTop: 2 }}>
                              {subtopicName} {subtopicUr ? `(${subtopicUr})` : ''}
                            </div>
                          </div>
                        </div>

                        {/* Comments / Remarks */}
                        <div style={{ fontSize: 13, color: 'var(--ink, #374151)', background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--ink-light, #4b5563)' }}>Remarks / Error Feedback: </span>
                          {entry.comments || 'No remarks added.'}
                        </div>
                      </div>
                    );
                  }

                  // ── TEACHER FORM / EDIT MODE LAYOUT ──────────────────────────
                  return (
                    <div key={stu.student_id} style={S.studentCard}>
                      {/* Student Title Bar */}
                      <div style={S.studentHeader}>
                        <div style={S.studentInfo}>
                          <div style={S.avatar}>{initials}</div>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink, #111827)' }}>
                              {stu.full_name}
                            </span>
                            {stu.full_name_ur && (
                              <span
                                style={{
                                  fontSize: 12,
                                  color: 'var(--ink-pale)',
                                  marginLeft: 8,
                                  fontFamily: 'var(--font-arabic, serif)',
                                }}
                              >
                                ({stu.full_name_ur})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Attendance Badge & Live Rating Emoji */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {stu.attendance_status && (
                            <Badge
                              variant={
                                stu.attendance_status === 'present'
                                  ? 'green'
                                  : stu.attendance_status === 'late'
                                  ? 'gold'
                                  : 'sand'
                              }
                            >
                              {stu.attendance_status === 'unmarked'
                                ? 'Enrolled'
                                : stu.attendance_status}
                            </Badge>
                          )}

                          <div
                            style={{
                              ...S.ratingBadge,
                              background: rating.bg,
                              color: rating.color,
                              borderColor: rating.border,
                            }}
                          >
                            <span style={{ fontSize: 15 }}>{rating.emoji}</span>
                            <span>{entry.grade !== '' ? `${entry.grade}/10` : '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Topic & Dynamic Subtopic Selectors for this Student */}
                      <div style={S.gridTwo}>
                        <div style={S.fGroup}>
                          <label style={S.fLabel}>Assessed Topic</label>
                          <select
                            style={S.fSelect}
                            value={currentStudentTopicId}
                            disabled={saveMut.isPending}
                            onChange={(e) => handleStudentTopicChange(stu.student_id, e.target.value)}
                          >
                            <option value="">— Select Topic —</option>
                            {topics.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title} {t.title_ur ? `(${t.title_ur})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={S.fGroup}>
                          <label style={S.fLabel}>Subtopic</label>
                          <select
                            style={S.fSelect}
                            value={entry.subtopic_id || ''}
                            disabled={saveMut.isPending || !studentSubtopics.length}
                            onChange={(e) =>
                              handleStudentEntryChange(stu.student_id, 'subtopic_id', e.target.value)
                            }
                          >
                            <option value="">
                              {studentSubtopics.length ? '— Select Subtopic —' : 'No subtopics'}
                            </option>
                            {studentSubtopics.map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                {sub.title} {sub.title_ur ? `(${sub.title_ur})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Description / Remarks & Marks Inputs */}
                      <div style={S.gridInputs}>
                        <div style={S.fGroup}>
                          <label style={S.fLabel}>Description / Comments (Rule asked, weakness, errors)</label>
                          <textarea
                            style={{ ...S.fTextArea, minHeight: 38 }}
                            rows={1}
                            placeholder="Add comments on rules tested, specific mistakes, or strengths..."
                            value={entry.comments}
                            disabled={saveMut.isPending}
                            onChange={(e) =>
                              handleStudentEntryChange(stu.student_id, 'comments', e.target.value)
                            }
                          />
                        </div>

                        <div style={S.fGroup}>
                          <label style={S.fLabel}>Marks (Max 10)</label>
                          <select
                            style={S.fSelect}
                            value={entry.grade ?? ''}
                            disabled={saveMut.isPending}
                            onChange={(e) =>
                              handleStudentEntryChange(stu.student_id, 'grade', e.target.value)
                            }
                          >
                            <option value="">— Grade —</option>
                            <option value="10">10 (🌞 Excellent)</option>
                            <option value="9">9 (🌞 Excellent)</option>
                            <option value="8">8 (🌟 Very Good)</option>
                            <option value="7">7 (🌟 Very Good)</option>
                            <option value="6">6 (⭐ Good)</option>
                            <option value="5">5 (⭐ Good)</option>
                            <option value="4">4 (🌙 Practice)</option>
                            <option value="3">3 (🌙 Practice)</option>
                            <option value="2">2 (🌙 Practice)</option>
                            <option value="1">1 (🌙 Practice)</option>
                            <option value="0">0 (🌙 Practice)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Footer ── */}
            <div style={S.footer}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--ink-pale, #6b7280)' }}>
                <span>Rating Scale:</span>
                <span>🌞 9-10</span>
                <span>🌟 7-8</span>
                <span>⭐ 5-6</span>
                <span>🌙 &lt;5</span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="outline" onClick={onClose} disabled={saveMut.isPending}>
                  Close
                </Button>
                {!readOnly && (
                  <Button
                    variant="primary"
                    onClick={() => saveMut.mutate()}
                    isLoading={saveMut.isPending}
                  >
                   Save Classwork Sheet
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
