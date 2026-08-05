import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import Badge from '../../../components/Badge';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../hooks/useAuth';
import { getHomeworkGridSheet, saveHomeworkGridMarks } from '../../../api/homework';

function safeFormatDate(dateStr) {
  if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return 'Unscheduled';
  try {
    const clean = String(dateStr).split('T')[0];
    const d = new Date(clean + 'T00:00:00');
    return isNaN(d.getTime()) ? 'Unscheduled' : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return 'Unscheduled';
  }
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16, height: '100%' },
  headerCard: {
    background: 'var(--surface-1, #f9fafb)',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 'var(--radius-md, 8px)',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justify: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  metaGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  title: { fontSize: 18, fontWeight: 700, color: 'var(--ink, #111827)' },
  subTitle: { fontSize: 13, color: 'var(--ink-pale, #6b7280)' },
  tableWrap: {
    overflowX: 'auto',
    overflowY: 'auto',
    maxHeight: '70vh',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 8,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
    textAlign: 'left',
  },
  th: {
    background: 'var(--surface-2, #f3f4f6)',
    padding: '12px 14px',
    fontWeight: 600,
    color: 'var(--ink, #374151)',
    borderBottom: '2px solid var(--border, #e5e7eb)',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 2,
  },
  td: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border, #f3f4f6)',
    verticalAlign: 'middle',
  },
  wordCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  arabicText: {
    fontFamily: 'var(--font-arabic, "Scheherazade New", serif)',
    fontSize: 20,
    direction: 'rtl',
    color: 'var(--emerald, #059669)',
    fontWeight: 700,
  },
  ruleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 6,
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    fontWeight: 500,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justify: 'space-between',
    paddingTop: 16,
    borderTop: '1px solid var(--border, #e5e7eb)',
    flexWrap: 'wrap',
    gap: 12,
  },
};

export function HomeworkGridSheetView({
  assignment,
  classId,
  readOnly = false,
  onBack,
  onClose,
  open = true,
  asPage = false,
}) {
  const toast = useToast();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const assignmentId = assignment?.id;

  const [marksState, setMarksState] = useState(new Map());
  const [studentNotes, setStudentNotes] = useState({});

  const { data: gridData, isLoading, refetch } = useQuery({
    queryKey: ['homework-grid', assignmentId, classId],
    queryFn: () => getHomeworkGridSheet(assignmentId, classId),
    enabled: !!assignmentId && (open || asPage || !!onBack),
    staleTime: 0,
  });

  const isPublished = gridData?.assignment?.is_published ?? assignment?.is_published;
  const isPreviewMode = !classId; // In Teacher and Manager portal (when classId is provided), show dynamic student columns
  const contents = gridData?.contents || [];
  const students = gridData?.students || [];
  const calculatedMaxMarks = gridData?.calculated_max_marks || assignment?.total_marks || 0;

  const evaluatorId = gridData?.evaluator_teacher_id || assignment?.marked_by_teacher_id;
  const evaluatorName = gridData?.evaluator_teacher_name || assignment?.marked_by_teacher_name;
  const isFullyMarked = gridData?.is_fully_marked ?? assignment?.is_fully_marked;

  const isTeacher = role === 'teacher' || (user?.roles && user.roles.includes('teacher'));
  const isManagerOnly = (role === 'center_manager' || (user?.roles && user.roles.includes('center_manager'))) && !isTeacher;

  const isUserEvaluator = !evaluatorId || (user && user.id === evaluatorId);
  const isLockedByOther = Boolean(isFullyMarked && evaluatorId && !isUserEvaluator);

  const effectiveReadOnly = readOnly || !isTeacher || isLockedByOther;

  // Flatten words across all linked contents
  const flattenedRows = useMemo(() => {
    const rows = [];
    contents.forEach((content) => {
      const words = content.words || [];
      if (words.length === 0) {
        rows.push({
          contentId: content.id,
          contentTitle: content.title || `Content (${content?.surah_number || 'Arabic Text'})`,
          wordId: `content-${content.id}`,
          wordText: content.arabic_text || content.title || '—',
          translation: content.translation || '',
          rules: [],
          maxMarks: content.total_marks || 1,
        });
      } else {
        words.forEach((w) => {
          const rules = Array.isArray(w.rule_details) ? w.rule_details : [];
          let wordMax = 0;
          if (rules.length > 0) {
            rules.forEach((r) => {
              wordMax += (r.marks_per_rule ?? 1) * (r.occurrence_count ?? 1);
            });
          } else {
            wordMax = 1;
          }
          rows.push({
            contentId: content.id,
            contentTitle: content.title || content?.label || `Surah ${content?.surah_number || ''} Ayah ${content?.ayah_number || ''}`,
            wordId: w.id,
            wordText: w.word_ar || w.word_text || '—',
            translation: w.translation || '',
            rules,
            comments: w.note || '—',
            maxMarks: wordMax,
          });
        });
      }
    });
    return rows;
  }, [contents]);

  // Sync saved marks and student remarks into state
  useEffect(() => {
    if (gridData?.marks) {
      const map = new Map();
      gridData.marks.forEach((m) => {
        const keyWithSub = `${m.student_id}_${m.word_id}_${m.subtopic_id || 'default'}`;
        const keyWordOnly = `${m.student_id}_${m.word_id}`;
        map.set(keyWithSub, m.marks_awarded);
        map.set(keyWordOnly, m.marks_awarded);
      });
      setMarksState(map);
    }

    if (gridData?.submissions) {
      const notes = {};
      gridData.submissions.forEach((sub) => {
        if (sub.teacher_note && sub.teacher_note !== 'Evaluated via Homework Grid Sheet') {
          notes[sub.student_id] = sub.teacher_note;
        }
      });
      setStudentNotes(notes);
    }
  }, [gridData]);

  // Handle cell score input
  const handleScoreChange = (studentId, wordId, subtopicId, newScore) => {
    const keyWithSub = `${studentId}_${wordId}_${subtopicId || 'default'}`;
    const keyWordOnly = `${studentId}_${wordId}`;
    setMarksState((prev) => {
      const next = new Map(prev);
      const score = Math.max(0, newScore);
      next.set(keyWithSub, score);
      next.set(keyWordOnly, score);
      return next;
    });
  };

  // Compute student totals live
  const studentTotals = useMemo(() => {
    const totals = new Map();
    students.forEach((s) => {
      let sum = 0;
      flattenedRows.forEach((r) => {
        const subId = r.rules?.[0]?.subtopic_id || null;
        const keyWithSub = `${s.student_id}_${r.wordId}_${subId || 'default'}`;
        const keyWordOnly = `${s.student_id}_${r.wordId}`;
        const val = marksState.get(keyWithSub) ?? marksState.get(keyWordOnly);
        sum += Number(val || 0);
      });
      totals.set(s.student_id, sum);
    });
    return totals;
  }, [students, flattenedRows, marksState]);

  // Save Mutation
  const saveMut = useMutation({
    mutationFn: () => {
      const marksPayload = [];
      students.forEach((s) => {
        flattenedRows.forEach((r) => {
          const subId = r.rules?.[0]?.subtopic_id || null;
          const keyWithSub = `${s.student_id}_${r.wordId}_${subId || 'default'}`;
          const keyWordOnly = `${s.student_id}_${r.wordId}`;
          const awarded = marksState.get(keyWithSub) ?? marksState.get(keyWordOnly);
          if (awarded !== undefined && awarded !== null && awarded !== '') {
            marksPayload.push({
              student_id: s.student_id,
              word_id: r.wordId,
              subtopic_id: subId,
              marks_awarded: Number(awarded),
            });
          }
        });
      });
      return saveHomeworkGridMarks(assignmentId, classId, marksPayload, studentNotes);
    },
    onSuccess: () => {
      toast.success('Homework marks and remarks saved successfully!');
      queryClient.invalidateQueries(['homework-grid', assignmentId, classId]);
      refetch();
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to save homework marks.');
    },
  });

  if (!open && !asPage && !onBack) return null;

  const bodyContent = (
    <div style={S.wrap}>
      {/* Navigation for Full Page Mode */}
      {onBack && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 }}>
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            disabled={saveMut.isPending}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          >
            ← Back to Assignments List
          </Button>
          {!isPreviewMode && !effectiveReadOnly && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => saveMut.mutate()}
              isLoading={saveMut.isPending}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              Save Evaluation
            </Button>
          )}
        </div>
      )}

      {/* Notice Banner for Center Managers */}
      {isManagerOnly && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: 'var(--radius-md, 8px)',
          padding: '12px 16px',
          fontSize: 13,
          color: '#475569',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>ℹ️</span>
          <div>
            <strong>Read-Only View:</strong> Center Managers can view student marks and manage due dates, but grid sheet marking is restricted to classroom teachers.
          </div>
        </div>
      )}

      {/* Locked Notice Banner for other teachers */}
      {isLockedByOther && isTeacher && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 'var(--radius-md, 8px)',
          padding: '12px 16px',
          fontSize: 13,
          color: '#1e40af',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>🔒</span>
          <div>
            <strong>Fully Evaluated:</strong> This assignment was completed by Teacher <strong>{evaluatorName || 'another teacher'}</strong>. Editing is restricted to <strong>{evaluatorName || 'the evaluator'}</strong>.
          </div>
        </div>
      )}

      {/* Header Summary */}
      <div style={S.headerCard}>
        <div style={S.metaGroup}>
          <div style={S.title}>
            {assignment?.title || 'Homework Assignment'}
          </div>
          <div style={S.subTitle}>
            Due Date: <strong>{safeFormatDate(assignment?.due_date)}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {evaluatorName && (
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--emerald, #059669)', background: '#ecfdf5', padding: '6px 12px', borderRadius: 16, border: '1px solid #a7f3d0' }}>
              👤 Evaluated by {evaluatorName}
            </div>
          )}
          <Badge variant={isPublished ? 'green' : 'amber'}>
            {isPublished ? 'Published' : 'Draft Preview'}
          </Badge>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--emerald, #059669)', background: '#ecfdf5', padding: '8px 14px', borderRadius: 20, border: '1px solid #a7f3d0' }}>
            Max Score: {calculatedMaxMarks} Marks
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 64, display: 'flex', justifyContent: 'center' }}>
          <LoadingSpinner size={36} />
        </div>
      ) : contents.length === 0 ? (
        <EmptyState
          icon="📖"
          title="No Content Attached"
          description="No practice content items (verses or Arabic words) have been linked to this homework assignment yet."
        />
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 50, textAlign: 'center' }}>#</th>
                <th style={{ ...S.th, minWidth: 220 }}>Content / Verse Word</th>
                <th style={{ ...S.th, minWidth: 180 }}>Assessed Rule</th>
                <th style={{ ...S.th, minWidth: 150 }}>Notes</th>
                <th style={{ ...S.th, textAlign: 'center', width: 90 }}>Max Marks</th>

                {/* Student Columns if live evaluation mode */}
                {!isPreviewMode &&
                  students.map((s) => (
                    <th key={s.student_id} style={{ ...S.th, textAlign: 'center', minWidth: 140 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{s.full_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--emerald)', fontWeight: 700, marginTop: 2 }}>
                        Score: {studentTotals.get(s.student_id) || 0} / {calculatedMaxMarks}
                      </div>
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {flattenedRows.map((row, idx) => {
                const firstRule = row.rules?.[0];
                const subId = firstRule?.subtopic_id || null;

                return (
                  <tr key={`${row.wordId}-${idx}`}>
                    <td style={{ ...S.td, color: 'var(--ink-pale)', fontSize: 12, textAlign: 'center', fontWeight: 600 }}>
                      {idx + 1}
                    </td>

                    {/* Word & Arabic Text */}
                    <td style={S.td}>
                      <div style={S.wordCell}>
                        <span style={S.arabicText}>{row.wordText}</span>
                        <span style={{ fontSize: 12, color: 'var(--ink-pale)', fontWeight: 500 }}>
                          {row.contentTitle} {row.translation ? `— "${row.translation}"` : ''}
                        </span>
                      </div>
                    </td>

                    {/* Rules */}
                    <td style={S.td}>
                      {row.rules.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {row.rules.map((r, rIdx) => (
                            <span key={rIdx} style={S.ruleBadge}>
                              {r.rule_name || r.subtopic_name || 'Rule'} ({r.marks_per_rule || 1} mk)
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--ink-pale)', fontStyle: 'italic' }}>
                          Standard Recitation
                        </span>
                      )}
                    </td>

                    <td style={{ ...S.td, color: 'var(--ink)', fontSize: 13 }}>
                      {row.comments}
                    </td>

                    {/* Max Marks */}
                    <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: 'var(--emerald)', fontSize: 14 }}>
                      {row.maxMarks}
                    </td>

                    {/* Student Evaluation Cells - Simple Number Input */}
                    {!isPreviewMode &&
                      students.map((stu) => {
                        const keyWithSub = `${stu.student_id}_${row.wordId}_${subId || 'default'}`;
                        const keyWordOnly = `${stu.student_id}_${row.wordId}`;
                        const currentVal = marksState.get(keyWithSub) ?? marksState.get(keyWordOnly) ?? '';

                        if (effectiveReadOnly) {
                          return (
                            <td key={stu.student_id} style={{ ...S.td, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
                              <span style={{ color: currentVal > 0 ? 'var(--emerald)' : 'var(--ink-pale)' }}>
                                {currentVal || 0} / {row.maxMarks}
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td key={stu.student_id} style={{ ...S.td, textAlign: 'center', background: '#fafbfc' }}>
                            <input
                              type="number"
                              min={0}
                              max={row.maxMarks}
                              disabled={saveMut.isPending}
                              value={currentVal}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                if (!isNaN(val)) {
                                  handleScoreChange(stu.student_id, row.wordId, subId, Math.min(row.maxMarks, Math.max(0, val)));
                                }
                              }}
                              onFocus={(e) => e.target.select()}
                              style={{
                                width: 64,
                                textAlign: 'center',
                                fontWeight: 700,
                                fontSize: 14,
                                padding: '6px 8px',
                                border: '1.5px solid var(--border, #d1d5db)',
                                borderRadius: 6,
                                background: 'var(--white, #fff)',
                                outline: 'none',
                                color: 'var(--ink, #111827)',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              }}
                            />
                          </td>
                        );
                      })}
                  </tr>
                );
              })}

              {/* Overall Remarks / Mistake Analysis Row */}
              {!isPreviewMode && students.length > 0 && (
                <tr style={{ background: 'var(--surface-1, #f9fafb)', borderTop: '2px solid var(--border, #d1d5db)' }}>
                  <td colSpan={5} style={{ ...S.td, padding: '16px 20px', fontWeight: 600, color: 'var(--ink, #111827)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 14, color: 'var(--ink)' }}> Overall Remarks & Mistake Analysis</span>
                      <span style={{ fontSize: 12, color: 'var(--ink-pale)', fontWeight: 400 }}>
                        Explain why marks were deducted or point out specific mistakes to help students improve next lesson.
                      </span>
                    </div>
                  </td>
                  {students.map((stu) => (
                    <td key={stu.student_id} style={{ ...S.td, padding: '12px 10px', verticalAlign: 'top', background: '#fafbfc' }}>
                      {effectiveReadOnly ? (
                        <div style={{ fontSize: 12, color: studentNotes[stu.student_id] ? 'var(--ink)' : 'var(--ink-pale)', fontStyle: studentNotes[stu.student_id] ? 'normal' : 'italic', whiteSpace: 'pre-wrap', minHeight: 40 }}>
                          {studentNotes[stu.student_id] || 'No remarks provided.'}
                        </div>
                      ) : (
                        <textarea
                          disabled={saveMut.isPending}
                          placeholder="Add mistake feedback or remarks..."
                          value={studentNotes[stu.student_id] || ''}
                          onChange={(e) => setStudentNotes((prev) => ({ ...prev, [stu.student_id]: e.target.value }))}
                          rows={3}
                          style={{
                            width: '100%',
                            minWidth: 140,
                            fontSize: 12,
                            padding: '8px 10px',
                            border: '1px solid var(--border, #d1d5db)',
                            borderRadius: 6,
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            color: 'var(--ink, #111827)',
                            background: 'var(--white, #fff)',
                            lineHeight: 1.4,
                          }}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div style={S.footer}>
        <div style={{ fontSize: 13, color: 'var(--ink-pale)', fontWeight: 500 }}>
          {isPreviewMode
            ? 'Preview Mode: Publish this assignment to evaluate student submissions.'
            : `Evaluated for ${students.length} enrolled students.`}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {onClose && (
            <Button variant="outline" onClick={onClose} disabled={saveMut.isPending}>
              Close
            </Button>
          )}
          {onBack && (
            <Button variant="outline" onClick={onBack} disabled={saveMut.isPending}>
              Back to List
            </Button>
          )}
          {!isPreviewMode && !effectiveReadOnly && (
            <Button
              variant="primary"
              onClick={() => saveMut.mutate()}
              isLoading={saveMut.isPending}
            >
              Save Homework Marks
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  if (asPage || onBack) {
    return (
      <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)', padding: 24, margin: '8px 0' }}>
        {bodyContent}
      </div>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Homework Grid Sheet ${isPreviewMode ? '(Preview)' : '(Evaluation)'}`}
      size="xl"
    >
      {bodyContent}
    </Modal>
  );
}

// Default export keeps existing Modal compatibility for admin previews
export default function HomeworkGridModal(props) {
  return <HomeworkGridSheetView {...props} />;
}
