import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import ShareCredentialsModal from '../../components/ShareCredentialsModal';
import ImportStudentsModal from '../../components/ImportStudentsModal';
import { getStudents, updateUser, exportStudents } from '../../api/users';
import { getCenters } from '../../api/centers';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useNavigate } from 'react-router-dom';

export default function Students() {
  const { user, role } = useAuth();
  const isGlobal = role === 'super_admin';
  const centerId = user?.center_id;

  const [selectedCenter, setSelectedCenter] = useState(isGlobal ? 'all' : centerId);
  const [activeTab, setActiveTab] = useState('students');
  const [shareUser, setShareUser] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [ageFilter, setAgeFilter] = useState('all'); // 'all' | 'minor' | 'adult'

  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const handleExport = async (format) => {
    try {
      setIsExporting(true);
      toast.info(`Generating ${format.toUpperCase()} export...`);
      await exportStudents({ center_id: selectedCenter, format });
      toast.success('Export downloaded successfully!');
    } catch (err) {
      toast.error(`Failed to export students data: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const { data: centersData } = useQuery({
    queryKey: ['centers'],
    queryFn: getCenters,
    enabled: isGlobal,
  });
  const centers = centersData?.data ?? [];

  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['students', selectedCenter, activeTab],
    queryFn: () => getStudents({ role: activeTab === 'students' ? 'student' : 'guardian', center_id: selectedCenter === 'all' ? undefined : selectedCenter }),
    staleTime: 60_000,
  });

  const usersList = usersData?.data ?? usersData ?? [];

  // Client-side filtering
  const filteredList = useMemo(() => {
    let list = usersList;
    const q = searchQuery.trim().toLowerCase();

    if (activeTab === 'students') {
      // Age filter
      if (ageFilter === 'minor') list = list.filter(u => u.is_minor);
      else if (ageFilter === 'adult') list = list.filter(u => !u.is_minor);

      // Search filter: name, phone, enrolled course
      if (q) {
        list = list.filter(u =>
          (u.full_name || '').toLowerCase().includes(q) ||
          (u.full_name_ur || '').includes(q) ||
          (u.phone || '').toLowerCase().includes(q) ||
          (u.enrolled_courses || '').toLowerCase().includes(q)
        );
      }
    } else {
      // Guardians tab: search by guardian name or phone
      if (q) {
        list = list.filter(u =>
          (u.full_name || '').toLowerCase().includes(q) ||
          (u.phone || '').toLowerCase().includes(q) ||
          (u.children_names || '').toLowerCase().includes(q)
        );
      }
    }
    return list;
  }, [usersList, searchQuery, ageFilter, activeTab]);

  const withdrawMutation = useMutation({
    mutationFn: (studentId) => updateUser(studentId, { is_active: false }),
    onSuccess: () => {
      toast.success('User deactivated successfully');
      qc.invalidateQueries(['students', selectedCenter, activeTab]);
    },
    onError: () => {
      toast.error('Failed to deactivate user');
    }
  });

  const handleWithdraw = (student) => {
    if (window.confirm(`Are you sure you want to deactivate ${student.full_name}? They will be marked as inactive.`)) {
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <PageHeader
          title="Students & Guardians"
          subtitle={isGlobal ? "All students and guardians across centers" : "Manage students and guardians in your center"}
        />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
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

          <Button
            variant="emerald"
            onClick={() => setIsImportModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            Import Students
          </Button>

          <Button
            variant="outline"
            disabled={isExporting}
            onClick={() => handleExport('xlsx')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            Export Excel
          </Button>

          <Button
            variant="outline"
            disabled={isExporting}
            onClick={() => handleExport('csv')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--sand)', marginBottom: 16 }}>
        <button
          onClick={() => { setActiveTab('students'); setSearchQuery(''); }}
          style={{ padding: '8px 4px', borderBottom: activeTab === 'students' ? '2px solid var(--emerald)' : '2px solid transparent', color: activeTab === 'students' ? 'var(--emerald)' : 'var(--ink-muted)', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontWeight: activeTab === 'students' ? 600 : 400 }}
        >
          Students
        </button>
        <button
          onClick={() => { setActiveTab('guardians'); setSearchQuery(''); setAgeFilter('all'); }}
          style={{ padding: '8px 4px', borderBottom: activeTab === 'guardians' ? '2px solid var(--emerald)' : '2px solid transparent', color: activeTab === 'guardians' ? 'var(--emerald)' : 'var(--ink-muted)', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontWeight: activeTab === 'guardians' ? 600 : 400 }}
        >
          Guardians
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 400 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-pale)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            className="f-input"
            placeholder={activeTab === 'students' ? 'Search by name, phone or course...' : 'Search by guardian name or phone...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, paddingRight: searchQuery ? 36 : undefined }}
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}
            >
              ×
            </button>
          )}
        </div>

        {activeTab === 'students' && (
          <select
            className="f-input"
            value={ageFilter}
            onChange={e => setAgeFilter(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="all">All Students</option>
            <option value="minor">Under 18 (Minors)</option>
            <option value="adult">Adults</option>
          </select>
        )}

        {(searchQuery || ageFilter !== 'all') && (
          <span style={{ fontSize: 12, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
            Showing {filteredList.length} of {usersList.length}
          </span>
        )}
      </div>

      {error && (
        <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          Failed to load users.
        </div>
      )}

      <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {filteredList.length === 0 && !isLoading ? (
          <EmptyState
            icon="⊙"
            title={searchQuery || ageFilter !== 'all' ? 'No results found' : `No ${activeTab} yet`}
            description={searchQuery || ageFilter !== 'all' ? 'Try adjusting your search or filter criteria.' : `There are no ${activeTab} to display.`}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {activeTab === 'students'
                    ? ['Student', 'Course', 'Phone', 'Gender', 'Status', 'Actions'].map((h) => (
                      <th key={h} style={{ textAlign: h === 'Actions' ? 'right' : 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 14px', borderBottom: '1px solid var(--sand-mid)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))
                    : ['Guardian', 'Children', 'Phone', 'Status', 'Actions'].map((h) => (
                      <th key={h} style={{ textAlign: h === 'Actions' ? 'right' : 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 14px', borderBottom: '1px solid var(--sand-mid)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))
                  }
                </tr>
              </thead>
              <tbody>
                {filteredList.map((userRow) => {
                  const avatarUrl = userRow.metadata?.profile_picture;
                  const initials = userRow.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || (activeTab === 'students' ? 'S' : 'G');

                  return (
                    <tr
                      key={userRow.id}
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
                            <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{userRow.full_name}</div>
                            {userRow.full_name_ur && <div style={{ fontSize: 12, color: 'var(--ink-soft)', direction: 'rtl', fontFamily: 'var(--font-display)' }}>{userRow.full_name_ur}</div>}
                          </div>
                        </div>
                      </td>

                      {activeTab === 'students' ? (
                        <>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 13, color: 'var(--ink-mid)' }}>
                              {userRow.enrolled_courses || '—'}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            {userRow.is_minor ? <span style={{ color: 'var(--ink-pale)', fontSize: 12, fontStyle: 'italic' }}>Minor (See Guardian)</span> : (userRow.phone ?? '—')}
                          </td>
                          <td style={{ ...tdStyle, textTransform: 'capitalize' }}>{userRow.gender ?? '—'}</td>
                        </>
                      ) : (
                        <>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 13, color: 'var(--ink-mid)' }}>
                              {userRow.children_names || '—'}
                            </span>
                          </td>
                          <td style={tdStyle}>{userRow.phone ?? '—'}</td>
                        </>
                      )}

                      <td style={tdStyle}>
                        <Badge variant={userRow.is_active ? 'green' : 'sand'}>
                          {userRow.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <Button
                            size="sm"
                            variant="outline"
                            style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}
                            onClick={() => navigate(`/manager/users/${userRow.id}`)}
                          >
                            Edit
                          </Button>
                          {activeTab === 'students' && (
                            <Button
                              size="sm"
                              variant="outline"
                              style={{ color: 'var(--red)', border: 'none' }}
                              onClick={() => handleWithdraw(userRow)}
                              disabled={!userRow.is_active}
                            >
                              Withdraw
                            </Button>
                          )}

                          {/* Only show Share Credentials if it's a Guardian, or an Adult Student */}
                          {(!userRow.is_minor) && (
                            <Button
                              size="sm"
                              variant="outline"
                              style={{ color: 'var(--ink)', borderColor: 'var(--ink)' }}
                              onClick={() => setShareUser(userRow)}
                            >
                              Share Credentials
                            </Button>
                          )}
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

      <ImportStudentsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        centers={centers}
        defaultCenterId={selectedCenter}
        isGlobal={isGlobal}
        onSuccess={() => qc.invalidateQueries(['students', selectedCenter, activeTab])}
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
