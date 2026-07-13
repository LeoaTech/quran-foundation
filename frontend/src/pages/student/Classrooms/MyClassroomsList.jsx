import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { getStudentEnrollments } from '../../../api/enrollments';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function MyClassroomsList() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    getStudentEnrollments(user.id)
      .then(data => {
        setEnrollments(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load enrollments', err);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--ink)' }}>My Classrooms</h1>
        <p style={{ color: 'var(--ink-soft)' }}>View details for your enrolled classes.</p>
      </div>

      {enrollments.length === 0 ? (
        <div style={{ padding: 40, background: 'var(--white)', border: '1px solid var(--sand)', borderRadius: 'var(--radius-lg)', textAlign: 'center', color: 'var(--ink-pale)' }}>
          You are not currently enrolled in any classes.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {enrollments.map(enr => (
            <Link 
              key={enr.id} 
              to={`/student/classrooms/${enr.class_id}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{ 
                background: 'var(--white)', 
                border: '1px solid var(--sand-mid)', 
                borderRadius: 'var(--radius-lg)', 
                padding: 24, 
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <div style={{ fontSize: 12, color: 'var(--emerald)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Active Enrollment
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
                  {enr.class_name}
                </h3>
                {enr.class_name_ur && (
                  <div style={{ fontSize: 16, fontFamily: 'var(--font-display)', color: 'var(--ink-soft)', direction: 'rtl', marginBottom: 12 }}>
                    {enr.class_name_ur}
                  </div>
                )}
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                  Enrolled on: {new Date(enr.enrolled_on).toLocaleDateString()}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
