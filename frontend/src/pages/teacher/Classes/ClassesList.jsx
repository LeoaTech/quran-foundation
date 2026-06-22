import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getClasses } from '../../../api/classes';
import PageHeader from '../../../components/PageHeader';
import LoadingSpinner from '../../../components/LoadingSpinner';
import Badge from '../../../components/Badge';

export default function TeacherClassesList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const centerId = user?.center_id;

  const { data: classesRaw = [], isLoading, error } = useQuery({
    queryKey: ['classes', centerId],
    queryFn: () => getClasses(centerId, { is_active: true }),
    staleTime: 60_000,
    enabled: !!centerId,
  });

  const classes = classesRaw?.data ?? classesRaw ?? [];

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}><LoadingSpinner size={32} /></div>;
  if (error) return <div style={{ color: 'var(--red)', padding: 20 }}>Failed to load classrooms.</div>;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font)', fontSize: 24, fontWeight: 800, marginBottom: 3 }}>My Classrooms</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Classrooms where you are assigned as teacher.</p>
        </div>
      </div>

      <div style={{ borderRadius: 'var(--radius-md)', padding: '11px 16px', fontSize: 13, lineHeight: 1.6, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--blue-light, #dbeafe)', border: '1px solid #bfdbfe', color: 'var(--blue-d, #1e40af)' }}>
        <span>ℹ️</span>
        <div>Click on a classroom to view sessions, assignments, and mark attendance.</div>
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--sh-sm)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px', borderBottom: '1.5px solid var(--border)', background: '#fafafa' }}>Classroom</th>
              <th style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px', borderBottom: '1.5px solid var(--border)', background: '#fafafa' }}>Course</th>
              <th style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px', borderBottom: '1.5px solid var(--border)', background: '#fafafa' }}>Enrolled</th>
              <th style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px', borderBottom: '1.5px solid var(--border)', background: '#fafafa' }}>Status</th>
              <th style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px', borderBottom: '1.5px solid var(--border)', background: '#fafafa' }}></th>
            </tr>
          </thead>
          <tbody>
            {classes.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>You are not assigned to any classrooms.</td>
              </tr>
            ) : (
              classes.map(cls => (
                <tr key={cls.id} style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }} onClick={() => navigate(`/teacher/classes/${cls.id}`)}>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text)' }}>
                    <div style={{ fontWeight: 600 }}>{cls.name}</div>
                    {cls.name_ur && <div style={{ fontFamily: '"Noto Naskh Arabic", serif', direction: 'rtl', fontSize: 12, color: 'var(--muted)' }}>{cls.name_ur}</div>}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text)' }}>{cls.course_name}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text)' }}>
                    <strong style={{ color: 'var(--primary-h)' }}>{cls.enrolled_count || 0}</strong>
                    {cls.max_capacity ? <span style={{ color: 'var(--pale)' }}>/{cls.max_capacity}</span> : ''}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text)' }}>
                    {cls.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text)', textAlign: 'right' }}>
                    <button style={{ background: 'none', color: 'var(--primary-h)', padding: '4px 8px', border: 'none', fontSize: 12, cursor: 'pointer' }}>Open →</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
