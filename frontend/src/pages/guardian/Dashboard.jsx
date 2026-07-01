import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import client from '../../api/client';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

// A temporary fetch function since we don't have a dedicated API file for guardians yet.
const getGuardianChildren = (guardianId) => 
  client.get(`/users?role=student`).then(res => {
    // Ideally this would be a dedicated endpoint, but for this basic version,
    // we assume the backend has some way to link them, or we just fetch all students
    // and filter if a specific endpoint isn't ready. 
    // Wait, let's look at how guardians link. They use the `guardians` table.
    // The backend `getUsers({ role: 'student' })` does NOT currently filter by guardian.
    // We can just rely on the API to return the children. Let's make an API call to a theoretical endpoint,
    // or just fetch the guardian's own profile which we added `children_names` to.
    return client.get(`/users/${guardianId}`).then(r => r.data);
  });

export default function GuardianDashboard() {
  const { user } = useAuth();

  // Since we only have a basic portal for now, we'll just display a welcome message
  // and the names of the children we retrieved from the `children_names` field in the user profile.

  const { data: profile, isLoading } = useQuery({
    queryKey: ['guardian-profile', user?.id],
    queryFn: () => getGuardianChildren(user?.id),
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 24 }}>
      <PageHeader 
        title={`Welcome, ${user?.full_name || 'Guardian'}`} 
        subtitle="View your children's progress and details." 
      />

      <div style={{ background: 'var(--blue-light)', border: '1px solid var(--blue)', borderRadius: 'var(--radius-lg)', padding: '24px 32px', marginBottom: 32 }}>
        <h3 style={{ fontSize: 18, color: 'var(--ink)', marginBottom: 12 }}>Assalamu Alaikum!</h3>
        <p style={{ fontSize: 15, color: 'var(--ink-mid)', lineHeight: 1.6 }}>
          Welcome to the Guardian Portal. From here, you will be able to monitor the progress and attendance of your children enrolled in the Quran Foundation LMS.
        </p>
      </div>

      <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Your Enrolled Children</h3>
      
      <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)', padding: 24, boxShadow: 'var(--shadow-sm)' }}>
         <p style={{ color: 'var(--ink-mid)', fontSize: 15 }}>
           The Guardian Portal is currently under construction. In the future, you will see a detailed list of your children and their progress reports here.
         </p>
      </div>
    </div>
  );
}
