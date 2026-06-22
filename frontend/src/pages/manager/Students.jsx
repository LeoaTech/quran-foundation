import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import ShareCredentialsModal from '../../components/ShareCredentialsModal';
import { getStudents, updateUser } from '../../api/users';
import { getCenters } from '../../api/centers';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useNavigate } from 'react-router-dom';

export default function Students() {
  const { user, role } = useAuth();
  const isGlobal = role === 'super_admin';
  const centerId = user?.center_id;

  const [selectedCenter, setSelectedCenter] = useState(isGlobal ? 'all' : centerId);
  const [shareUser, setShareUser] = useState(null);

  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const { data: centersData } = useQuery({
    queryKey: ['centers'],
    queryFn: getCenters,
    enabled: isGlobal,
  });
  const centers = centersData?.data ?? [];

  const { data: studentsData, isLoading, error } = useQuery({
    queryKey: ['students', selectedCenter],
    queryFn: () => getStudents({ role: 'student', center_id: selectedCenter === 'all' ? undefined : selectedCenter }),
    staleTime: 60_000,
  });

  const students = studentsData?.data ?? studentsData ?? [];

  const withdrawMutation = useMutation({
    mutationFn: (studentId) => updateUser(studentId, { is_active: false }),
    onSuccess: () => {
      toast.success('Student withdrawn successfully');
      qc.invalidateQueries(['students', selectedCenter]);
    },
    onError: (err) => {
      toast.error('Failed to withdraw student');
    }
  });

  const handleWithdraw = (student) => {
    if (window.confirm(`Are you sure you want to withdraw ${student.full_name}? They will be marked as inactive.`)) {
      withdrawMutation.mutate(student.id);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <PageHeader
          title="Students"
          subtitle={isGlobal ? "All students across centers" : "All students enrolled in your center"}
        />
        {isGlobal && (
          <select
            className="f-input"
            style={{ width: 200 }}
            value={selectedCenter}
            onChange={e => setSelectedCenter(e.target.value)}
          >
            <option value="all">All Centers</option>
            {centers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          Failed to load students.
        </div>
      )}

      <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {students.length === 0 && !isLoading ? (
          <EmptyState
            icon="⊙"
            title="No students yet"
            description="Enroll students to see them listed here."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Student', 'Course', 'Phone', 'Gender', 'Status', 'Actions'].map((h) => (
                    <th key={h} style={{ textAlign: h === 'Actions' ? 'right' : 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 14px', borderBottom: '1px solid var(--sand-mid)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const avatarUrl = student.metadata?.profile_picture;
                  const initials = student.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'S';

                  return (
                    <tr
                      key={student.id}
                      style={{ transition: 'background 0.1s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sand)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                    >
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--emerald-light)', color: 'var(--emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>
                              {initials}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{student.full_name}</div>
                            {student.full_name_ur && <div style={{ fontSize: 12, color: 'var(--ink-soft)', direction: 'rtl', fontFamily: 'var(--font-display)' }}>{student.full_name_ur}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 13, color: 'var(--ink-mid)' }}>
                          {student.enrolled_courses || '—'}
                        </span>
                      </td>
                      <td style={tdStyle}>{student.phone ?? '—'}</td>
                      <td style={{ ...tdStyle, textTransform: 'capitalize' }}>{student.gender ?? '—'}</td>
                      <td style={tdStyle}>
                        <Badge variant={student.is_active ? 'green' : 'sand'}>
                          {student.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <Button
                            size="sm"
                            variant="outline"
                            style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}
                            onClick={() => navigate(`/manager/users/${student.id}`)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            style={{ color: 'var(--red)', border: 'none' }}
                            onClick={() => handleWithdraw(student)}
                            disabled={!student.is_active}
                          >
                            Withdraw
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            style={{ color: 'var(--ink)', borderColor: 'var(--ink)' }}
                            onClick={() => setShareUser(student)}
                          >
                            Share Credentials
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ShareCredentialsModal
        isOpen={!!shareUser}
        user={shareUser}
        onClose={() => setShareUser(null)}
      />
    </>
  );
}

const tdStyle = {
  padding: '12px 14px',
  fontSize: 13,
  color: 'var(--ink-mid)',
  borderBottom: '1px solid var(--sand)',
  verticalAlign: 'middle',
};
