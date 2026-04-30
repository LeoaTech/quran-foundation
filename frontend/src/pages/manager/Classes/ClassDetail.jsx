import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardBody } from '../../../components/Card';
import Button from '../../../components/Button';
import Badge from '../../../components/Badge';
import RTLInput from '../../../components/RTLInput';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import { useToast } from '../../../hooks/useToast';
import {
  getClass,
  getClassTeachers,
  assignTeacher,
  removeTeacher,
  getHomeworkCriteria,
  createCriterion,
  updateCriterion,
  deactivateCriterion,
  getClassEnrollments,
} from '../../../api/classes';
import { getTopics } from '../../../api/courses';
import { getUsers } from '../../../api/users';

const TYPE_CHIP = {
  hifz:    { label: 'Hifz',    cls: 'chip chip-green' },
  nazra:   { label: 'Nazra',   cls: 'chip chip-blue'  },
  tajweed: { label: 'Tajweed', cls: 'chip chip-gold'  },
  arabic:  { label: 'Arabic',  cls: 'chip chip-sand'  },
};

const DAYS_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

function Field({ label, children }) {
  return (
    <div className="f-group" style={{ marginBottom: 14 }}>
      <label className="f-label">{label}</label>
      {children}
    </div>
  );
}

// ── Students tab ──────────────────────────────────────────────────────────────
function StudentsTab({ classId }) {
  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['class-enrollments', classId],
    queryFn:  () => getClassEnrollments(classId, { status: 'active' }),
    staleTime: 60_000,
  });

  const rows = enrollments?.data ?? enrollments ?? [];

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={28} /></div>;
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button size="sm" variant="outline" disabled>Enroll student (coming soon)</Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="○" title="No enrolled students" description="Enroll students into this class to get started." />
      ) : (
        <div style={{ border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Student', 'Urdu name', 'Enrolled on', 'Prior level', 'Status'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((en, i) => (
                <tr key={en.id}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: 'var(--ink)', borderBottom: i < rows.length - 1 ? '1px solid var(--sand)' : 'none' }}>
                    {en.full_name ?? en.student?.full_name ?? '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--ink-soft)', fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', borderBottom: i < rows.length - 1 ? '1px solid var(--sand)' : 'none' }}>
                    {en.full_name_ur ?? en.student?.full_name_ur ?? ''}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--ink-soft)', borderBottom: i < rows.length - 1 ? '1px solid var(--sand)' : 'none' }}>
                    {en.enrolled_on ?? '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--ink-soft)', borderBottom: i < rows.length - 1 ? '1px solid var(--sand)' : 'none' }}>
                    {en.prior_level ?? '—'}
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: i < rows.length - 1 ? '1px solid var(--sand)' : 'none' }}>
                    <Badge variant={en.status === 'active' ? 'green' : 'sand'}>{en.status ?? 'active'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Teachers tab ──────────────────────────────────────────────────────────────
function TeachersTab({ classId, centerId }) {
  const qc    = useQueryClient();
  const toast = useToast();

  const [assigning, setAssigning] = useState(false);
  const [search, setSearch]       = useState('');
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [busy, setBusy]           = useState(false);

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['class-teachers', classId],
    queryFn:  () => getClassTeachers(classId),
    staleTime: 2 * 60_000,
  });

  const { data: usersData } = useQuery({
    queryKey:  ['users-teachers', centerId, search],
    queryFn:   () => getUsers({ center_id: centerId, role: 'teacher', search, per_page: 10 }),
    staleTime: 30_000,
    enabled:   assigning,
  });

  const teacherList = teachers?.data ?? teachers ?? [];
  const searchResults = usersData?.data ?? usersData ?? [];

  async function handleAssign(teacherUser) {
    setBusy(true);
    try {
      await assignTeacher(classId, {
        teacher_user_id: teacherUser.id,
        is_primary: teacherList.length === 0,
        assigned_from: new Date().toISOString().slice(0, 10),
      });
      await qc.invalidateQueries({ queryKey: ['class-teachers', classId] });
      toast.success(`${teacherUser.full_name} assigned.`);
      setAssigning(false);
      setSearch('');
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to assign teacher.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(teacher) {
    setBusy(true);
    try {
      await removeTeacher(classId, teacher.teacher_user_id ?? teacher.id);
      await qc.invalidateQueries({ queryKey: ['class-teachers', classId] });
      toast.success('Teacher removed.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to remove teacher.');
    } finally {
      setBusy(false);
      setConfirmRemove(null);
    }
  }

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={28} /></div>;
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {!assigning && (
          <Button size="sm" variant="primary" onClick={() => setAssigning(true)}>+ Assign teacher</Button>
        )}
      </div>

      {assigning && (
        <Card style={{ marginBottom: 20 }}>
          <CardHeader><span className="card-title">Search teachers</span></CardHeader>
          <CardBody>
            <input
              className="f-input"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              style={{ marginBottom: 12 }}
            />
            {searchResults.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--ink-pale)', textAlign: 'center', padding: '12px 0' }}>
                {search ? 'No teachers found.' : 'Type to search teachers at this center.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {searchResults.map((u) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--sand-light)', border: '1px solid var(--sand-mid)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{u.full_name}</div>
                      {u.full_name_ur && <div style={{ fontSize: 11, color: 'var(--ink-soft)', direction: 'rtl' }}>{u.full_name_ur}</div>}
                    </div>
                    <Button size="sm" variant="primary" onClick={() => handleAssign(u)} disabled={busy}>Assign</Button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Button size="sm" variant="outline" onClick={() => { setAssigning(false); setSearch(''); }}>Cancel</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {teacherList.length === 0 && !assigning ? (
        <EmptyState icon="◉" title="No teachers assigned" description="Assign a teacher to activate this class." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {teacherList.map((t) => (
            <div key={t.id ?? t.teacher_user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--emerald-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--emerald)' }}>
                  {(t.full_name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{t.full_name ?? '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-pale)' }}>
                    {t.is_primary ? 'Primary teacher' : 'Secondary teacher'}
                    {t.assigned_from ? ` · since ${t.assigned_from}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {t.is_primary && <Badge variant="green">Primary</Badge>}
                <Button size="sm" variant="outline" onClick={() => setConfirmRemove(t)}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmRemove && (
        <div style={{ marginTop: 12, background: 'var(--red-light)', border: '1px solid var(--red)', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--red)' }}>Remove {confirmRemove.full_name} from this class?</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant="outline" onClick={() => setConfirmRemove(null)} disabled={busy}>Cancel</Button>
            <Button size="sm" variant="primary" style={{ background: 'var(--red)', boxShadow: 'none' }} onClick={() => handleRemove(confirmRemove)} disabled={busy}>
              {busy ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Homework Criteria tab ─────────────────────────────────────────────────────
function HomeworkCriteriaTab({ classId, courseId }) {
  const qc    = useQueryClient();
  const toast = useToast();
  const [addOpen, setAddOpen]   = useState(false);
  const [editing, setEditing]   = useState(null);
  const [busy, setBusy]         = useState(false);

  const EMPTY_FORM = { label: '', label_ur: '', topic_id: '', subtopic_id: '', max_marks: '', display_order: '' };
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: criteria = [], isLoading } = useQuery({
    queryKey: ['homework-criteria', classId],
    queryFn:  () => getHomeworkCriteria(classId),
    staleTime: 2 * 60_000,
  });

  const { data: topics = [] } = useQuery({
    queryKey:  ['topics', courseId],
    queryFn:   () => getTopics(courseId),
    staleTime: 5 * 60_000,
    enabled:   !!courseId,
  });

  const rows = criteria?.data ?? criteria ?? [];
  const activeCriteria = rows.filter((c) => c.is_active);
  const topicList = topics?.data ?? topics ?? [];
  const totalMarks = activeCriteria.reduce((sum, c) => sum + (c.max_marks ?? 0), 0);

  const selectedTopic = topicList.find((t) => t.id === form.topic_id);
  const subtopics     = selectedTopic?.subtopics ?? [];

  function setF(field) {
    return (e) => {
      const val = e.target.value;
      setForm((f) => ({
        ...f,
        [field]: val,
        ...(field === 'topic_id' ? { subtopic_id: '' } : {}),
      }));
    };
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM, display_order: activeCriteria.length + 1 });
    setEditing(null);
    setAddOpen(true);
  }

  function openEdit(c) {
    setForm({
      label:        c.label        ?? '',
      label_ur:     c.label_ur     ?? '',
      topic_id:     c.topic_id     ?? '',
      subtopic_id:  c.subtopic_id  ?? '',
      max_marks:    c.max_marks    ?? '',
      display_order: c.display_order ?? '',
    });
    setEditing(c);
    setAddOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        max_marks:     Number(form.max_marks),
        display_order: Number(form.display_order),
        topic_id:      form.topic_id    || undefined,
        subtopic_id:   form.subtopic_id || undefined,
      };
      if (editing) {
        await updateCriterion(classId, editing.id, payload);
        toast.success('Criterion updated.');
      } else {
        await createCriterion(classId, payload);
        toast.success('Criterion added.');
      }
      await qc.invalidateQueries({ queryKey: ['homework-criteria', classId] });
      setAddOpen(false);
      setEditing(null);
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to save criterion.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivate(c) {
    setBusy(true);
    try {
      await deactivateCriterion(classId, c.id);
      await qc.invalidateQueries({ queryKey: ['homework-criteria', classId] });
      toast.success('Criterion deactivated.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to deactivate.');
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={28} /></div>;
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 4 }}>
          Criteria define what homework is scored against each session.
        </p>
        {activeCriteria.length > 0 && (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            Total: {totalMarks} marks
          </div>
        )}
      </div>

      {addOpen && (
        <Card style={{ marginBottom: 20 }}>
          <CardHeader>
            <span className="card-title">{editing ? 'Edit criterion' : 'Add criterion'}</span>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="Label (English)">
                  <input className="f-input" value={form.label} onChange={setF('label')} placeholder="e.g. Recitation accuracy" required />
                </Field>
                <Field label="Label (Urdu) — اردو">
                  <RTLInput value={form.label_ur} onChange={setF('label_ur')} placeholder="تلاوت کی درستی" />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="Topic (optional)">
                  <select className="f-select" value={form.topic_id} onChange={setF('topic_id')}>
                    <option value="">— Any topic —</option>
                    {topicList.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Subtopic (optional)">
                  <select className="f-select" value={form.subtopic_id} onChange={setF('subtopic_id')} disabled={!form.topic_id || subtopics.length === 0}>
                    <option value="">— None —</option>
                    {subtopics.map((s) => (
                      <option key={s.id} value={s.id}>{s.title_ur || s.title}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '100px 100px 1fr', gap: '0 16px', alignItems: 'end' }}>
                <Field label="Max marks">
                  <input className="f-input" type="number" min="1" max="100" value={form.max_marks} onChange={setF('max_marks')} placeholder="10" required />
                </Field>
                <Field label="Order">
                  <input className="f-input" type="number" min="1" value={form.display_order} onChange={setF('display_order')} placeholder="1" required />
                </Field>
                <div />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <Button type="button" size="sm" variant="outline" onClick={() => { setAddOpen(false); setEditing(null); }} disabled={busy}>Cancel</Button>
                <Button type="submit" size="sm" variant="primary" disabled={busy}>
                  {busy ? 'Saving…' : editing ? 'Save changes' : 'Add criterion'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Deactivation warning */}
      {activeCriteria.length > 0 && (
        <div style={{ background: 'var(--gold-light)', border: '1px solid var(--sand-deep)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 12, color: 'var(--ink-soft)', marginBottom: 12 }}>
          Deactivating a criterion will hide it from future sessions. Historical scores are preserved.
        </div>
      )}

      {rows.length === 0 && !addOpen ? (
        <EmptyState
          icon="▦"
          title="No homework criteria"
          description="Add criteria to define what gets scored in each homework session."
          action={<Button size="sm" variant="primary" onClick={openAdd}>+ Add criterion</Button>}
        />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            {!addOpen && (
              <Button size="sm" variant="primary" onClick={openAdd}>+ Add criterion</Button>
            )}
          </div>
          <div style={{ border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Label (Urdu)', 'Topic', 'Max marks', 'Status', ''].map((h) => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => (
                  <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.5 }}>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--ink-pale)', borderBottom: i < rows.length - 1 ? '1px solid var(--sand)' : 'none' }}>{c.display_order}</td>
                    <td style={{ padding: '10px 14px', borderBottom: i < rows.length - 1 ? '1px solid var(--sand)' : 'none' }}>
                      <div style={{ fontSize: 13, fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right', color: 'var(--ink)' }}>{c.label_ur || c.label}</div>
                      {c.label_ur && c.label && (
                        <div style={{ fontSize: 11, color: 'var(--ink-pale)' }}>{c.label}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--ink-soft)', borderBottom: i < rows.length - 1 ? '1px solid var(--sand)' : 'none' }}>
                      {c.topic_title_ur ?? c.topic_title ?? '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', borderBottom: i < rows.length - 1 ? '1px solid var(--sand)' : 'none' }}>
                      {c.max_marks}
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: i < rows.length - 1 ? '1px solid var(--sand)' : 'none' }}>
                      <Badge variant={c.is_active ? 'green' : 'sand'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td style={{ padding: '10px 14px', borderBottom: i < rows.length - 1 ? '1px solid var(--sand)' : 'none' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>Edit</Button>
                        {c.is_active && (
                          <Button size="sm" variant="outline" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => handleDeactivate(c)} disabled={busy}>
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

// ── Schedule tab ──────────────────────────────────────────────────────────────
function ScheduleTab({ cls }) {
  const scheduleDays = cls?.schedule_days
    ? cls.schedule_days.split(',').map((d) => d.trim())
    : [];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <CardHeader><span className="card-title">Weekly schedule</span></CardHeader>
        <CardBody>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {DAYS_ORDER.map((day) => {
              const active = scheduleDays.includes(day);
              return (
                <div
                  key={day}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-sm)',
                    background: active ? 'var(--emerald-light)' : 'var(--sand-mid)',
                    color: active ? 'var(--emerald)' : 'var(--ink-pale)',
                    fontWeight: active ? 600 : 400,
                    fontSize: 13,
                    border: active ? '1.5px solid var(--emerald)' : '1.5px solid transparent',
                  }}
                >
                  {day}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Start time</div>
              <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', color: 'var(--ink)', fontWeight: 600 }}>
                {cls?.start_time ?? '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Days per week</div>
              <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', color: 'var(--ink)', fontWeight: 600 }}>
                {scheduleDays.length}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><span className="card-title">Class details</span></CardHeader>
        <CardBody>
          {[
            ['Max capacity',  cls?.max_capacity  ?? '—'],
            ['Course',        cls?.course_name   ?? cls?.course?.name ?? '—'],
            ['Level',         cls?.course_level_title ?? '—'],
            ['Status',        cls?.is_active ? 'Active' : 'Inactive'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--sand)', fontSize: 13 }}>
              <span style={{ color: 'var(--ink-soft)' }}>{label}</span>
              <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{value}</span>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'students',  label: 'Students'          },
  { id: 'teachers',  label: 'Teachers'          },
  { id: 'criteria',  label: 'Homework Criteria' },
  { id: 'schedule',  label: 'Schedule'          },
];

export default function ClassDetail() {
  const { id: classId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('students');

  const { data: cls, isLoading, error } = useQuery({
    queryKey: ['class', classId],
    queryFn:  () => getClass(classId),
    staleTime: 2 * 60_000,
  });

  const courseType = cls?.course_type ?? cls?.course?.type;
  const chip = courseType ? (TYPE_CHIP[courseType] ?? { label: courseType, cls: 'chip chip-sand' }) : null;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (error || !cls) {
    return (
      <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13 }}>
        Class not found.
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => navigate('/classes')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-pale)', fontSize: 13, padding: 0, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← Classes
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2 }}>
                {cls.name}
              </h2>
              {chip && <span className={chip.cls}>{chip.label}</span>}
              {!cls.is_active && <span className="chip chip-red" style={{ fontSize: 10 }}>Inactive</span>}
            </div>
            {cls.name_ur && (
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-soft)', direction: 'rtl', marginBottom: 4 }}>
                {cls.name_ur}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--ink-pale)', display: 'flex', gap: 12 }}>
              {cls.schedule_days && (
                <span>{cls.schedule_days} · {cls.start_time ?? ''}</span>
              )}
              {(cls.center_name ?? cls.center?.name) && (
                <span>{cls.center_name ?? cls.center?.name}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'students' && <StudentsTab classId={classId} />}
      {tab === 'teachers' && <TeachersTab classId={classId} centerId={cls.center_id} />}
      {tab === 'criteria' && <HomeworkCriteriaTab classId={classId} courseId={cls.course_id} />}
      {tab === 'schedule' && <ScheduleTab cls={cls} />}
    </>
  );
}
