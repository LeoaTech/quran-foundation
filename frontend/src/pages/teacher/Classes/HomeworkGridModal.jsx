import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../hooks/useAuth';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import AudioPlayer from '../../../components/AudioPlayer';
import { getHomeworkGridSheet, saveHomeworkGridMarks, lockStudentForEvaluation } from '../../../api/homework';
import {
  UserIcon,
  MicIcon,
  LockIcon,
  ClockIcon,
  CheckIcon,
  BookIcon,
  EditIcon,
  PlayIcon,
  DownloadIcon,
  CloseIcon,
} from '../../../components/Icons';

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 20 },
  headerBanner: {
    background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
    border: '1px solid #a7f3d0',
    borderRadius: 'var(--radius-lg, 12px)',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
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
    background: '#ecfdf5',
    color: '#047857',
    border: '1px solid #a7f3d0',
    padding: '3px 8px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingTop: 16,
    borderTop: '1px solid var(--sand-mid)',
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
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [activeAudioStudent, setActiveAudioStudent] = useState(null);

  const { data: gridData, isLoading, refetch } = useQuery({
    queryKey: ['homework-grid', assignmentId, classId],
    queryFn: () => getHomeworkGridSheet(assignmentId, classId),
    enabled: !!assignmentId && (open || asPage || !!onBack),
    staleTime: 0,
  });

  const isPublished = gridData?.assignment?.is_published ?? assignment?.is_published;
  const isPreviewMode = !classId;
  const contents = gridData?.contents || [];
  const students = gridData?.students || [];
  const calculatedMaxMarks = gridData?.calculated_max_marks || assignment?.total_marks || 0;

  const evaluatorId = gridData?.evaluator_teacher_id || assignment?.marked_by_teacher_id;
  const evaluatorName = gridData?.evaluator_teacher_name || assignment?.marked_by_teacher_name;
  const isFullyMarked = gridData?.is_fully_marked ?? assignment?.is_fully_marked;

  const isTeacher = role === 'teacher' || (user?.roles && user.roles.includes('teacher'));
  const isUserEvaluator = !evaluatorId || (user && user.id === evaluatorId);
  const isLockedByOther = Boolean(isFullyMarked && evaluatorId && !isUserEvaluator);
  const effectiveReadOnly = readOnly || !isTeacher || isLockedByOther;

  // Search filtered student list
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return students;
    const q = studentSearchQuery.toLowerCase();
    return students.filter((s) => s.full_name.toLowerCase().includes(q));
  }, [students, studentSearchQuery]);

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
          comments: content?.notes || 'Standard Recitation',
        });
      } else {
        words.forEach((w) => {
          const rules = Array.isArray(w.rule_details) ? w.rule_details : [];
          let wordMaxMarks = 0;
          if (rules.length > 0) {
            for (const r of rules) {
              wordMaxMarks += (r.marks_per_rule ?? 1) * (r.occurrence_count ?? 1);
            }
          } else {
            wordMaxMarks = 1;
          }

          rows.push({
            contentId: content.id,
            contentTitle: content.title || `Surah ${content.surah_number}`,
            wordId: w.id,
            wordText: w.text_uthmani || w.word_text || '—',
            translation: w.translation || '',
            rules,
            maxMarks: wordMaxMarks,
            comments: w.teacher_notes || w.rules_summary || 'Standard Recitation',
          });
        });
      }
    });
    return rows;
  }, [contents]);

  // Sync loaded DB marks into local state
  useEffect(() => {
    if (!gridData) return;
    const initialMarks = new Map();
    const initialNotes = {};

    if (Array.isArray(gridData.marks)) {
      gridData.marks.forEach((m) => {
        const subId = m.subtopic_id || 'default';
        const key = `${m.student_id}_${m.word_id}_${subId}`;
        initialMarks.set(key, m.marks_obtained);
      });
    }

    if (Array.isArray(gridData.submissions)) {
      gridData.submissions.forEach((sub) => {
        if (sub.teacher_note) {
          initialNotes[sub.student_id] = sub.teacher_note;
        }
      });
    }

    setMarksState(initialMarks);
    setStudentNotes(initialNotes);
  }, [gridData]);

  // Default select first student if available
  useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0].student_id);
    }
  }, [students, selectedStudentId]);

  // Calculate per-student total marks
  const studentTotals = useMemo(() => {
    const totals = new Map();
    students.forEach((s) => {
      let sum = 0;
      flattenedRows.forEach((row) => {
        const firstRule = row.rules?.[0];
        const subId = firstRule?.subtopic_id || null;
        const keyWithSub = `${s.student_id}_${row.wordId}_${subId || 'default'}`;
        const keyWordOnly = `${s.student_id}_${row.wordId}`;
        const val = marksState.get(keyWithSub) ?? marksState.get(keyWordOnly) ?? 0;
        sum += Number(val) || 0;
      });
      totals.set(s.student_id, sum);
    });
    return totals;
  }, [students, flattenedRows, marksState]);

  // ── Summary Cards Calculations for Teachers & Center Managers ──────────────
  const totalStudentsCount = students.length;

  const submittedAudioCount = useMemo(() => {
    if (!gridData?.submissions) return 0;
    return students.filter((s) =>
      gridData.submissions.some((sub) => String(sub.student_id) === String(s.student_id) && sub.audio_url)
    ).length;
  }, [students, gridData?.submissions]);

  const notSubmittedCount = Math.max(0, totalStudentsCount - submittedAudioCount);

  const gradedCount = useMemo(() => {
    return students.filter((s) => {
      const sub = gridData?.submissions?.find((sub) => String(sub.student_id) === String(s.student_id));
      const score = studentTotals.get(s.student_id) || 0;
      return Boolean(sub?.is_marked || score > 0);
    }).length;
  }, [students, gridData?.submissions, studentTotals]);

  const pendingGradingCount = useMemo(() => {
    return students.filter((s) => {
      const sub = gridData?.submissions?.find((sub) => String(sub.student_id) === String(s.student_id));
      const score = studentTotals.get(s.student_id) || 0;
      const hasAudio = Boolean(sub?.audio_url);
      const isGraded = Boolean(sub?.is_marked || score > 0);
      return hasAudio && !isGraded;
    }).length;
  }, [students, gridData?.submissions, studentTotals]);

  const handleScoreChange = (studentId, wordId, subtopicId, newScore) => {
    if (effectiveReadOnly) return;
    const subId = subtopicId || 'default';
    const key = `${studentId}_${wordId}_${subId}`;

    setMarksState((prev) => {
      const next = new Map(prev);
      next.set(key, newScore);
      return next;
    });
  };

  // Handle student selection with concurrent lock check
  const handleSelectStudent = async (student, shouldAutoPlay = false) => {
    const studentSub = gridData?.submissions?.find((sub) => String(sub.student_id) === String(student.student_id));
    const currentUserId = user?.id;

    if (studentSub?.locked_by_teacher_id && String(studentSub.locked_by_teacher_id) !== String(currentUserId)) {
      toast.error(`${student.full_name} is currently being evaluated by ${studentSub.locked_by_teacher_name || 'another teacher'}.`);
      return;
    }

    try {
      if (classId && assignmentId && isTeacher) {
        await lockStudentForEvaluation(assignmentId, classId, student.student_id, 'lock');
      }
    } catch (err) {
      if (err?.response?.status === 409) {
        toast.error(err?.response?.data?.message || 'Student is currently locked by another teacher.');
        return;
      }
    }

    setSelectedStudentId(student.student_id);

    if (studentSub?.audio_url) {
      setActiveAudioStudent({
        studentId: student.student_id,
        studentName: student.full_name,
        audioUrl: studentSub.audio_url,
        duration: studentSub.audio_duration,
        autoPlay: shouldAutoPlay,
      });
    } else {
      setActiveAudioStudent(null);
    }
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payloadMarks = [];
      students.forEach((s) => {
        flattenedRows.forEach((row) => {
          const firstRule = row.rules?.[0];
          const subId = firstRule?.subtopic_id || null;
          const keyWithSub = `${s.student_id}_${row.wordId}_${subId || 'default'}`;
          const keyWordOnly = `${s.student_id}_${row.wordId}`;
          const val = marksState.get(keyWithSub) ?? marksState.get(keyWordOnly) ?? 0;

          payloadMarks.push({
            student_id: s.student_id,
            word_id: row.wordId,
            subtopic_id: subId,
            marks_obtained: Number(val) || 0,
            max_marks: row.maxMarks,
          });
        });
      });

      return saveHomeworkGridMarks(assignmentId, classId, payloadMarks, studentNotes);
    },
    onSuccess: () => {
      toast.success('Homework marks saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['homework-grid', assignmentId, classId] });
      refetch();
    },
    onError: (err) => {
      console.error('Failed to save homework marks:', err);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save homework marks.');
    },
  });

  const selectedStudent = students.find((s) => String(s.student_id) === String(selectedStudentId)) || students[0];
  const selectedSub = gridData?.submissions?.find((sub) => String(sub.student_id) === String(selectedStudentId));

  const bodyContent = (
    <div style={S.wrap}>
      {/* Header Banner */}
      <div style={S.headerBanner}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
            {gridData?.assignment?.title || assignment?.title || 'Homework Assignment Evaluation'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
            Total Sheet Score: <strong>{calculatedMaxMarks} Marks</strong> | Linked Content Items: <strong>{contents.length}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isPublished ? (
            <span style={{ fontSize: 12, fontWeight: 700, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '6px 12px', borderRadius: 20 }}>
              ● Published Assignment
            </span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 700, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '6px 12px', borderRadius: 20 }}>
              ○ Draft / Un-Published
            </span>
          )}

          {evaluatorName && (
            <span style={{ fontSize: 12, fontWeight: 600, background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '6px 12px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <UserIcon size={13} color="#0369a1" /> Evaluated By: {evaluatorName}
            </span>
          )}
        </div>
      </div>

      {/* ── Summary Cards Toolbar for Teachers & Center Managers ── */}
      {!isPreviewMode && students.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {/* Card 1: Audio Submitted */}
          <div style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: '#dcfce7', width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MicIcon size={22} color="#047857" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Audio Submitted</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#047857', lineHeight: 1.2 }}>
                {submittedAudioCount} <span style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>/ {totalStudentsCount}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Remaining Submissions */}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: '#fef3c7', width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ClockIcon size={22} color="#92400e" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Not Submitted Yet</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#92400e', lineHeight: 1.2 }}>
                {notSubmittedCount} <span style={{ fontSize: 13, fontWeight: 600, color: '#b45309' }}>/ {totalStudentsCount}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Graded Assignments */}
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: '#e0f2fe', width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckIcon size={22} color="#0369a1" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#075985', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Graded Assignments</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0369a1', lineHeight: 1.2 }}>
                {gradedCount} <span style={{ fontSize: 13, fontWeight: 600, color: '#0284c7' }}>/ {totalStudentsCount}</span>
              </div>
            </div>
          </div>

          {/* Card 4: Pending Evaluation */}
          <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: '#ffedd5', width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <EditIcon size={22} color="#c2410c" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Needs Grading</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#c2410c', lineHeight: 1.2 }}>
                {pendingGradingCount} <span style={{ fontSize: 13, fontWeight: 600, color: '#ea580c' }}>Pending</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Searchable Student Selection Toolbar */}
      {!isPreviewMode && students.length > 0 && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '16px 20px', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserIcon size={16} color="var(--emerald, #059669)" /> Select Student to Grade & Listen Audio:
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 300 }}>
              <input
                type="text"
                placeholder="Search student name..."
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 13,
                  border: '1px solid var(--sand-mid, #cbd5e1)',
                  borderRadius: 8,
                  outline: 'none',
                  background: '#ffffff',
                }}
              />
            </div>

            {/* Select Dropdown */}
            <select
              value={selectedStudentId || ''}
              onChange={(e) => {
                const matched = students.find((s) => String(s.student_id) === String(e.target.value));
                if (matched) handleSelectStudent(matched);
              }}
              style={{
                flex: '2 1 320px',
                padding: '8px 14px',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 8,
                border: '1.5px solid var(--emerald, #059669)',
                background: '#ffffff',
                color: 'var(--ink)',
                cursor: 'pointer',
              }}
            >
              {filteredStudents.map((s) => {
                const studentSub = gridData?.submissions?.find((sub) => String(sub.student_id) === String(s.student_id));
                const isLockedByOther = Boolean(
                  studentSub?.locked_by_teacher_id && String(studentSub.locked_by_teacher_id) !== String(user?.id)
                );
                const hasAudio = Boolean(studentSub?.audio_url);
                const score = studentTotals.get(s.student_id) || 0;

                return (
                  <option key={s.student_id} value={s.student_id} disabled={isLockedByOther}>
                    {s.full_name} {hasAudio ? ' [Audio Submitted]' : ' [No Audio]'} — Score: {score}/{calculatedMaxMarks} {isLockedByOther ? ` (Locked by ${studentSub.locked_by_teacher_name})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      )}

      {/* Grid Sheet Content Table */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <LoadingSpinner size={32} />
        </div>
      ) : flattenedRows.length === 0 ? (
        <EmptyState
          icon={<BookIcon size={36} color="var(--emerald)" />}
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

                {/* Column header for selected student */}
                {!isPreviewMode && selectedStudent && (
                  <th style={{ ...S.th, textAlign: 'center', minWidth: 200, background: '#f0fdf4' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#047857' }}>{selectedStudent.full_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--emerald)', fontWeight: 700, marginTop: 2 }}>
                      Obtained Score: {studentTotals.get(selectedStudent.student_id) || 0} / {calculatedMaxMarks}
                    </div>

                    {selectedSub?.audio_url ? (
                      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveAudioStudent({
                              studentId: selectedStudent.student_id,
                              studentName: selectedStudent.full_name,
                              audioUrl: selectedSub.audio_url,
                              duration: selectedSub.audio_duration,
                              autoPlay: true,
                            })
                          }
                          style={{
                            background: 'var(--emerald, #059669)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 20,
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            boxShadow: '0 2px 6px rgba(5,150,105,0.2)',
                          }}
                          title="Play Student Recitation Audio Immediately"
                        >
                          <PlayIcon size={12} color="#ffffff" /> Play
                        </button>

                        <a
                          href={selectedSub.audio_url}
                          download={`Audio_${selectedStudent.full_name.replace(/\s+/g, '_')}.webm`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            background: '#0284c7',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 20,
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            textDecoration: 'none',
                            boxShadow: '0 2px 6px rgba(2,132,199,0.2)',
                          }}
                          title="Download Audio File to Device"
                        >
                          <DownloadIcon size={12} color="#ffffff" /> Download
                        </a>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--ink-pale)', fontWeight: 500, marginTop: 6, fontStyle: 'italic' }}>
                        No Audio Submitted
                      </div>
                    )}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {flattenedRows.map((row, idx) => {
                const firstRule = row.rules?.[0];
                const subId = firstRule?.subtopic_id || null;

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

                    {/* Assessed Rules */}
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
                    <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: 'var(--emerald)', fontSize: 14 }}>
                      {row.maxMarks}
                    </td>

                    {/* Selected Student Evaluation Cell */}
                    {!isPreviewMode && selectedStudent && (() => {
                      const stuId = selectedStudent.student_id;
                      const keyWithSub = `${stuId}_${row.wordId}_${subId || 'default'}`;
                      const keyWordOnly = `${stuId}_${row.wordId}`;
                      const currentVal = marksState.get(keyWithSub) ?? marksState.get(keyWordOnly) ?? '';

                      if (effectiveReadOnly) {
                        return (
                          <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, fontSize: 14, background: '#f8fafc' }}>
                            <span style={{ color: currentVal > 0 ? 'var(--emerald)' : 'var(--ink-pale)' }}>
                              {currentVal || 0} / {row.maxMarks}
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td style={{ ...S.td, textAlign: 'center', background: '#f0fdf4' }}>
                          <input
                            type="number"
                            min={0}
                            max={row.maxMarks}
                            disabled={saveMut.isPending}
                            value={currentVal}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                              if (!isNaN(val)) {
                                handleScoreChange(stuId, row.wordId, subId, Math.min(row.maxMarks, Math.max(0, val)));
                              }
                            }}
                            onFocus={(e) => e.target.select()}
                            style={{
                              width: 68,
                              textAlign: 'center',
                              fontWeight: 700,
                              fontSize: 14,
                              padding: '6px 8px',
                              border: '1.5px solid var(--emerald, #059669)',
                              borderRadius: 6,
                              background: '#ffffff',
                              outline: 'none',
                              color: 'var(--ink, #111827)',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            }}
                          />
                        </td>
                      );
                    })()}
                  </tr>
                );
              })}

              {/* Overall Remarks / Feedback Row */}
              {!isPreviewMode && selectedStudent && (
                <tr style={{ background: '#f8fafc', borderTop: '2px solid var(--sand-mid)' }}>
                  <td colSpan={5} style={{ ...S.td, padding: '16px 20px', fontWeight: 600, color: 'var(--ink)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <EditIcon size={15} color="var(--emerald, #059669)" /> Remarks & Feedback for {selectedStudent.full_name}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 400 }}>
                        Explain mark deductions or provide specific Tajweed pronunciation advice for this student.
                      </span>
                    </div>
                  </td>
                  <td style={{ ...S.td, padding: '12px 14px', verticalAlign: 'top', background: '#f0fdf4' }}>
                    {effectiveReadOnly ? (
                      <div style={{ fontSize: 12, color: studentNotes[selectedStudent.student_id] ? 'var(--ink)' : 'var(--ink-soft)', fontStyle: studentNotes[selectedStudent.student_id] ? 'normal' : 'italic', whiteSpace: 'pre-wrap', minHeight: 40 }}>
                        {studentNotes[selectedStudent.student_id] || 'No remarks provided.'}
                      </div>
                    ) : (
                      <textarea
                        disabled={saveMut.isPending}
                        placeholder={`Add Tajweed feedback for ${selectedStudent.full_name}...`}
                        value={studentNotes[selectedStudent.student_id] || ''}
                        onChange={(e) => setStudentNotes((prev) => ({ ...prev, [selectedStudent.student_id]: e.target.value }))}
                        rows={3}
                        style={{
                          width: '100%',
                          minWidth: 160,
                          fontSize: 12,
                          padding: '8px 10px',
                          border: '1px solid var(--emerald, #059669)',
                          borderRadius: 6,
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          color: 'var(--ink, #111827)',
                          background: '#ffffff',
                          lineHeight: 1.4,
                        }}
                      />
                    )}
                  </td>
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
            : `Evaluating for ${students.length} enrolled students.`}
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
              Save All Homework Marks
            </Button>
          )}
        </div>
      </div>

      {/* Floating Bottom Audio Player Bar for Teachers & Center Managers */}
      {activeAudioStudent && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            width: '90%',
            maxWidth: 640,
            background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
            color: '#ffffff',
            borderRadius: 16,
            padding: '14px 20px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
            border: '1px solid #10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ecfdf5', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MicIcon size={15} color="#ecfdf5" /> Playing Student: <span style={{ color: '#fef08a', fontWeight: 800 }}>{activeAudioStudent.studentName}</span>
            </div>
            <AudioPlayer
              src={activeAudioStudent.audioUrl}
              duration={activeAudioStudent.duration}
              title=""
              compact
              allowDownload={true}
              autoPlay={activeAudioStudent.autoPlay ?? true}
            />
          </div>

          <button
            type="button"
            onClick={() => setActiveAudioStudent(null)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '50%',
              width: 32,
              height: 32,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              flexShrink: 0,
              transition: 'background 0.2s ease',
            }}
            title="Close Audio Player"
          >
            <CloseIcon size={16} color="#ffffff" />
          </button>
        </div>
      )}
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
      title={`Homework Evaluation Sheet ${isPreviewMode ? '(Preview)' : ''}`}
      size="xl"
    >
      {bodyContent}
    </Modal>
  );
}

export default function HomeworkGridModal(props) {
  return <HomeworkGridSheetView {...props} />;
}
