import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../../components/Button';
import Can from '../../../components/Can';
import RTLInput from '../../../components/RTLInput';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import { useToast } from '../../../hooks/useToast';
import {
  getTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  createSubtopic,
  updateSubtopic,
  deleteSubtopic,
} from '../../../api/courses';

const EMPTY_TOPIC = { title: '', title_ur: '', title_ar: '', description_ur: '', description: '', display_order: '' };
const EMPTY_SUB   = { title: '', title_ur: '', title_ar: '', display_order: '' };

function Field({ label, children }) {
  return (
    <div className="f-group" style={{ marginBottom: 14 }}>
      <label className="f-label">{label}</label>
      {children}
    </div>
  );
}

function ConfirmDelete({ message, onConfirm, onCancel }) {
  return (
    <div style={{ background: 'var(--red-light)', border: '1px solid var(--red)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span style={{ color: 'var(--red)', fontWeight: 500 }}>{message}</span>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={onCancel} style={{ background: 'none', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '4px 10px', fontSize: 11, color: 'var(--red)' }}>Cancel</button>
        <button onClick={onConfirm} style={{ background: 'var(--red)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '4px 10px', fontSize: 11, color: 'white' }}>Delete</button>
      </div>
    </div>
  );
}

// ── Subtopic row ──────────────────────────────────────────────────────────────
function SubtopicRow({ courseId, topicId, sub, onMutated }) {
  const toast = useToast();
  const [editing, setEditing]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm]         = useState({ title: sub.title ?? '', title_ur: sub.title_ur ?? '', title_ar: sub.title_ar ?? '', display_order: sub.display_order ?? '' });
  const [busy, setBusy]         = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateSubtopic(courseId, topicId, sub.id, form);
      onMutated();
      setEditing(false);
      toast.success('Subtopic updated.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to update subtopic.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteSubtopic(courseId, topicId, sub.id);
      onMutated();
      toast.success('Subtopic deleted.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to delete subtopic.');
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} style={{ background: 'var(--sand-light)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 6 }}>
        <Field label="Title (English)">
          <input className="f-input" value={form.title} onChange={set('title')} placeholder="Subtopic name" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <Field label="Urdu">
            <RTLInput value={form.title_ur} onChange={set('title_ur')} placeholder="اردو" />
          </Field>
          <Field label="Arabic">
            <RTLInput value={form.title_ar} onChange={set('title_ar')} placeholder="عربي" />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={busy}>Cancel</Button>
          <Button type="submit" size="sm" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    );
  }

  if (deleting) {
    return (
      <div style={{ marginBottom: 6 }}>
        <ConfirmDelete
          message={`Delete subtopic "${sub.title_ur || sub.title}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(false)}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--sand-light)', marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--ink-pale)', minWidth: 20 }}>{sub.display_order}.</span>
      <span style={{ fontSize: 12, color: 'var(--ink)', flex: 1 }}>{sub.title}</span>
      {sub.title_ur && (
        <span style={{ fontSize: 12, fontFamily: 'var(--font-display)', direction: 'rtl', color: 'var(--ink-soft)' }}>{sub.title_ur}</span>
      )}
      <Can permission="topics.edit">
        <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-pale)', fontSize: 12, padding: '2px 6px' }} title="Edit">✎</button>
      </Can>
      <Can permission="topics.delete">
        <button onClick={() => setDeleting(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 12, padding: '2px 6px' }} title="Delete">✕</button>
      </Can>
    </div>
  );
}

// ── Add subtopic form ─────────────────────────────────────────────────────────
function AddSubtopicForm({ courseId, topicId, nextOrder, onMutated, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...EMPTY_SUB, display_order: nextOrder });
  const [busy, setBusy] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await createSubtopic(courseId, topicId, form);
      onMutated();
      onCancel();
      toast.success('Subtopic added.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to add subtopic.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: 'var(--sand-mid)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginTop: 6 }}>
      <Field label="Title (English)">
        <input className="f-input" value={form.title} onChange={set('title')} placeholder="Subtopic name" required />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        <Field label="Urdu">
          <RTLInput value={form.title_ur} onChange={set('title_ur')} placeholder="اردو" />
        </Field>
        <Field label="Arabic">
          <RTLInput value={form.title_ar} onChange={set('title_ar')} placeholder="عربي" />
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" size="sm" variant="primary" disabled={busy}>{busy ? 'Adding…' : 'Add subtopic'}</Button>
      </div>
    </form>
  );
}

// ── Topic panel (right side) ──────────────────────────────────────────────────
function TopicPanel({ courseId, topic, onMutated }) {
  const toast    = useToast();
  const [editing, setEditing]     = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [busy, setBusy]           = useState(false);
  const [form, setForm] = useState({
    title:          topic.title          ?? '',
    title_ur:       topic.title_ur       ?? '',
    title_ar:       topic.title_ar       ?? '',
    description_ur: topic.description_ur ?? '',
    description:    topic.description    ?? '',
    display_order:  topic.display_order  ?? '',
  });

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateTopic(courseId, topic.id, form);
      onMutated();
      setEditing(false);
      toast.success('Topic updated.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to update topic.');
    } finally {
      setBusy(false);
    }
  }

  const subtopics = topic.subtopics ?? [];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{topic.title}</div>
          {topic.title_ur && (
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink-soft)', direction: 'rtl', marginBottom: 4 }}>{topic.title_ur}</div>
          )}
          {topic.description && (
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>{topic.description}</div>
          )}
          {topic.description_ur && (
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', direction: 'rtl', textAlign: 'right', marginBottom: 4 }}>{topic.description_ur}</div>
          )}
        </div>
        {!editing && (
          <Can permission="topics.edit">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit topic</Button>
          </Can>
        )}
      </div>

      {editing && (
        <form onSubmit={handleSave} style={{ background: 'var(--sand-light)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 16, flexShrink: 0 }}>
          <Field label="Title (English)">
            <input className="f-input" value={form.title} onChange={set('title')} placeholder="Topic name" required />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Field label="Urdu">
              <RTLInput value={form.title_ur} onChange={set('title_ur')} placeholder="اردو" />
            </Field>
            <Field label="Arabic">
              <RTLInput value={form.title_ar} onChange={set('title_ar')} placeholder="عربي" />
            </Field>
          </div>
          <Field label="Description (English)">
            <textarea
              className="f-input"
              rows={2}
              value={form.description}
              onChange={set('description')}
              placeholder="English description"
              style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}
            />
          </Field>
          <Field label="Description (Urdu)">
            <RTLInput multiline rows={2} value={form.description_ur} onChange={set('description_ur')} placeholder="تفصیل" />
          </Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" size="sm" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save topic'}</Button>
          </div>
        </form>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Subtopics ({subtopics.length})
          </span>
          {!addingSub && (
            <Can permission="topics.create">
              <Button size="sm" variant="ghost" onClick={() => setAddingSub(true)}>+ Add subtopic</Button>
            </Can>
          )}
        </div>

        {subtopics.length === 0 && !addingSub && (
          <p style={{ fontSize: 12, color: 'var(--ink-pale)', textAlign: 'center', padding: '16px 0' }}>
            No subtopics yet. Add one to break this topic into finer units.
          </p>
        )}

        {subtopics.map((s) => (
          <SubtopicRow
            key={s.id}
            courseId={courseId}
            topicId={topic.id}
            sub={s}
            onMutated={onMutated}
          />
        ))}

        {addingSub && (
          <AddSubtopicForm
            courseId={courseId}
            topicId={topic.id}
            nextOrder={subtopics.length + 1}
            onMutated={onMutated}
            onCancel={() => setAddingSub(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── Add topic form ────────────────────────────────────────────────────────────
function AddTopicForm({ courseId, nextOrder, onMutated, onCancel }) {
  const toast   = useToast();
  const [form, setForm] = useState({ ...EMPTY_TOPIC, display_order: nextOrder });
  const [busy, setBusy] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await createTopic(courseId, form);
      onMutated();
      onCancel();
      toast.success('Topic added.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to add topic.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: 'var(--sand-light)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 10 }}>
      <Field label="Title (English)">
        <input className="f-input" value={form.title} onChange={set('title')} placeholder="Topic name" required />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        <Field label="Urdu">
          <RTLInput value={form.title_ur} onChange={set('title_ur')} placeholder="اردو" />
        </Field>
        <Field label="Arabic">
          <RTLInput value={form.title_ar} onChange={set('title_ar')} placeholder="عربي" />
        </Field>
      </div>
      <Field label="Description (English)">
        <textarea
          className="f-input"
          rows={2}
          value={form.description}
          onChange={set('description')}
          placeholder="English description"
          style={{ fontFamily: 'var(--font-body)', fontSize: 13 }}
        />
      </Field>
      <Field label="Description (Urdu) — تفصیل">
        <RTLInput multiline rows={2} value={form.description_ur} onChange={set('description_ur')} placeholder="تفصیل" />
      </Field>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" size="sm" variant="primary" disabled={busy}>{busy ? 'Adding…' : 'Add topic'}</Button>
      </div>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TopicManager({ courseId }) {
  const qc    = useQueryClient();
  const toast = useToast();

  const [selectedId, setSelectedId] = useState(null);
  const [addingTopic, setAddingTopic] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data: topics = [], isLoading } = useQuery({
    queryKey:  ['topics', courseId],
    queryFn:   () => getTopics(courseId),
    staleTime: 2 * 60_000,
    enabled:   !!courseId,
  });

  function refetch() {
    qc.invalidateQueries({ queryKey: ['topics', courseId] });
  }

  const selected = topics.find((t) => t.id === selectedId) ?? topics[0] ?? null;

  async function handleDeleteTopic(topic) {
    setBusy(true);
    try {
      await deleteTopic(courseId, topic.id);
      refetch();
      if (selectedId === topic.id) setSelectedId(null);
      toast.success('Topic removed.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to delete topic.');
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <LoadingSpinner size={28} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 0, height: 560, border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      {/* Left: topic list */}
      <div style={{ width: '40%', borderRight: '1px solid var(--sand-mid)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--sand-mid)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Topics ({topics.length})</span>
          {!addingTopic && (
            <Can permission="topics.create">
              <Button size="sm" variant="ghost" onClick={() => setAddingTopic(true)}>+ Add</Button>
            </Can>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
          {addingTopic && (
            <AddTopicForm
              courseId={courseId}
              nextOrder={topics.length + 1}
              onMutated={refetch}
              onCancel={() => setAddingTopic(false)}
            />
          )}

          {topics.length === 0 && !addingTopic && (
            <EmptyState
              icon="◈"
              title="No topics yet"
              description="Add the first topic to start building the curriculum."
            />
          )}

          {topics.map((topic) => (
            <div key={topic.id}>
              <div
                onClick={() => setSelectedId(topic.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  background: (selected?.id === topic.id) ? 'var(--emerald-light)' : 'transparent',
                  marginBottom: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--ink-pale)', minWidth: 22, textAlign: 'right' }}>
                  {topic.display_order}.
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {topic.title}
                  </div>
                  {topic.title_ur && (
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', direction: 'rtl', textAlign: 'right' }}>
                      {topic.title_ur}
                    </div>
                  )}
                  {(topic.subtopics?.length ?? 0) > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--ink-pale)', marginTop: 2 }}>
                      {topic.subtopics.length} subtopic{topic.subtopics.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
                <Can permission="topics.delete">
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(topic); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-pale)', fontSize: 12, padding: '2px 4px', flexShrink: 0 }}
                    title="Delete topic"
                  >
                    ✕
                  </button>
                </Can>
              </div>

              {confirmDelete?.id === topic.id && (
                <div style={{ marginBottom: 6, padding: '0 4px' }}>
                  <ConfirmDelete
                    message={`Delete "${topic.title_ur || topic.title}" and all its subtopics?`}
                    onConfirm={() => handleDeleteTopic(topic)}
                    onCancel={() => setConfirmDelete(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: subtopic editor */}
      <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>
        {selected ? (
          <TopicPanel courseId={courseId} topic={selected} onMutated={refetch} />
        ) : (
          <EmptyState
            icon="◈"
            title="Select a topic"
            description="Click a topic on the left to manage its subtopics."
          />
        )}
      </div>
    </div>
  );
}
