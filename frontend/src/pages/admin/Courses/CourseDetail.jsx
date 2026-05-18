import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardBody } from '../../../components/Card';
import Button from '../../../components/Button';
import Can from '../../../components/Can';
import RTLInput from '../../../components/RTLInput';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import Badge from '../../../components/Badge';
import { useToast } from '../../../hooks/useToast';
import TopicManager from './TopicManager';
import {
  getCourses,
  getCourseLevels,
  createCourseLevel,
  updateCourseLevel,
  getCourseFees,
  upsertLevelFee,
  deleteLevelFee,
} from '../../../api/courses';

const TYPE_CHIP = {
  hifz: { label: 'Hifz', cls: 'chip chip-green' },
  nazra: { label: 'Nazra', cls: 'chip chip-blue' },
  tajweed: { label: 'Tajweed', cls: 'chip chip-gold' },
  arabic: { label: 'Arabic', cls: 'chip chip-sand' },
};

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

// ── Levels tab ────────────────────────────────────────────────────────────────
function LevelsTab({ courseId }) {
  const qc = useQueryClient();
  const toast = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editLevel, setEditLevel] = useState(null);
  const [form, setForm] = useState({ title: '', title_ur: '', description_ur: '', level_order: '', duration_months: '' });
  const [busy, setBusy] = useState(false);

  const { data: levels = [], isLoading } = useQuery({
    queryKey: ['course-levels', courseId],
    queryFn: () => getCourseLevels(courseId),
    staleTime: 5 * 60_000,
  });

  function setF(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function openAdd() {
    setForm({ title: '', title_ur: '', description_ur: '', level_order: levels.length + 1, duration_months: '' });
    setEditLevel(null);
    setAddOpen(true);
  }

  function openEdit(level) {
    setForm({
      title: level.title ?? '',
      title_ur: level.title_ur ?? '',
      description_ur: level.description_ur ?? '',
      level_order: level.level_order ?? '',
      duration_months: level.duration_months ?? '',
    });
    setEditLevel(level);
    setAddOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        level_order: form.level_order !== '' ? Number(form.level_order) : undefined,
        duration_months: form.duration_months !== '' ? Number(form.duration_months) : undefined,
      };
      if (editLevel) {
        await updateCourseLevel(courseId, editLevel.id, payload);
        toast.success('Level updated.');
      } else {
        await createCourseLevel(courseId, payload);
        toast.success('Level added.');
      }
      await qc.invalidateQueries({ queryKey: ['course-levels', courseId] });
      setAddOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to save level.');
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={24} /></div>;
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Can permission="courses.edit">
          <Button size="sm" variant="primary" onClick={openAdd}>+ Add level</Button>
        </Can>
      </div>

      {addOpen && (
        <Card style={{ marginBottom: 20 }}>
          <CardHeader><span className="card-title">{editLevel ? 'Edit level' : 'New level'}</span></CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px', gap: '0 16px', alignItems: 'end' }}>
                <Field label="Order">
                  <input
                    className="f-input"
                    type="number"
                    min="1"
                    value={form.level_order}
                    onChange={setF('level_order')}
                    required
                  />
                </Field>
                <Field label="Title (English)">
                  <input className="f-input" value={form.title} onChange={setF('title')} placeholder="e.g. Beginner" required />
                </Field>
                <Field label="Duration (months)">
                  <input
                    className="f-input"
                    type="number"
                    min="1"
                    value={form.duration_months}
                    onChange={setF('duration_months')}
                    placeholder="e.g. 6"
                  />
                </Field>
              </div>
              <Field label="Title (Urdu) — اردو عنوان">
                <RTLInput value={form.title_ur} onChange={setF('title_ur')} placeholder="ابتدائی" />
              </Field>
              <Field label="Description (Urdu)">
                <RTLInput multiline rows={2} value={form.description_ur} onChange={setF('description_ur')} placeholder="تفصیل" />
              </Field>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <Button type="button" size="sm" variant="outline" onClick={() => setAddOpen(false)} disabled={busy}>Cancel</Button>
                <Button type="submit" size="sm" variant="primary" disabled={busy}>{busy ? 'Saving…' : editLevel ? 'Save changes' : 'Add level'}</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {levels.length === 0 && !addOpen ? (
        <EmptyState
          icon="◉"
          title="No levels defined"
          description="Add levels to differentiate student progress within this course."
          action={<Button size="sm" variant="primary" onClick={openAdd}>+ Add level</Button>}
        />
      ) : (
        <div style={{ border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Title</th>
                <th>Urdu title</th>
                <th>Duration</th>
                <th>Description</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {levels.map((lv) => (
                <tr key={lv.id}>
                  <td style={{ color: 'var(--ink-pale)', fontSize: 13 }}>{lv.level_order}</td>
                  <td style={{ fontWeight: 500 }}>{lv.title}</td>
                  <td style={{ fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right' }}>{lv.title_ur}</td>
                  <td style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                    {lv.duration_months ? `${lv.duration_months} months` : <span style={{ color: 'var(--ink-pale)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--ink-soft)', direction: 'rtl', textAlign: 'right' }}>{lv.description_ur}</td>
                  <td>
                    <Can permission="courses.edit">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(lv)}>Edit</Button>
                    </Can>
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

// ── Classes tab ───────────────────────────────────────────────────────────────
function ClassesTab({ courseId }) {
  // Cross-center classes for this course come from /centers/:id/classes?course_id=...
  // Without knowing all centers upfront, we show a placeholder that explains this
  // is managed per-center. The full cross-center view requires the centers list.
  return (
    <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--ink-soft)' }}>
      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>◈</div>
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: 'var(--ink)' }}>Classes are managed per center</div>
      <div style={{ fontSize: 13, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
        To view or create classes for this course, go to a specific center and use the Classes tab there. Each center manages its own class sections.
      </div>
    </div>
  );
}

// ── Fee Structure tab ─────────────────────────────────────────────────────────
function FeeStructureTab({ courseId, courseName }) {
  const qc = useQueryClient();
  const toast = useToast();

  const { data: levels = [], isLoading: levelsLoading } = useQuery({
    queryKey: ['course-levels', courseId],
    queryFn: () => getCourseLevels(courseId),
    staleTime: 5 * 60_000,
  });

  const { data: fees = [], isLoading: feesLoading } = useQuery({
    queryKey: ['course-fees', courseId],
    queryFn: () => getCourseFees(courseId),
    staleTime: 5 * 60_000,
  });

  // Map levelId → fee record for quick lookup
  const feeMap = Object.fromEntries(fees.map((f) => [f.course_level_id, f]));

  // Inline fee form state — keyed by levelId
  const [editingLevelId, setEditingLevelId] = useState(null);
  const [feeForm, setFeeForm] = useState({ full_fee: '', notes: '' });
  const [busy, setBusy] = useState(false);

  function openFeeForm(level) {
    const existing = feeMap[level.id];
    setFeeForm({
      full_fee: existing ? String(existing.full_fee) : '',
      notes: existing?.notes ?? '',
    });
    setEditingLevelId(level.id);
  }

  async function handleFeeSubmit(e, levelId) {
    e.preventDefault();
    setBusy(true);
    try {
      await upsertLevelFee(courseId, levelId, {
        full_fee: Number(feeForm.full_fee),
        notes: feeForm.notes || undefined,
      });
      toast.success('Fee saved.');
      await qc.invalidateQueries({ queryKey: ['course-fees', courseId] });
      setEditingLevelId(null);
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to save fee.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteFee(levelId) {
    if (!window.confirm('Remove this fee entry?')) return;
    setBusy(true);
    try {
      await deleteLevelFee(courseId, levelId);
      toast.success('Fee removed.');
      await qc.invalidateQueries({ queryKey: ['course-fees', courseId] });
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to remove fee.');
    } finally {
      setBusy(false);
    }
  }

  if (levelsLoading || feesLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={24} /></div>;
  }

  if (levels.length === 0) {
    return (
      <EmptyState
        icon="₨"
        title="No levels defined"
        description="Add levels to this course first before setting fee structures."
      />
    );
  }

  return (
    <>
      {/* Summary info badge */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <span className="chip chip-sand" style={{ fontSize: 11 }}>Cash</span>
      </div>

      <div style={{ border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 24 }}>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Course</th>
              <th>Level</th>
              <th>Full Fee</th>
              <th>Duration</th>
              <th style={{ width: 130 }}></th>
            </tr>
          </thead>
          <tbody>
            {levels.map((lv) => {
              const fee = feeMap[lv.id];
              const isEditing = editingLevelId === lv.id;
              return (
                <>
                  <tr key={lv.id}>
                    <td style={{ fontWeight: 500, fontSize: 13 }}>{courseName}</td>
                    <td>
                      <span className="chip chip-blue" style={{ fontSize: 11 }}>Level {lv.level_order}</span>
                      {' '}
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{lv.title}</span>
                    </td>
                    <td>
                      {fee ? (
                        <span style={{ fontWeight: 700, color: 'var(--emerald)', fontSize: 14 }}>
                          {fee.currency} {Number(fee.full_fee).toLocaleString()}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-pale)', fontSize: 12 }}>Not set</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                      {lv.duration_months ? `${lv.duration_months} months` : <span style={{ color: 'var(--ink-pale)' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <Button
                          size="sm"
                          variant={isEditing ? 'outline' : 'primary'}
                          onClick={() => isEditing ? setEditingLevelId(null) : openFeeForm(lv)}
                          disabled={busy}
                        >
                          {isEditing ? 'Cancel' : fee ? 'Edit Fee' : 'Set Fee'}
                        </Button>
                        {fee && !isEditing && (
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteFee(lv.id)} disabled={busy}>
                            Remove
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isEditing && (
                    <tr key={`${lv.id}-form`}>
                      <td colSpan={5} style={{ background: 'var(--sand-light)', padding: '16px 20px' }}>
                        <form onSubmit={(e) => handleFeeSubmit(e, lv.id)}>
                          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="f-group" style={{ marginBottom: 0, minWidth: 160 }}>
                              <label className="f-label">Full Fee (PKR)</label>
                              <input
                                className="f-input"
                                type="number"
                                min="1"
                                step="0.01"
                                value={feeForm.full_fee}
                                onChange={(e) => setFeeForm((f) => ({ ...f, full_fee: e.target.value }))}
                                placeholder="e.g. 8000"
                                required
                                autoFocus
                              />
                            </div>
                            <div className="f-group" style={{ marginBottom: 0, flex: 1, minWidth: 180 }}>
                              <label className="f-label">Notes (optional)</label>
                              <input
                                className="f-input"
                                value={feeForm.notes}
                                onChange={(e) => setFeeForm((f) => ({ ...f, notes: e.target.value }))}
                                placeholder="e.g. includes registration"
                              />
                            </div>
                            <Button type="submit" size="sm" variant="primary" disabled={busy}>
                              {busy ? 'Saving…' : 'Save Fee'}
                            </Button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'topics', label: 'Topics' },
  { id: 'levels', label: 'Levels' },
  { id: 'fees', label: 'Fee Structure' },
  { id: 'classes', label: 'Classes' },
];

export default function CourseDetail() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('topics');

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: getCourses,
    staleTime: 2 * 60_000,
  });

  const course = courses.find((c) => c.id === courseId);
  const chip = course ? (TYPE_CHIP[course.type] ?? { label: course.type, cls: 'chip chip-sand' }) : null;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13 }}>
        Course not found.
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <button
              onClick={() => navigate('/admin/courses')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-pale)', fontSize: 13, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              ← Courses
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2 }}>
              {course.name}
            </h2>
            <span className={chip.cls}>{chip.label}</span>
            {!course.is_active && <span className="chip chip-red" style={{ fontSize: 10 }}>Inactive</span>}
          </div>
          {course.name_ur && (
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-soft)', direction: 'rtl' }}>
              {course.name_ur}
            </div>
          )}
        </div>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'topics' && <TopicManager courseId={courseId} />}
      {tab === 'levels' && <LevelsTab courseId={courseId} />}
      {tab === 'fees' && <FeeStructureTab courseId={courseId} courseName={course.name} />}
      {tab === 'classes' && <ClassesTab courseId={courseId} />}
    </>
  );
}
