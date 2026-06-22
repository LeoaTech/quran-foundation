import { useAuth } from '../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { getClasses } from '../../api/classes';
import { getCenterTeacherTopics } from '../../api/teacherTopics';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import { projectClassSessions } from '../../utils/classSessions';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const centerId = user?.center_id;

  const { data: classesRaw = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['classes', centerId],
    queryFn: () => getClasses(centerId, { is_active: true }),
    staleTime: 60_000,
    enabled: !!centerId,
  });

  const { data: assignmentsRaw = [], isLoading: loadingTopics } = useQuery({
    queryKey: ['teacher-topics', centerId],
    queryFn: () => getCenterTeacherTopics(centerId),
    staleTime: 60_000,
    enabled: !!centerId,
  });

  const classes = classesRaw?.data ?? classesRaw ?? [];
  const assignments = assignmentsRaw?.data ?? assignmentsRaw ?? [];
  const myTopics = assignments.filter(a => String(a.teacher_user_id) === String(user.id));

  // Sum up enrolled students across classes
  const totalStudents = classes.reduce((sum, cls) => sum + (cls.enrolled_count || 0), 0);

  // Find Today's Class
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todaysClasses = classes.filter(cls => cls.schedule_days && cls.schedule_days.includes(todayName));
  const todaysClass = todaysClasses.length > 0 ? todaysClasses[0] : null;

  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate upcoming sessions by projecting schedules for the next 7 days
  const upcomingSessions = [];
  classes.forEach(cls => {
    if (!cls.schedules || !Array.isArray(cls.schedules)) return;
    const projected = projectClassSessions(cls, cls.schedules);
    const future = projected.filter(p => p.date >= todayStr).slice(0, 4); // get next 4
    future.forEach(f => {
      upcomingSessions.push({
        ...f,
        class_name: cls.name,
        class_id: cls.id,
      });
    });
  });
  upcomingSessions.sort((a, b) => a.date.localeCompare(b.date)).splice(5); // Keep top 5 overall

  if (loadingClasses || loadingTopics) return <div style={{ padding: 40, textAlign: 'center' }}><LoadingSpinner size={32} /></div>;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${user?.center_name || 'Center'} · ${new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`}
        action={<span style={{ fontSize: 11, padding: '4px 10px', background: 'var(--amber-light, #fef3c7)', color: '#92400e', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>Teacher</span>}
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
        <div style={{ background: '#fff', border: '1px solid var(--border, #e2e8f0)', borderRadius: 'var(--radius-md)', padding: '14px 18px', boxShadow: 'var(--sh-sm, 0 1px 2px rgba(0,0,0,0.05))' }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 2, color: 'var(--primary-h, #059669)' }}>{classes.length}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>My Classrooms</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 18px', boxShadow: 'var(--sh-sm)' }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 2, color: 'var(--blue-d, #1e40af)' }}>{myTopics.length}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Topics Assigned</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 18px', boxShadow: 'var(--sh-sm)' }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 2, color: 'var(--amber-d, #92400e)' }}>0</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Pending Markings</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 18px', boxShadow: 'var(--sh-sm)' }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 2, color: 'var(--purple-d, #5b21b6)' }}>{totalStudents}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Students I Teach</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Pending homework markings */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--sh-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
            <span style={{ fontFamily: 'var(--font)', fontSize: 15, fontWeight: 600 }}>Pending Homework Markings</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 500, background: 'var(--amber-l, #fef3c7)', color: 'var(--amber-d)' }}>0 pending</span>
          </div>
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            You have no pending homework to mark.
          </div>
        </div>

        {/* My upcoming sessions */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--sh-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
            <span style={{ fontFamily: 'var(--font)', fontSize: 15, fontWeight: 600 }}>Upcoming Sessions</span>
          </div>
          {upcomingSessions.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              No upcoming sessions.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {upcomingSessions.map((sess, idx) => (
                <div key={idx} style={{ padding: '12px 20px', borderBottom: idx < upcomingSessions.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate(`/teacher/classes/${sess.class_id}`)}>
                  <div style={{ width: 44, height: 44, background: 'var(--bg-light)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-pale)' }}>{sess.day_of_week.slice(0, 3)}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{sess.date.slice(8, 10)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sess.class_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-pale)', marginTop: 2 }}>{sess.start_time}</div>
                  </div>
                  <div>
                    {sess.date === todayStr ? (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 600, background: 'var(--amber-light)', color: 'var(--amber-d)' }}>Today</span>
                    ) : (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 500, background: 'var(--sand-light)', color: 'var(--ink-pale)' }}>Upcoming</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* My topic progress across classrooms */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--sh-sm)', overflow: 'hidden', marginTop: 20 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
          <span style={{ fontFamily: 'var(--font)', fontSize: 15, fontWeight: 600 }}>My Topic Progress</span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 500, background: '#f1f5f9', color: '#475569' }}>{myTopics.length} topics across {classes.length} classrooms</span>
        </div>
        {myTopics.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            No topics assigned to you yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {myTopics.map((topic, idx) => (
              <div key={topic.id} style={{ padding: '16px 20px', borderBottom: idx < myTopics.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-l, #ecfdf5)', color: 'var(--primary-h, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{topic.topic_title || 'Unknown Topic'}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    Assigned in: {topic.course_name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
