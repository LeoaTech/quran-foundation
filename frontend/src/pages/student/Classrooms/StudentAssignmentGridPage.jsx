import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { getHomeworkGridSheet } from '../../../api/homework';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import AudioPlayer from '../../../components/AudioPlayer';
import AudioRecorder from '../../../components/AudioRecorder';
import Button from '../../../components/Button';
import Modal from '../../../components/Modal';
import { MicIcon, ClockIcon, CheckIcon, EditIcon, LockIcon, RefreshIcon, BookIcon, TrashIcon } from '../../../components/Icons';
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
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showReplaceRecorder, setShowReplaceRecorder] = useState(false);
  const [hasUnsavedAudio, setHasUnsavedAudio] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingTargetUrl, setPendingTargetUrl] = useState(null);

  const audioRecorderRef = useRef(null);

  const { data: gridData, isLoading, refetch } = useQuery({
    queryKey: ['homework-grid', assignmentId, classId],
    queryFn: () => getHomeworkGridSheet(assignmentId, classId),
    enabled: !!assignmentId,
  });

  const assignment = gridData?.assignment;
  const contents = gridData?.contents || [];
  const calculatedMaxMarks = gridData?.calculated_max_marks || assignment?.total_marks || 0;

  // Check if assignment due date has passed
  const isDueDatePassed = useMemo(() => {
    if (!assignment?.due_date) return false;
    const clean = String(assignment.due_date).split('T')[0];
    const due = new Date(clean + 'T23:59:59');
    return new Date() > due;
  }, [assignment?.due_date]);

  // Handle beforeunload to warn user when navigating away or refreshing tab
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedAudio) {
        e.preventDefault();
        e.returnValue = 'You have an unsaved voice recording. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedAudio]);

  // Intercept in-app navigation when unsaved audio exists
  const handleLeavePageAttempt = (targetUrl) => {
    if (hasUnsavedAudio) {
      setPendingTargetUrl(targetUrl);
      setShowUnsavedModal(true);
    } else {
      navigate(targetUrl);
    }
  };

  // Discard recording & leave page
  const handleConfirmDiscardAndLeave = () => {
    if (audioRecorderRef.current?.discardAudio) {
      audioRecorderRef.current.discardAudio();
    }
    setHasUnsavedAudio(false);
    setShowUnsavedModal(false);
    if (pendingTargetUrl) {
      navigate(pendingTargetUrl);
    }
  };

  // Submit audio & leave page
  const handleConfirmSubmitAndLeave = async () => {
    setShowUnsavedModal(false);
    if (audioRecorderRef.current?.performUploadImmediately) {
      try {
        await audioRecorderRef.current.performUploadImmediately();
        setHasUnsavedAudio(false);
        if (pendingTargetUrl) {
          navigate(pendingTargetUrl);
        }
      } catch (err) {
        console.error('Submit & Leave failed:', err);
      }
    } else if (audioRecorderRef.current?.submitAudio) {
      audioRecorderRef.current.submitAudio();
    }
  };

  // Find logged-in student's submission & marks
  const studentSubmission = useMemo(() => {
    if (!gridData?.submissions || !user?.id) return null;
    return gridData.submissions.find((s) => String(s.student_id) === String(user.id)) || null;
  }, [gridData?.submissions, user?.id]);

  const teacherRemarks = studentSubmission?.teacher_note;
  const submittedAudioUrl = studentSubmission?.audio_url;
  const submittedAudioDuration = studentSubmission?.audio_duration;

  const handleAudioSuccess = () => {
    setHasUnsavedAudio(false);
    setShowReplaceRecorder(false);
    queryClient.invalidateQueries(['homework-grid', assignmentId, classId]);
    refetch();
    if (pendingTargetUrl) {
      navigate(pendingTargetUrl);
      setPendingTargetUrl(null);
    }
  };

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

  const isEvaluated = studentSubmission?.status === 'evaluated';
  const isSubmissionDisabled = isEvaluated || isDueDatePassed;

  return (
    <div style={S.wrap}>
      {/* Navigation */}
      <button
        type="button"
        onClick={() => handleLeavePageAttempt(`/student/classrooms/${classId}`)}
        style={S.backLink}
      >
        ← Back to Classroom Homework
      </button>

      {/* Header Card */}
      <div style={S.headerCard}>
        <div style={S.metaGroup}>
          <h1 style={S.title}>{assignment?.title || 'Homework Assignment Sheet'}</h1>
          <div style={S.subTitle}>
            Due Date: <strong>{safeFormatDate(assignment?.due_date)}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Submission Status Badge */}
          {submittedAudioUrl ? (
            <Badge variant="green">
              <MicIcon size={13} color="#047857" style={{ marginRight: 4 }} /> Audio Submitted
            </Badge>
          ) : (
            <Badge variant={isDueDatePassed ? "red" : "amber"}>
              <ClockIcon size={13} color={isDueDatePassed ? "#dc2626" : "#92400e"} style={{ marginRight: 4 }} />
              {isDueDatePassed ? "Due Date Passed" : "Pending Submission"}
            </Badge>
          )}

          {/* Grading Status Badge */}
          {isEvaluated ? (
            <Badge variant="green">
              <CheckIcon size={13} color="#047857" style={{ marginRight: 4 }} /> Graded & Evaluated
            </Badge>
          ) : (
            <Badge variant="sand">
              <EditIcon size={13} color="#92400e" style={{ marginRight: 4 }} /> Pending Evaluation
            </Badge>
          )}

          {/* Show Obtained Score ONLY if Evaluated */}
          {isEvaluated && (
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
          )}
        </div>
      </div>

      {/* Due Date Passed Warning Banner */}
      {isDueDatePassed && !isEvaluated && (
        <div
          style={{
            background: 'linear-gradient(135deg, #fffbe6 0%, #fefce8 100%)',
            border: '1px solid #fde68a',
            borderRadius: 10,
            padding: '14px 18px',
            fontSize: 13,
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <LockIcon size={20} color="#b45309" style={{ flexShrink: 0 }} />
          <div>
            <strong>Assignment Submission Locked:</strong> The due date for this assignment ({safeFormatDate(assignment?.due_date)}) has passed. Audio recording and submissions are closed so your teacher can evaluate your homework.
          </div>
        </div>
      )}

      {/* Student Audio Submission Section */}
      <div
        style={{
          position: 'sticky',
          top: 70,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: '#ffffff',
          padding: 16,
          borderRadius: 16,
          border: '1px solid #a7f3d0',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MicIcon size={16} color="#047857" /> Recitation Audio Recorder & Player
          </div>
          <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Max Duration: 3 Minutes</span>
        </div>

        {isEvaluated ? (
          // Read-Only mode after Teacher Evaluation
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {submittedAudioUrl && (
              <AudioPlayer
                src={submittedAudioUrl}
                title="Your Submitted Recitation Audio"
                duration={submittedAudioDuration}
              />
            )}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 16px',
                fontSize: 13,
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <LockIcon size={16} color="#047857" />
              <span>
                <strong>Assignment Evaluated:</strong> This assignment has been graded by your teacher. Audio recording and resubmission are closed.
              </span>
            </div>
          </div>
        ) : (
          // Active / Editable Submission Mode
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {submittedAudioUrl && !showReplaceRecorder ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <AudioPlayer
                  src={submittedAudioUrl}
                  title="Your Submitted Audio (Pending Evaluation)"
                  duration={submittedAudioDuration}
                />
                {!isDueDatePassed && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setShowReplaceRecorder(true)}
                      style={{
                        background: 'none',
                        border: '1px solid var(--emerald, #059669)',
                        color: 'var(--emerald, #059669)',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-md, 8px)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <RefreshIcon size={14} color="var(--emerald, #059669)" /> Replace / Re-record Audio Submission
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {submittedAudioUrl && showReplaceRecorder && (
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setShowReplaceRecorder(false)}
                      style={{
                        background: 'none',
                        border: '1px solid var(--ink-soft)',
                        color: 'var(--ink-soft)',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel Replace
                    </button>
                  </div>
                )}
                <AudioRecorder
                  ref={audioRecorderRef}
                  assignmentId={assignmentId}
                  classId={classId}
                  disabled={isSubmissionDisabled}
                  onUnsavedAudioChange={(hasUnsaved) => setHasUnsavedAudio(hasUnsaved)}
                  onUploadSuccess={handleAudioSuccess}
                  currentAudioUrl={submittedAudioUrl}
                  currentAudioDuration={submittedAudioDuration}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Teacher Remarks Card */}
      {teacherRemarks && teacherRemarks !== 'Evaluated via Homework Sheet' && (
        <div style={S.remarksBanner}>
          <div style={{ ...S.remarksHeader, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookIcon size={18} color="#047857" /> Teacher Remarks & Evaluation Notes
          </div>
          <div style={S.remarksBody}>{teacherRemarks}</div>
        </div>
      )}

      {/* Assignment Words Table */}
      {flattenedRows.length === 0 ? (
        <EmptyState
          title="No Assignment Content"
          message="No words or reading items are linked to this homework assignment yet."
        />
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: 60 }}>#</th>
                <th style={S.th}>Assignment Word / Content</th>
                <th style={S.th}>Tajweed Rules</th>
                <th style={{ ...S.th, width: 130 }}>Max Marks</th>
                {isEvaluated && <th style={{ ...S.th, width: 140 }}>Obtained Score</th>}
              </tr>
            </thead>
            <tbody>
              {flattenedRows.map((row, idx) => {
                const subId = row.rules?.[0]?.subtopic_id || null;
                const keyWithSub = `${row.wordId}_${subId || 'default'}`;
                const keyWordOnly = `${row.wordId}`;
                const obtainedMark = studentMarksMap.get(keyWithSub) ?? studentMarksMap.get(keyWordOnly);

                return (
                  <tr key={`${row.wordId}-${idx}`}>
                    <td style={{ ...S.td, fontWeight: 600, color: 'var(--ink-soft)' }}>{idx + 1}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={S.arabicText}>{row.wordText}</div>
                        {row.translation && (
                          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{row.translation}</div>
                        )}
                        <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                          Source: {row.contentTitle}
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>
                      {row.rules.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {row.rules.map((rule, rIdx) => (
                            <span key={rIdx} style={S.ruleBadge}>
                              {rule.rule_name || rule.rule_code || 'Tajweed Rule'} ({rule.marks_per_rule || 1}m)
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>—</span>
                      )}
                    </td>
                    <td style={{ ...S.td, fontWeight: 700, color: 'var(--ink)' }}>{row.maxMarks}</td>
                    {isEvaluated && (
                      <td style={S.td}>
                        {obtainedMark !== undefined && obtainedMark !== null ? (
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: Number(obtainedMark) === row.maxMarks ? '#047857' : '#b45309',
                              background: Number(obtainedMark) === row.maxMarks ? '#ecfdf5' : '#fffbe6',
                              padding: '4px 10px',
                              borderRadius: 12,
                              border: `1px solid ${Number(obtainedMark) === row.maxMarks ? '#a7f3d0' : '#fde68a'}`,
                            }}
                          >
                            {obtainedMark} / {row.maxMarks}
                          </span>
                        ) : (
                          <span style={{ fontSize: 13, color: '#94a3b8' }}>0 / {row.maxMarks}</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Unsaved Changes Warning Modal */}
      <Modal
        open={showUnsavedModal}
        title="Unsaved Voice Recording"
        size="md"
        onClose={() => setShowUnsavedModal(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              background: '#fff7ed',
              border: '1px solid #ffedd5',
              borderRadius: 10,
              padding: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <ClockIcon size={24} color="#c2410c" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 14, color: '#9a3412', lineHeight: 1.5 }}>
              <strong>Unsaved Audio Recording Detected!</strong>
              <br />
              You have recorded or attached an audio recitation that has not been submitted yet. Leaving this page will lose your recording.
            </div>
          </div>

          <div style={{ fontSize: 13, color: 'var(--ink-soft, #64748b)' }}>
            Do you want to discard your recording or submit it before leaving?
          </div>

          <div
            style={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              gap: 12,
              paddingTop: 14,
              borderTop: '1px solid var(--sand-mid, #e2e8f0)',
            }}
          >
            <Button
              variant="outline"
              onClick={handleConfirmDiscardAndLeave}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#dc2626', borderColor: '#fca5a5' }}
            >
              <TrashIcon size={14} color="#dc2626" /> Discard & Leave
            </Button>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={() => setShowUnsavedModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmSubmitAndLeave}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <CheckIcon size={14} color="#ffffff" /> Submit & Leave
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
