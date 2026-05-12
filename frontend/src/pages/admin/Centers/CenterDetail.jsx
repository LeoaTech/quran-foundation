import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { useToast } from '../../../hooks/useToast';
import { Card, CardHeader, CardBody } from '../../../components/Card';
import MetricCard from '../../../components/MetricCard';
import Badge from '../../../components/Badge';
import Button from '../../../components/Button';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import RTLInput from '../../../components/RTLInput';
import {
  getCenter, updateCenter,
  getCenterOverview, getCenterClasses,
  getClassrooms, createClassroom, updateClassroom,
} from '../../../api/centers';
import ActivityLogTab from './ActivityLogTab';

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1.5px solid var(--sand-mid)', marginBottom: 24 }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '10px 20px 12px',
            fontSize: 14, fontWeight: 500,
            color: active === t.id ? 'var(--emerald)' : 'var(--ink-pale)',
            borderBottom: active === t.id ? '2.5px solid var(--emerald)' : '2.5px solid transparent',
            marginBottom: -1.5,
            background: 'none', border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            transition: 'color 0.2s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ centerId }) {
  const { data: overview } = useQuery({
    queryKey: ['center-overview', centerId],
    queryFn:  () => getCenterOverview(centerId),
    staleTime: 3 * 60_000,
  });

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ['center-classes', centerId],
    queryFn:  () => getCenterClasses(centerId, { is_active: true }),
    staleTime: 60_000,
  });

  const classes = classesData?.data ?? classesData ?? [];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <MetricCard label="Total students"   value={overview?.active_students ?? '—'} variant="green" />
        <MetricCard label="Active classes"   value={overview?.active_classes  ?? '—'} variant="blue" />
        <MetricCard
          label="Avg. attendance"
          value={overview?.attendance_pct != null ? `${overview.attendance_pct}%` : '—'}
          sub={overview?.period?.month ? `Month: ${overview.period.month}` : 'All time'}
          variant="gold"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <Card>
          <CardHeader>
            <span className="card-title">Classes</span>
          </CardHeader>
          <CardBody style={{ padding: 0 }}>
            {classesLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><LoadingSpinner /></div>
            ) : classes.length === 0 ? (
              <EmptyState icon="◈" title="No active classes" description="Classes will appear here once created." />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Class', 'Course', 'Schedule', 'Capacity', 'Status'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 14px 10px', borderBottom: '1px solid var(--sand-mid)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classes.map((cls, i) => (
                    <tr key={cls.id}>
                      <td style={tdStyle(i < classes.length - 1)}><b>{cls.name}</b></td>
                      <td style={tdStyle(i < classes.length - 1)}>{cls.course_name ?? '—'}</td>
                      <td style={tdStyle(i < classes.length - 1)}>{cls.schedule_days ?? '—'}</td>
                      <td style={tdStyle(i < classes.length - 1)}>{cls.max_capacity ?? '—'}</td>
                      <td style={tdStyle(i < classes.length - 1)}>
                        <Badge variant={cls.is_active ? 'green' : 'sand'}>{cls.is_active ? 'Active' : 'Inactive'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><span className="card-title">Stats</span></CardHeader>
          <CardBody>
            {[
              ['Progress sessions', overview?.progress_sessions],
              ['Attendance records', overview?.total_attendance_records],
              ['Active teachers', overview?.active_teachers],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--sand)', fontSize: 13 }}>
                <span style={{ color: 'var(--ink-soft)' }}>{label}</span>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{val ?? '—'}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

// ── Classrooms tab ────────────────────────────────────────────────────────────

function ClassroomsTab({ centerId }) {
  const qc    = useQueryClient();
  const toast = useToast();
  const { role } = useAuth();
  const canEdit = role === 'super_admin' || role === 'center_manager';

  const { data: roomsData, isLoading } = useQuery({
    queryKey: ['classrooms', centerId],
    queryFn:  () => getClassrooms(centerId),
    staleTime: 60_000,
  });
  const rooms = roomsData ?? [];

  // Inline editing state
  const [editId,   setEditId]   = useState(null);
  const [editVals, setEditVals] = useState({});

  // Add row state
  const [showAdd, setShowAdd] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', name_ur: '', capacity: '' });
  const [addBusy, setAddBusy] = useState(false);

  async function saveEdit(roomId) {
    try {
      await updateClassroom(centerId, roomId, editVals);
      await qc.invalidateQueries({ queryKey: ['classrooms', centerId] });
      toast.success('Classroom updated.');
    } catch {
      toast.error('Failed to update classroom.');
    }
    setEditId(null);
  }

  async function addRoom(e) {
    e.preventDefault();
    setAddBusy(true);
    try {
      await createClassroom(centerId, {
        name:     newRoom.name,
        name_ur:  newRoom.name_ur || undefined,
        capacity: newRoom.capacity ? parseInt(newRoom.capacity, 10) : undefined,
      });
      await qc.invalidateQueries({ queryKey: ['classrooms', centerId] });
      toast.success('Classroom added.');
      setNewRoom({ name: '', name_ur: '', capacity: '' });
      setShowAdd(false);
    } catch {
      toast.error('Failed to add classroom.');
    } finally {
      setAddBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <span className="card-title">Classrooms</span>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? 'Cancel' : '+ Add classroom'}
          </Button>
        )}
      </CardHeader>
      <CardBody style={{ padding: 0 }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><LoadingSpinner /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Name (Urdu)', 'Capacity', canEdit ? 'Actions' : ''].filter(Boolean).map((h) => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 14px 10px', borderBottom: '1px solid var(--sand-mid)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Add row */}
              {showAdd && (
                <tr style={{ background: 'var(--emerald-pale)' }}>
                  <td style={tdStyle(true)}>
                    <input className="f-input" style={{ padding: '6px 10px' }} placeholder="Room name" value={newRoom.name} onChange={(e) => setNewRoom((n) => ({ ...n, name: e.target.value }))} autoFocus />
                  </td>
                  <td style={tdStyle(true)}>
                    <RTLInput style={{ padding: '6px 10px', fontSize: 14 }} placeholder="کمرہ کا نام" value={newRoom.name_ur} onChange={(e) => setNewRoom((n) => ({ ...n, name_ur: e.target.value }))} />
                  </td>
                  <td style={tdStyle(true)}>
                    <input className="f-input" style={{ padding: '6px 10px', width: 80 }} type="number" min="1" placeholder="Cap." value={newRoom.capacity} onChange={(e) => setNewRoom((n) => ({ ...n, capacity: e.target.value }))} />
                  </td>
                  <td style={tdStyle(true)}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="sm" variant="primary" disabled={!newRoom.name || addBusy} onClick={addRoom}>{addBusy ? '…' : 'Save'}</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                    </div>
                  </td>
                </tr>
              )}

              {rooms.length === 0 && !showAdd && (
                <tr>
                  <td colSpan={canEdit ? 4 : 3} style={{ padding: 0 }}>
                    <EmptyState icon="⊙" title="No classrooms yet" description="Add classrooms to this center." />
                  </td>
                </tr>
              )}

              {rooms.map((room, i) => {
                const isEditing = editId === room.id;
                return (
                  <tr key={room.id} onMouseEnter={(e) => { if (!isEditing) e.currentTarget.style.background = 'var(--sand)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}>
                    <td style={tdStyle(i < rooms.length - 1)}>
                      {isEditing ? (
                        <input className="f-input" style={{ padding: '6px 10px' }} value={editVals.name ?? ''} onChange={(e) => setEditVals((v) => ({ ...v, name: e.target.value }))} autoFocus />
                      ) : (
                        <span
                          style={{ cursor: canEdit ? 'text' : 'default', fontWeight: 500 }}
                          title={canEdit ? 'Click to edit' : undefined}
                          onClick={() => { if (canEdit) { setEditId(room.id); setEditVals({ name: room.name, name_ur: room.name_ur ?? '', capacity: room.capacity }); } }}
                        >
                          {room.name}
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle(i < rooms.length - 1), fontFamily: 'var(--font-display)', fontSize: 14, direction: 'rtl' }}>
                      {isEditing ? (
                        <RTLInput style={{ padding: '6px 10px', fontSize: 14 }} value={editVals.name_ur ?? ''} onChange={(e) => setEditVals((v) => ({ ...v, name_ur: e.target.value }))} />
                      ) : (room.name_ur ?? '—')}
                    </td>
                    <td style={tdStyle(i < rooms.length - 1)}>
                      {isEditing ? (
                        <input className="f-input" style={{ padding: '6px 10px', width: 80 }} type="number" min="1" value={editVals.capacity ?? ''} onChange={(e) => setEditVals((v) => ({ ...v, capacity: e.target.value }))} />
                      ) : (room.capacity ?? '—')}
                    </td>
                    {canEdit && (
                      <td style={tdStyle(i < rooms.length - 1)}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Button size="sm" variant="primary" onClick={() => saveEdit(room.id)}>Save</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditId(room.id); setEditVals({ name: room.name, name_ur: room.name_ur ?? '', capacity: room.capacity }); }} style={{ background: 'none', border: 'none', color: 'var(--emerald)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                            Edit
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  );
}

// ── Settings tab ──────────────────────────────────────────────────────────────

function SettingsTab({ centerId, center }) {
  const qc    = useQueryClient();
  const toast = useToast();
  const { role } = useAuth();
  const canEdit = role === 'super_admin' || role === 'center_manager';

  const [form, setForm] = useState({
    name:       center?.name       ?? '',
    name_ur:    center?.name_ur    ?? '',
    city:       center?.city       ?? '',
    address:    center?.address    ?? '',
    address_ur: center?.address_ur ?? '',
    phone:      center?.phone      ?? '',
    is_active:  center?.is_active  ?? true,
  });
  const [busy, setBusy] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateCenter(centerId, form);
      await qc.invalidateQueries({ queryKey: ['center', centerId] });
      toast.success('Center settings saved.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to save settings.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader><span className="card-title">Center details</span></CardHeader>
      <CardBody>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <FormField label="Name (English)">
              <input className="f-input" value={form.name} onChange={set('name')} required disabled={!canEdit} />
            </FormField>
            <FormField label="Name (Urdu) — اردو نام">
              <RTLInput value={form.name_ur} onChange={set('name_ur')} disabled={!canEdit} />
            </FormField>
            <FormField label="City">
              <input className="f-input" value={form.city} onChange={set('city')} disabled={!canEdit} />
            </FormField>
            <FormField label="Phone">
              <input className="f-input" type="tel" value={form.phone} onChange={set('phone')} disabled={!canEdit} />
            </FormField>
            <FormField label="Address (English)">
              <input className="f-input" value={form.address} onChange={set('address')} disabled={!canEdit} />
            </FormField>
            <FormField label="Address (Urdu) — پتہ">
              <RTLInput value={form.address_ur} onChange={set('address_ur')} disabled={!canEdit} />
            </FormField>
          </div>

          {role === 'super_admin' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={set('is_active')} />
              <label htmlFor="is_active" style={{ fontSize: 13, color: 'var(--ink-mid)', cursor: 'pointer' }}>Active center</label>
            </div>
          )}

          {canEdit && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
            </div>
          )}
        </form>
      </CardBody>
    </Card>
  );
}

function FormField({ label, children }) {
  return (
    <div className="f-group" style={{ marginBottom: 16 }}>
      <label className="f-label">{label}</label>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',   label: 'Overview' },
  { id: 'classrooms', label: 'Classrooms' },
  { id: 'activity',   label: 'Activity' },
  { id: 'settings',   label: 'Settings' },
];

export default function CenterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Scoping: center_manager can only view their own center
  if (role === 'center_manager' && user?.center_id && user.center_id !== id) {
    navigate(`/admin/centers/${user.center_id}`, { replace: true });
    return null;
  }

  const { data: center, isLoading, error } = useQuery({
    queryKey: ['center', id],
    queryFn:  () => getCenter(id),
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><LoadingSpinner size={32} /></div>;
  }
  if (error) {
    return <EmptyState icon="⊙" title="Center not found" description="This center doesn't exist or you don't have access." action={{ label: '← Back', onClick: () => navigate('/admin/centers') }} />;
  }

  return (
    <>
      {/* ── Center header ── */}
      <div style={{ marginBottom: 24 }}>
        {role === 'super_admin' && (
          <button
            onClick={() => navigate('/admin/centers')}
            style={{ background: 'none', border: 'none', color: 'var(--emerald)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)', marginBottom: 12, padding: 0 }}
          >
            ← All centers
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--ink)', lineHeight: 1.2 }}>
                {center?.name}
              </h1>
              <Badge variant={center?.is_active ? 'green' : 'sand'}>
                {center?.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            {center?.name_ur && (
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-soft)', direction: 'rtl', marginBottom: 6 }}>
                {center.name_ur}
              </div>
            )}
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--ink-soft)' }}>
              {center?.city  && <span>⊙ {center.city}</span>}
              {center?.phone && <span>📞 {center.phone}</span>}
            </div>
            {center?.address_ur && (
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink-pale)', direction: 'rtl', marginTop: 4 }}>
                {center.address_ur}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview'   && <OverviewTab   centerId={id} />}
      {activeTab === 'classrooms' && <ClassroomsTab centerId={id} />}
      {activeTab === 'activity'   && <ActivityLogTab centerId={id} />}
      {activeTab === 'settings'   && <SettingsTab   centerId={id} center={center} />}
    </>
  );
}

const tdStyle = (hasBorder) => ({
  padding: '11px 14px',
  fontSize: 13,
  color: 'var(--ink-mid)',
  borderBottom: hasBorder ? '1px solid var(--sand)' : 'none',
  verticalAlign: 'middle',
});
