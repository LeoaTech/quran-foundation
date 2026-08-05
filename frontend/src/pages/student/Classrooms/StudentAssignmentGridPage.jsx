import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { getHomeworkGridSheet } from '../../../api/homework';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import Badge from '../../../components/Badge';

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
  wrap: { display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200, margin: '0 auto', padding: '16px 0' },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--emerald, #059669)',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 14,
    width: 'fit-content',
  },
  headerCard: {
    background: 'var(--white, #ffffff)',
    border: '1px solid var(--sand-mid, #e2e8f0)',
    borderRadius: 'var(--radius-lg, 12px)',
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  metaGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  title: { fontSize: 22, fontWeight: 700, color: 'var(--ink, #0f172a)' },
  subTitle: { fontSize: 14, color: 'var(--ink-soft, #64748b)' },

  remarksBanner: {
    background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
    border: '1px solid #a7f3d0',
    borderRadius: 'var(--radius-md, 8px)',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  },
  remarksHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 700,
    color: '#047857',
  },
  remarksBody: {
    fontSize: 14,
    color: '#166534',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },

  tableWrap: {
    overflowX: 'auto',
    background: 'var(--white, #ffffff)',
    border: '1px solid var(--sand-mid, #e2e8f0)',
    borderRadius: 'var(--radius-lg, 12px)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 14,
    textAlign: 'left',
  },
  th: {
    background: 'var(--surface-2, #f8fafc)',
    padding: '14px 16px',
    fontWeight: 600,
    color: 'var(--ink, #334155)',
    borderBottom: '2px solid var(--sand-mid, #e2e8f0)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '14px 16px',
    borderBottom: '1px solid var(--sand-light, #f1f5f9)',
    verticalAlign: 'middle',
  },
  arabicText: {
    fontFamily: 'var(--font-arabic, "Scheherazade New", serif)',
    fontSize: 22,
    direction: 'rtl',
    color: 'var(--emerald, #059669)',
    fontWeight: 700,
  },
  ruleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 6,
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
    fontWeight: 500,
  },
};

export default function StudentAssignmentGridPage() {
  const { id: classId, assignmentId } = useParams();
  const { user } = useAuth();

  const { data: gridData, isLoading } = useQuery({
    queryKey: ['homework-grid', assignmentId, classId],
    queryFn: () => getHomeworkGridSheet(assignmentId, classId),
    enabled: !!assignmentId,
  });

  const assignment = gridData?.assignment;
  const contents = gridData?.contents || [];
  const calculatedMaxMarks = gridData?.calculated_max_marks || assignment?.total_marks || 0;

  // Find logged-in student's submission & marks
  const studentSubmission = useMemo(() => {
    if (!gridData?.submissions || !user?.id) return null;
    return gridData.submissions.find((s) => String(s.student_id) === String(user.id)) || null;
  }, [gridData?.submissions, user?.id]);

  const teacherRemarks = studentSubmission?.teacher_note;

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

  // Create Map of student's marks per word
  const studentMarksMap = useMemo(() => {
    const map = new Map();
    if (gridData?.marks && user?.id) {
      gridData.marks.forEach((m) => {
        if (String(m.student_id) === String(user.id)) {
          const keyWithSub = `${m.word_id}_${m.subtopic_id || 'default'}`;
          const keyWordOnly = `${m.word_id}`;
          map.set(keyWithSub, m.marks_awarded);
          map.set(keyWordOnly, m.marks_awarded);
        }
      });
    }
    return map;
  }, [gridData?.marks, user?.id]);

  // Total student score
  const totalStudentScore = useMemo(() => {
    if (studentSubmission?.marks_awarded !== null && studentSubmission?.marks_awarded !== undefined) {
      return studentSubmission.marks_awarded;
    }
    let sum = 0;
    flattenedRows.forEach((r) => {
      const subId = r.rules?.[0]?.subtopic_id || null;
      const keyWithSub = `${r.wordId}_${subId || 'default'}`;
      const keyWordOnly = `${r.wordId}`;
      const val = studentMarksMap.get(keyWithSub) ?? studentMarksMap.get(keyWordOnly);
      if (val !== undefined && val !== null) {
        sum += Number(val);
      }
    });
    return sum;
  }, [studentSubmission, flattenedRows, studentMarksMap]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <LoadingSpinner size={36} />
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      {/* Navigation */}
      <Link to={`/student/classrooms/${classId}`} style={S.backLink}>
        ← Back to Classroom Homework
      </Link>

      {/* Header Card */}
      <div style={S.headerCard}>
        <div style={S.metaGroup}>
          <h1 style={S.title}>{assignment?.title || 'Homework Assignment Sheet'}</h1>
          <div style={S.subTitle}>
            Due Date: <strong>{safeFormatDate(assignment?.due_date)}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {studentSubmission ? (
            <Badge variant={studentSubmission.status === 'evaluated' ? 'green' : 'amber'}>
              {studentSubmission.status === 'evaluated' ? 'Marked' : 'In Progress'}
            </Badge>
          ) : (
            <Badge variant="gold">Not Marked Yet</Badge>
          )}

          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--emerald, #059669)',
              background: '#ecfdf5',
              padding: '8px 16px',
              borderRadius: 20,
              border: '1px solid #a7f3d0',
            }}
          >
            Obtained Score: {totalStudentScore} / {calculatedMaxMarks} Marks
          </div>
        </div>
      </div>

      {/* Teacher Remarks Card - On Top if available */}
      {teacherRemarks && teacherRemarks !== 'Evaluated via Homework Sheet' && (
        <div style={S.remarksBanner}>
          <div style={S.remarksHeader}>
            <span>📚</span> Teacher Remarks & Feedback
          </div>
          <div style={S.remarksBody}>{teacherRemarks}</div>
        </div>
      )}

      {/* Paper Sheet Table */}
      {contents.length === 0 ? (
        <EmptyState
          icon="📖"
          title="No Content Attached"
          description="No practice content items have been assigned to this homework sheet."
        />
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 50, textAlign: 'center' }}>#</th>
                <th style={{ ...S.th, minWidth: 220 }}>Verse / Word</th>
                <th style={{ ...S.th, minWidth: 180 }}>Assessed Rules</th>
                <th style={{ ...S.th, minWidth: 150 }}>Notes</th>
                <th style={{ ...S.th, textAlign: 'center', width: 110 }}>Max Marks</th>
                <th style={{ ...S.th, textAlign: 'center', width: 130 }}>Obtained Marks</th>
              </tr>
            </thead>
            <tbody>
              {flattenedRows.map((row, idx) => {
                const firstRule = row.rules?.[0];
                const subId = firstRule?.subtopic_id || null;
                const keyWithSub = `${row.wordId}_${subId || 'default'}`;
                const keyWordOnly = `${row.wordId}`;
                const obtainedVal = studentMarksMap.get(keyWithSub) ?? studentMarksMap.get(keyWordOnly);

                const isGraded = obtainedVal !== undefined && obtainedVal !== null;

                return (
                  <tr key={`${row.wordId}-${idx}`}>
                    <td style={{ ...S.td, color: 'var(--ink-soft)', fontSize: 13, textAlign: 'center', fontWeight: 600 }}>
                      {idx + 1}
                    </td>

                    {/* Word & Arabic Text */}
                    <td style={S.td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={S.arabicText}>{row.wordText}</span>
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500 }}>
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
                        <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
                          Standard Recitation
                        </span>
                      )}
                    </td>

                    <td style={{ ...S.td, color: 'var(--ink)', fontSize: 13 }}>
                      {row.comments}
                    </td>

                    {/* Max Marks */}
                    <td style={{ ...S.td, textAlign: 'center', fontWeight: 600, color: 'var(--ink-soft)', fontSize: 14 }}>
                      {row.maxMarks}
                    </td>

                    {/* Student Obtained Marks */}
                    <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>
                      {isGraded ? (
                        <span style={{ color: obtainedVal >= row.maxMarks ? 'var(--emerald, #059669)' : '#d97706' }}>
                          {obtainedVal} / {row.maxMarks}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
