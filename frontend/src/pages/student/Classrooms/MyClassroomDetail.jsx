import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getStudentClassDetail } from '../../../api/classes';
import LoadingSpinner from '../../../components/LoadingSpinner';
import Badge from '../../../components/Badge';
import EmptyState from '../../../components/EmptyState';

const STATUS_BADGE = {
  present: 'green',
  absent: 'red',
  late: 'gold',
};

const GRADE_VARIANTS = {
  excellent: 'green',
  verygood: 'blue',
  average: 'gold',
};

const GRADE_LABELS = {
  excellent: '🌞 Excellent',
  good: '👍Very Good',
  average: '👌 Good',
};

function getGradeBadge(gradeVal) {
  if (gradeVal === null || gradeVal === undefined || gradeVal === '') return null;
  const num = parseFloat(gradeVal);
  if (!isNaN(num)) {
    if (num >= 9) return { label: `🌞 Excellent (${num}/10)`, variant: 'green' };
    if (num >= 7) return { label: `🌟 Very Good (${num}/10)`, variant: 'blue' };
    if (num >= 5) return { label: `⭐ Good (${num}/10)`, variant: 'gold' };
    return { label: `🌙 Practice Required (${num}/10)`, variant: 'purple' };
  }
  const str = String(gradeVal).toLowerCase();
  if (str === 'excellent') return { label: '🌞 Excellent', variant: 'green' };
  if (str === 'verygood' || str === 'very good') return { label: '🌟 Very Good', variant: 'blue' };
  if (str === 'good') return { label: '⭐ Good', variant: 'gold' };
  return { label: `Grade: ${gradeVal}`, variant: 'sand' };
}

function safeFormatDate(dateStr) {
  if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return 'Unscheduled';
  try {
    const clean = String(dateStr).split('T')[0];
    const d = new Date(clean + 'T00:00:00');
    return isNaN(d.getTime()) ? 'Unscheduled' : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return 'Unscheduled';
  }
}

export default function MyClassroomDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSessionId, setExpandedSessionId] = useState(null);

  useEffect(() => {
    getStudentClassDetail(id)
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load class detail', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>;
  }

  if (!data) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Class not found or you are not enrolled.</div>;
  }

  const { class: cls, teachers, sessionPlans = [], attendanceSummary = {}, homeworkAssignments = [], classworkSummary = {} } = data;

  // Extract unique topics from session plans to show topic list
  const topicsMap = new Map();
  sessionPlans.forEach(sp => {
    if (sp.topic_id) {
      topicsMap.set(sp.topic_id, {
        id: sp.topic_id,
        title: sp.topic_title,
        title_ur: sp.topic_title_ur
      });
    }
  });
  const topicsList = Array.from(topicsMap.values());

  const TABS = [
    { id: 'overview', label: 'Overview & Teachers' },
    { id: 'topics', label: 'Topics' },
    { id: 'homework', label: 'Homework Assignments' },
    { id: 'sessions', label: 'Class Sessions & Classwork' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <Link to="/student/classrooms" style={{ color: 'var(--ink-soft)', textDecoration: 'none', fontSize: 24 }}>←</Link>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--ink)' }}>{cls.name}</h1>
          {cls.name_ur && <p style={{ color: 'var(--ink-soft)', fontFamily: 'var(--font-display)' }}>{cls.name_ur}</p>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--sand-mid)', marginBottom: 24, overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              color: activeTab === tab.id ? 'var(--emerald)' : 'var(--ink-soft)',
              borderBottom: activeTab === tab.id ? '2px solid var(--emerald)' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          <div style={{ background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Assigned Teachers</h3>
            {teachers.length === 0 ? (
              <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>No teachers assigned yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {teachers.map(t => (
                  <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--sand)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--sand-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'var(--ink-soft)' }}>
                      {t.full_name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{t.full_name}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                        {t.is_primary && <Badge variant="green">Primary</Badge>}
                        {t.topics_assigned && t.topics_assigned.length > 0 && (
                          <Badge variant="blue">Topics: {t.topics_assigned.join(', ')}</Badge>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Attendance Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16 }}>
              <div style={{ padding: 16, background: 'var(--sand)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>{attendanceSummary.total}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Sessions Completed</div>
              </div>
              <div style={{ padding: 16, background: 'var(--emerald-light)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--emerald)' }}>{attendanceSummary.present}</div>
                <div style={{ fontSize: 12, color: 'var(--emerald)', textTransform: 'uppercase' }}>Present</div>
              </div>
              <div style={{ padding: 16, background: 'var(--red-light)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--red)' }}>{attendanceSummary.absent}</div>
                <div style={{ fontSize: 12, color: 'var(--red)', textTransform: 'uppercase' }}>Absent</div>
              </div>
              <div style={{ padding: 16, background: 'var(--gold-light)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--amber)' }}>{attendanceSummary.late}</div>
                <div style={{ fontSize: 12, color: 'var(--amber)', textTransform: 'uppercase' }}>Late</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'topics' && (
        <div style={{ background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Topics Covered</h3>
          {topicsList.length === 0 ? (
            <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>No topics assigned to sessions yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
              {topicsList.map(topic => (
                <div key={topic.id} style={{ padding: 16, border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 15, color: 'var(--ink)' }}>{topic.title || 'Untitled Topic'}</h4>
                  {topic.title_ur && <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)', fontFamily: 'var(--font-display)', direction: 'rtl' }}>{topic.title_ur}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'homework' && (
        <div style={{ background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Course Homework Assignments</h3>
            <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500 }}>
              Total: {homeworkAssignments.length} Assignments
            </span>
          </div>

          {homeworkAssignments.length === 0 ? (
            <EmptyState
              icon=""
              title="No Homework Assignments"
              description="No homework assignments have been scheduled for this course level yet."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {homeworkAssignments.map((hw) => {
                const isAccessible = hw.status === 'Active' || hw.status === 'Past';
                const statusVariant = hw.status === 'Active' ? 'green' : hw.status === 'Past' ? 'neutral' : 'gold';
                const gradingVariant = hw.grading_status === 'Marked' ? 'green' : hw.grading_status === 'In-progress' ? 'amber' : 'sand';

                return (
                  <div
                    key={hw.id}
                    style={{
                      padding: 20,
                      border: '1px solid var(--sand-mid)',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--white)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{hw.title}</h4>
                          {hw.title_ur && (
                            <span style={{ fontSize: 14, color: 'var(--ink-soft)', fontFamily: 'var(--font-display)', direction: 'rtl' }}>
                              ({hw.title_ur})
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
                          Due Date: <strong>{safeFormatDate(hw.due_date)}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Badge variant={statusVariant}>Status: {hw.status}</Badge>
                        <Badge variant={gradingVariant}>Grading: {hw.grading_status}</Badge>
                      </div>
                    </div>

                    {/* Evaluated By (Teacher) & Remarks */}
                    {(hw.marked_by_teacher_name || (hw.teacher_note && hw.teacher_note !== 'Evaluated via Homework Sheet')) && (
                      <div
                        style={{
                          background: '#f8fafc',
                          borderLeft: '4px solid var(--emerald, #059669)',
                          padding: '12px 16px',
                          borderRadius: '0 8px 8px 0',
                          fontSize: 13,
                          color: 'var(--ink)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        {hw.marked_by_teacher_name && (
                          <div>
                            <strong style={{ color: 'var(--ink-soft, #64748b)', display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                              Evaluated By (Teacher)
                            </strong>
                            <div style={{ fontWeight: 600, color: 'var(--emerald, #059669)', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--emerald-light, #ecfdf5)', padding: '4px 10px', borderRadius: 'var(--radius-md)' }}>
                              <span>👤 {hw.marked_by_teacher_name}</span>
                              {hw.marked_by_teacher_name_ur && <span style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-soft)', fontWeight: 400 }}>({hw.marked_by_teacher_name_ur})</span>}
                            </div>
                          </div>
                        )}

                        {hw.teacher_note && hw.teacher_note !== 'Evaluated via Homework Sheet' && (
                          <div>
                            <strong style={{ color: 'var(--ink-soft, #64748b)', display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                              Teacher Remarks
                            </strong>
                            <div style={{ lineHeight: 1.5, color: '#334155' }}>{hw.teacher_note}</div>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--sand-light)' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                        {hw.marks_awarded !== null ? (
                          <>
                            Score: <span style={{ color: 'var(--emerald, #059669)', fontWeight: 700 }}>{hw.marks_awarded} / {hw.max_marks} Marks</span>
                          </>
                        ) : hw.max_marks > 0 ? (
                          <>
                            Total Score: <span style={{ color: 'var(--ink-soft)' }}>{hw.max_marks} Marks</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 13, color: 'var(--ink-soft, #94a3b8)', fontStyle: 'italic' }}>No marks assigned</span>
                        )}
                      </div>

                      <Link
                        to={`/student/classrooms/${id}/assignments/${hw.id}`}
                        style={{
                          padding: '8px 16px',
                          background: 'var(--emerald, #059669)',
                          color: '#ffffff',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 13,
                          fontWeight: 600,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        View Assignment Detail →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Top Classwork Performance Summary Bar */}
          <div style={{ background: 'var(--white)', padding: 20, borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Classwork Evaluation Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
              <div style={{ padding: '12px 16px', background: 'var(--emerald-light)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--emerald)' }}>{classworkSummary.excellent || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--emerald)', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>🌞 Excellent</div>
              </div>
              <div style={{ padding: '12px 16px', background: 'var(--blue-light)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--blue)' }}>{classworkSummary.good || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>🌟 Very Good</div>
              </div>
              <div style={{ padding: '12px 16px', background: 'var(--gold-light)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--amber)' }}>{classworkSummary.average || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>⭐ Good</div>
              </div>

              <div style={{ padding: '12px 16px', background: 'var(--sand-light)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{classworkSummary.totalEvaluated || 0} / {sessionPlans.length}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>Evaluated Sessions</div>
              </div>
            </div>
          </div>

          {/* Sessions List (New to Old) */}
          <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--sand-mid)', background: 'var(--sand)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                Class Sessions & Classwork Progress (New to Old)
              </h3>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500 }}>
                Total {sessionPlans.length} Session{sessionPlans.length !== 1 ? 's' : ''}
              </span>
            </div>

            {sessionPlans.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-soft)' }}>No session plans recorded for this classroom.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {sessionPlans.map((sp) => {
                  
                  const cw = sp.classwork;
                  const badgeInfo = cw ? getGradeBadge(cw.grade) : null;
                  const isExpanded = expandedSessionId === sp.id;

                  return (
                    <div
                      key={sp.id}
                      style={{
                        padding: '20px',
                        borderBottom: '1px solid var(--sand-light)',
                        background: isExpanded ? '#f8fafc' : 'transparent',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      {/* Session Header Bar */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{safeFormatDate(sp.session_date)}</span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
                            Session Plan: <strong>{sp.title || sp.syllabus_topic_title || 'Class Session'}</strong>
                            {sp.syllabus_topic_title_ur && (
                              <span style={{ fontFamily: 'var(--font-display)', marginLeft: 6, direction: 'rtl' }}>
                                ({sp.syllabus_topic_title_ur})
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {/* Attendance Status */}
                          {sp.attendance ? (
                            <Badge variant={STATUS_BADGE[sp.attendance.status] || 'sand'}>
                              Attendance: {sp.attendance.status.toUpperCase()}
                            </Badge>
                          ) : (
                            <Badge variant="sand">Attendance: Not Marked</Badge>
                          )}

                          {/* Classwork Grade */}
                          {cw && (
                            <Badge variant={badgeInfo?.variant || 'sand'} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px' }}>
                              Classwork: {badgeInfo ? badgeInfo.label : 'Evaluated'}
                            </Badge>
                          )}

                          {/* View Detail Button */}
                          <button
                            type="button"
                            onClick={() => setExpandedSessionId(isExpanded ? null : sp.id)}
                            style={{
                              padding: '6px 12px',
                              background: isExpanded ? 'var(--emerald, #059669)' : 'var(--white)',
                              color: isExpanded ? '#ffffff' : 'var(--emerald, #059669)',
                              border: '1px solid var(--emerald, #059669)',
                              borderRadius: 'var(--radius-md)',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              transition: 'all 0.2s ease',
                              boxShadow: isExpanded ? '0 2px 4px rgba(5,150,105,0.2)' : 'none',
                            }}
                          >
                            {isExpanded ? 'Hide Detail ▲' : 'View Detail ▼'}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Classwork Details Card */}
                      {isExpanded && (
                        <div
                          style={{
                            marginTop: 16,
                            padding: 18,
                            background: '#ffffff',
                            border: '1px solid var(--sand-mid, #cbd5e1)',
                            borderRadius: 'var(--radius-lg, 8px)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 14,
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink, #0f172a)', borderBottom: '1px solid var(--sand-light, #f1f5f9)', paddingBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Classwork & Session Detail</span>
                            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-soft, #64748b)' }}>{safeFormatDate(sp.session_date)}</span>
                          </div>

                          {/* 1.  Summary */}
                          <div style={{ fontSize: 13, color: 'var(--ink, #1e293b)' }}>
                            <strong style={{ color: 'var(--ink-soft, #64748b)', display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                              General Summary
                            </strong>
                            <div style={{ fontWeight: 500 }}>
                              {sp.title || sp.syllabus_topic_title || 'Regular Class Session'}
                              {sp.syllabus_topic_title_ur && (
                                <span style={{ fontFamily: 'var(--font-display)', marginLeft: 6, direction: 'rtl', color: 'var(--ink-soft)' }}>
                                  ({sp.syllabus_topic_title_ur})
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 2. Topic Name */}
                          <div style={{ fontSize: 13, color: 'var(--ink, #1e293b)' }}>
                            <strong style={{ color: 'var(--ink-soft, #64748b)', display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                              Topic Name
                            </strong>
                            {(cw?.topic_title || cw?.subtopic_title) ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f1f5f9', padding: '8px 14px', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--ink)' }}>
                                <span style={{ fontWeight: 600, color: 'var(--ink-soft)' }}> Practiced / Evaluated:</span>
                                <span style={{ fontWeight: 600 }}>{cw.topic_title || 'Topic'}</span>
                                {cw.topic_title_ur && <span style={{ color: 'var(--ink-soft)', fontFamily: 'var(--font-display)' }}>({cw.topic_title_ur})</span>}
                                {cw.subtopic_title && (
                                  <>
                                    <span style={{ color: 'var(--ink-soft)' }}>›</span>
                                    <span>{cw.subtopic_title}</span>
                                    {cw.subtopic_title_ur && <span style={{ color: 'var(--ink-soft)', fontFamily: 'var(--font-display)' }}>({cw.subtopic_title_ur})</span>}
                                  </>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
                                No specific subtopic evaluated for this session.
                              </span>
                            )}
                          </div>

                          {/* 3. Evaluated By (Teacher) */}
                          {cw?.teacher_name && (
                            <div style={{ fontSize: 13, color: 'var(--ink, #1e293b)' }}>
                              <strong style={{ color: 'var(--ink-soft, #64748b)', display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                                Evaluated By (Teacher)
                              </strong>
                              <div style={{ fontWeight: 600, color: 'var(--emerald, #059669)', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--emerald-light, #ecfdf5)', padding: '6px 12px', borderRadius: 'var(--radius-md)' }}>
                                <span>👤 {cw.teacher_name}</span>
                                {cw.teacher_name_ur && <span style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-soft)', fontWeight: 400 }}>({cw.teacher_name_ur})</span>}
                              </div>
                            </div>
                          )}

                          {/* 4. Remarks */}
                          <div>
                            <strong style={{ color: 'var(--ink-soft, #64748b)', display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                              Remarks
                            </strong>
                            {cw?.comments ? (
                              <div
                                style={{
                                  background: '#f8fafc',
                                  borderLeft: '4px solid var(--blue, #2563eb)',
                                  padding: '12px 16px',
                                  borderRadius: '0 8px 8px 0',
                                  fontSize: 13,
                                  color: 'var(--ink)',
                                }}
                              >
                                <div style={{ fontWeight: 700, color: 'var(--blue, #2563eb)', marginBottom: 4 }}>
                                  Teacher Classwork Remarks:
                                </div>
                                <div style={{ lineHeight: 1.5, color: '#334155' }}>{cw.comments}</div>
                              </div>
                            ) : (
                              <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
                                No teacher remarks recorded for this session.
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
