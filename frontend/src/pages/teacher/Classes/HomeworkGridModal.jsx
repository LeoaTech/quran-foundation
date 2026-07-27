import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import Badge from '../../../components/Badge';
import { useToast } from '../../../hooks/useToast';
import { getHomeworkGridSheet } from '../../../api/homework';

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16, height: '100%' },
  headerCard: {
    background: 'var(--surface-1, #f9fafb)',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 'var(--radius-md, 8px)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justify: 'space-between',
    gap: 16,
  },
  metaGroup: { display: 'flex', flexDirection: 'column', gap: 2 },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--ink, #111827)' },
  subTitle: { fontSize: 12, color: 'var(--ink-pale, #6b7280)' },
  tableWrap: {
    overflowX: 'auto',
    overflowY: 'auto',
    maxHeight: '56vh',
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
    padding: '10px 12px',
    fontWeight: 600,
    color: 'var(--ink, #374151)',
    borderBottom: '1px solid var(--border, #e5e7eb)',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 2,
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--border, #f3f4f6)',
    verticalAlign: 'middle',
  },
  wordCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  arabicText: {
    fontFamily: 'var(--font-arabic, "Scheherazade New", serif)',
    fontSize: 18,
    direction: 'rtl',
    color: 'var(--emerald, #059669)',
    fontWeight: 700,
  },
  ruleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 4,
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
  },
  scoreBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    border: '1px solid var(--border, #d1d5db)',
    background: 'var(--white, #fff)',
    display: 'inline-flex',
    alignItems: 'center',
    justify: 'center',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 14,
    transition: 'all 0.15s ease',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justify: 'space-between',
    paddingTop: 12,
    borderTop: '1px solid var(--border, #e5e7eb)',
  },
};

export default function HomeworkGridModal({
  open,
  onClose,
  assignment,
  classId,
  readOnly = false,
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const assignmentId = assignment?.id;

  const [marksState, setMarksState] = useState(new Map());

  const { data: gridData, isLoading, refetch } = useQuery({
    queryKey: ['homework-grid', assignmentId, classId],
    queryFn: () => getHomeworkGridSheet(assignmentId, classId),
    enabled: !!assignmentId && open,
    staleTime: 0,
  });

  const isPublished = gridData?.assignment?.is_published ?? assignment?.is_published;
  const isPreviewMode = !isPublished || !classId;
  const contents = gridData?.contents || [];
  const students = gridData?.students || [];
  const calculatedMaxMarks = gridData?.calculated_max_marks || assignment?.total_marks || 0;



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
            maxMarks: wordMax,
          });
        });
      }
    });
    return rows;
  }, [contents]);
  
  // Sync saved marks into state
  useEffect(() => {
    if (!gridData?.marks) return;
    const map = new Map();
    gridData.marks.forEach((m) => {
      const key = `${m.student_id}_${m.word_id}_${m.subtopic_id || 'default'}`;
      map.set(key, m.marks_awarded);
    });
    setMarksState(map);
  }, [gridData]);

  // Handle cell score toggle/input
  const handleScoreChange = (studentId, wordId, subtopicId, newScore) => {
    const key = `${studentId}_${wordId}_${subtopicId || 'default'}`;
    setMarksState((prev) => {
      const next = new Map(prev);
      next.set(key, Math.max(0, newScore));
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
        const key = `${s.student_id}_${r.wordId}_${subId || 'default'}`;
        sum += marksState.get(key) || 0;
      });
      totals.set(s.student_id, sum);
    });
    return totals;
  }, [students, flattenedRows, marksState]);

  // Save Mutation
  // const saveMut = useMutation({
  //   mutationFn: () => {
  //     const marksPayload = [];
  //     students.forEach((s) => {
  //       flattenedRows.forEach((r) => {
  //         const subId = r.rules?.[0]?.subtopic_id || null;
  //         const key = `${s.student_id}_${r.wordId}_${subId || 'default'}`;
  //         const awarded = marksState.get(key);
  //         if (awarded !== undefined && awarded !== null) {
  //           marksPayload.push({
  //             student_id: s.student_id,
  //             word_id: r.wordId,
  //             subtopic_id: subId,
  //             marks_awarded: awarded,
  //           });
  //         }
  //       });
  //     });
  //     return saveHomeworkGridMarks(assignmentId, classId, marksPayload);
  //   },
  //   onSuccess: () => {
  //     toast.success('Homework marks saved successfully!');
  //     queryClient.invalidateQueries(['homework-grid', assignmentId, classId]);
  //     refetch();
  //   },
  //   onError: (err) => {
  //     toast.error(err?.response?.data?.message || 'Failed to save homework marks.');
  //   },
  // });

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Homework Grid Sheet ${isPreviewMode ? '(Preview Mode)' : '(Evaluation)'}`}
      size="xl"
    >
      <div style={S.wrap}>
        {/* Header Summary */}
        <div style={S.headerCard}>
          <div style={S.metaGroup}>
            <div style={S.title}>
              {assignment?.title || 'Homework Assignment'}
            </div>
            <div style={S.subTitle}>
              Due Date: {assignment?.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'Unscheduled'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge variant={isPublished ? 'green' : 'amber'}>
              {isPublished ? 'Published' : 'Draft Preview'}
            </Badge>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--emerald, #059669)', background: '#ecfdf5', padding: '6px 12px', borderRadius: 20, border: '1px solid #a7f3d0' }}>
              Max Score: {calculatedMaxMarks} Marks
            </div>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
            <LoadingSpinner size={32} />
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
                  <th style={{ ...S.th, width: 60 }}>#</th>
                  <th style={S.th}>Content / Verse Word</th>
                  <th style={S.th}>Assessed Rule</th>
                  <th style={{ ...S.th, textAlign: 'center', width: 90 }}>Max Marks</th>

                  {/* Student Columns if live evaluation mode */}
                  {!isPreviewMode &&
                    students.map((s) => (
                      <th key={s.student_id} style={{ ...S.th, textAlign: 'center', minWidth: 110 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{s.full_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--emerald)', fontWeight: 600 }}>
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
                      <td style={{ ...S.td, color: 'var(--ink-pale)', fontSize: 12 }}>{idx + 1}</td>

                      {/* Word & Arabic Text */}
                      <td style={S.td}>
                        <div style={S.wordCell}>
                          <span style={S.arabicText}>{row.wordText}</span>
                          <span style={{ fontSize: 11, color: 'var(--ink-pale)' }}>
                            {row.contentTitle} {row.translation ? `— ${row.translation}` : ''}
                          </span>
                        </div>
                      </td>

                      {/* Rules */}
                      <td style={S.td}>
                        {row.rules.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {row.rules.map((r, rIdx) => (
                              <span key={rIdx} style={S.ruleBadge}>
                                {r.rule_name || r.subtopic_name || 'Rule'} ({r.marks_per_rule || 1}m)
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--ink-pale)', fontStyle: 'italic' }}>
                            Standard Word Recitation
                          </span>
                        )}
                      </td>

                      {/* Max Marks */}
                      <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: 'var(--ink)' }}>
                        {row.maxMarks}
                      </td>

                      {/* Student Evaluation Cells
                      {!isPreviewMode &&
                        students.map((stu) => {
                          const key = `${stu.student_id}_${row.wordId}_${subId || 'default'}`;
                          const currentVal = marksState.get(key) ?? 0;

                          if (readOnly) {
                            return (
                              <td key={stu.student_id} style={{ ...S.td, textAlign: 'center', fontWeight: 700 }}>
                                <span style={{ color: currentVal > 0 ? 'var(--emerald)' : 'var(--ink-pale)' }}>
                                  {currentVal} / {row.maxMarks}
                                </span>
                              </td>
                            );
                          }

                          return (
                            <td key={stu.student_id} style={{ ...S.td, textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  style={S.scoreBtn}
                                  disabled={saveMut.isPending}
                                  onClick={() => handleScoreChange(stu.student_id, row.wordId, subId, currentVal - 1)}
                                >
                                  -
                                </button>
                                <span style={{ fontWeight: 700, fontSize: 14, minWidth: 20 }}>
                                  {currentVal}
                                </span>
                                <button
                                  type="button"
                                  style={{ ...S.scoreBtn, color: 'var(--emerald, #059669)', borderColor: '#a7f3d0' }}
                                  disabled={saveMut.isPending}
                                  onClick={() => handleScoreChange(stu.student_id, row.wordId, subId, Math.min(row.maxMarks, currentVal + 1))}
                                >
                                  +
                                </button>
                              </div>
                            </td>
                          );
                        })} 
                         
                         */}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div style={S.footer}>
          <div style={{ fontSize: 12, color: 'var(--ink-pale)' }}>
            {isPreviewMode
              ? 'Preview Mode: Publish this assignment to evaluate student submissions.'
              : `Evaluated for ${students.length} enrolled students.`}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="outline" onClick={onClose} 
            // disabled={saveMut.isPending}
            >
              Close
            </Button>
          {/*   {!isPreviewMode && !readOnly && (
              <Button
                variant="primary"
                onClick={() => saveMut.mutate()}
                isLoading={saveMut.isPending}
              >
                 Save Homework Marks
              </Button>
            )} */}
          </div>
        </div>
      </div>
    </Modal>
  );
}
