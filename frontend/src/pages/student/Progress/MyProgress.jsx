import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import MetricCard from '../../../components/MetricCard';
import ProgressBar from '../../../components/ProgressBar';
import Badge from '../../../components/Badge';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import { useStudentProgress } from '../../../hooks/useProgress';
import { getStudentEnrollments } from '../../../api/enrollments';
import { getClasses } from '../../../api/classes';
import { formatTimeShort } from '../../../utils/classSessions';



// ── Main ──────────────────────────────────────────────────────────────────────
export default function MyProgress() {
  const { user } = useAuth();
  const from = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  // 1. Check Enrollments
  const { data: enrollmentsData, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['my-enrollments'],
    queryFn: () => getStudentEnrollments(user.id),
    enabled: !!user?.id,
  });

  const enrollments = enrollmentsData?.data ?? enrollmentsData ?? [];
  const activeEnrollments = enrollments.filter(e => e.status === 'active');
  const isUnenrolled = !enrollmentsLoading && activeEnrollments.length === 0;
  const enrolledClassIds = new Set(activeEnrollments.map(e => e.class_id));

  // 2. Fetch Center Classes (for unenrolled view)
  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ['center-classes', user?.center_id],
    queryFn: () => getClasses(user.center_id, { is_active: true }),
    enabled: !!user?.center_id,
  });

  // 3. Fetch Class Details for all active enrollments to get session plans & attendance
  const [classDetails, setClassDetails] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    if (activeEnrollments.length === 0) return;
    
    setDetailsLoading(true);
    const fetchPromises = activeEnrollments.map(enr => 
      import('../../../api/classes').then(m => m.getStudentClassDetail(enr.class_id))
    );
    
    Promise.all(fetchPromises)
      .then(results => {
        setClassDetails(results);
        setDetailsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load class details for progress', err);
        setDetailsLoading(false);
      });
  }, [activeEnrollments.length]);

  const availableClasses = classesData?.data ?? classesData ?? [];

  const renderAvailableClasses = () => (
    <div style={{ marginTop: isUnenrolled ? 0 : 40 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Available Classes at Your Center</h3>
      {availableClasses.length === 0 ? (
        <EmptyState icon="🏫" title="No active classes" description="There are currently no active classes at this center." />
      ) : (
        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))' }}>
          {availableClasses.map(cls => {
            const isMyClass = enrolledClassIds.has(cls.id);
            const scheduleDaysArray = cls.schedule_days ? cls.schedule_days.split(',').map(d => d.trim()).filter(Boolean) : [];
            
            return (
              <div key={cls.id} style={{
                background: isMyClass ? 'var(--emerald-light)' : 'var(--white)',
                border: isMyClass ? '1px solid var(--emerald)' : '1px solid var(--sand-mid)',
                borderRadius: 'var(--radius-lg)',
                padding: 24,
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 18, color: 'var(--ink)', marginBottom: 4, lineHeight: 1.3 }}>{cls.course_name}</div>
                    {cls.course_name_ur && <div style={{ fontSize: 15, color: 'var(--ink-soft)', fontFamily: 'var(--font-display)', direction: 'rtl' }}>{cls.course_name_ur}</div>}
                  </div>
                  {isMyClass && <Badge variant="green" style={{ whiteSpace: 'nowrap' }}>Enrolled</Badge>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, color: 'var(--ink-mid)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--sand)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--ink-soft)' }}>Classroom</span>
                    <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{cls.name}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--sand)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--ink-soft)' }}>Course Type</span>
                    <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{cls.course_type || '—'}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--sand)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--ink-soft)' }}>Schedule</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                      {scheduleDaysArray.length > 0 ? scheduleDaysArray.map(day => (
                        <span key={day} style={{ background: 'var(--blue-light)', color: 'var(--blue-deep)', padding: '2px 8px', borderRadius: '4px', fontSize: 12, fontWeight: 600 }}>
                          {day.substring(0, 3)}
                        </span>
                      )) : <span>—</span>}
                      {cls.start_time && <span style={{ marginLeft: 4, color: 'var(--ink-mid)' }}>at {formatTimeShort(cls.start_time)}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--ink-soft)' }}>Starting From</span>
                    <span style={{ fontWeight: 500 }}>{cls.start_date ? new Date(cls.start_date).toDateString() : '—'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (enrollmentsLoading || classesLoading || detailsLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>;
  }

  // ── UNENROLLED VIEW ──
  if (isUnenrolled) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 24 }}>
        <div style={{ background: 'var(--blue-light)', border: '1px solid var(--blue)', borderRadius: 'var(--radius-lg)', padding: '24px 32px', marginBottom: 32, textAlign: 'center' }}>
          <h2 style={{ fontSize: 24, color: 'var(--ink)', marginBottom: 12 }}>Welcome to Quran Foundation!</h2>
          <p style={{ fontSize: 15, color: 'var(--ink-mid)', lineHeight: 1.6, maxWidth: 600, margin: '0 auto' }}>
            Your account has been created successfully. To complete your enrollment, please visit your local center physically to confirm your details and submit the course fee.
          </p>
        </div>
        {renderAvailableClasses()}
      </div>
    );
  }

  // ── ENROLLED PROGRESS VIEW ──
  // Aggregate data from all enrolled classes
  const allAttendedSessions = [];
  let topicsCoveredCount = 0;
  let totalPresent = 0;
  let totalSessions = 0;

  const topicProgressByClass = []; // Will store { class_name, topics: [...] }

  classDetails.forEach(cd => {
    const clsName = cd.class.name;
    const sp = cd.sessionPlans || [];
    
    // Attended sessions (where attendance is marked)
    const attended = sp.filter(s => s.attendance != null);
    
    // Add to total session history
    attended.forEach(s => {
      allAttendedSessions.push({
        id: s.id,
        class_name: clsName,
        session_date: s.session_date,
        topic_title: s.topic_title,
        topic_title_ur: s.topic_title_ur,
        status: s.attendance.status,
        note_ur: s.attendance.note_ur
      });
    });

    // Unique topics covered in this class
    const coveredTopicIds = new Set(attended.filter(s => s.topic_id != null).map(s => s.topic_id));
    topicsCoveredCount += coveredTopicIds.size;

    // Track for Topic Progress bar
    const classTopics = new Map();
    sp.forEach(s => {
      if (!s.topic_id) return;
      if (!classTopics.has(s.topic_id)) {
        classTopics.set(s.topic_id, {
          id: s.topic_id,
          title: s.topic_title,
          title_ur: s.topic_title_ur,
          total_sessions: 0,
          attended_sessions: 0
        });
      }
      const t = classTopics.get(s.topic_id);
      t.total_sessions++;
      if (s.attendance != null) t.attended_sessions++;
    });

    if (classTopics.size > 0) {
      topicProgressByClass.push({
        class_name: clsName,
        topics: Array.from(classTopics.values())
      });
    }

    // Attendance stats
    if (cd.attendanceSummary) {
      totalSessions += cd.attendanceSummary.total;
      totalPresent += cd.attendanceSummary.present;
    }
  });

  allAttendedSessions.sort((a, b) => b.session_date.localeCompare(a.session_date));
  const attendancePct = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : null;

  const thStyle = { textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' };

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
          My Progress
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Across all enrolled classrooms</p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <MetricCard label="Topics covered" value={topicsCoveredCount} variant="green" />
        <MetricCard label="Attendance" value={attendancePct != null ? `${attendancePct}%` : '—'} sub="Year to date" variant="blue" />
        <MetricCard label="Homework avg." value={'—'} sub="Dummy data" variant={'neutral'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start', marginBottom: 20 }}>
        {/* Topic progress */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 14 }}>
            Topic Progress
          </div>
          {topicProgressByClass.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-pale)', textAlign: 'center', padding: '20px 0' }}>No topics logged yet.</p>
          ) : (
            topicProgressByClass.map(group => (
              <div key={group.class_name} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 12, letterSpacing: '0.05em' }}>
                  {group.class_name}
                </div>
                {group.topics.map(t => {
                  const pct = Math.round((t.attended_sessions / t.total_sessions) * 100);
                  const variant = pct >= 80 ? 'green' : pct >= 40 ? 'gold' : 'neutral';
                  return (
                    <div key={t.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ minWidth: 140, fontSize: 13, color: 'var(--ink-soft)' }}>
                          {t.title_ur ? <span style={{ fontFamily: 'var(--font-display)', direction: 'rtl' }}>{t.title_ur}</span> : t.title}
                        </span>
                        <div style={{ flex: 1 }}>
                          <ProgressBar value={pct} variant={variant} height={6} />
                        </div>
                        <span style={{ minWidth: 36, textAlign: 'right', fontSize: 12, fontWeight: 600, color: pct >= 80 ? 'var(--emerald)' : pct >= 40 ? 'var(--amber)' : 'var(--ink-pale)' }}>
                          {pct}%
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-pale)', marginTop: 4 }}>
                        {t.attended_sessions} of {t.total_sessions} sessions covered
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Session history */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--sand-mid)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            Attended Session History ({allAttendedSessions.length})
          </div>
          {allAttendedSessions.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', fontSize: 13, color: 'var(--ink-pale)' }}>No sessions attended yet.</div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 600 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Classroom</th>
                    <th style={thStyle}>Topic</th>
                    <th style={thStyle}>Attendance</th>
                    <th style={thStyle}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {allAttendedSessions.map((s, i) => {
                    const isLast = i === allAttendedSessions.length - 1;
                    const tdStyle = { padding: '10px 14px', fontSize: 13, color: 'var(--ink-mid)', borderBottom: isLast ? 'none' : '1px solid var(--sand)', verticalAlign: 'middle' };
                    return (
                      <tr key={s.id + '-' + i} style={{ cursor: 'default' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--sand)'} onMouseLeave={(e) => e.currentTarget.style.background = ''}>
                        <td style={tdStyle}>{new Date(s.session_date).toLocaleDateString()}</td>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{s.class_name}</td>
                        <td style={{ ...tdStyle, fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right' }}>
                          {s.topic_title_ur || s.topic_title || '—'}
                        </td>
                        <td style={tdStyle}>
                          <Badge variant={s.status === 'present' ? 'green' : s.status === 'late' ? 'gold' : 'red'}>{s.status}</Badge>
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', fontSize: 12, color: 'var(--ink-soft)' }}>
                          {s.note_ur ?? ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {renderAvailableClasses()}
    </>
  );
}
