import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { getUser } from '../../../api/users';
import UserProfileTabs from './UserProfileTabs';

export default function UserProfilePage() {
  const { userId } = useParams();
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn:  () => getUser(userId),
    staleTime: 60_000,
    enabled:  !!userId,
  });

  return (
    <div>
      <UserProfileTabs userId={userId} />

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <LoadingSpinner size={28} />
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink)', marginBottom: 4 }}>
              {user?.full_name ?? '—'}
            </h2>
            {user?.full_name_ur && (
              <div style={{ fontSize: 16, fontFamily: 'var(--font-display)', direction: 'rtl', color: 'var(--ink-soft)', marginBottom: 4 }}>
                {user.full_name_ur}
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--ink-pale)' }}>
              {user?.phone ?? '—'} · {user?.preferred_lang ?? 'en'}
            </div>
          </div>

          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ink-pale)', fontSize: 14 }}>
              <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.4 }}>◉</div>
              Full user profile editor — coming soon.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
