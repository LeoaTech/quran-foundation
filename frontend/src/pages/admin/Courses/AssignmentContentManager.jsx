import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../../components/Button';
import Can from '../../../components/Can';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import RTLInput from '../../../components/RTLInput';
import { useToast } from '../../../hooks/useToast';
import {
  getTopics,
  getHomeworkContent,
  createHomeworkContent,
  updateHomeworkContent,
  deleteHomeworkContent,
} from '../../../api/courses';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SURAH_NAMES = {
  1: 'Al-Fatiha', 2: 'Al-Baqarah', 3: 'Aal-Imran', 4: 'An-Nisa',
  5: 'Al-Maidah', 36: 'Ya-Sin', 55: 'Ar-Rahman', 67: 'Al-Mulk',
  112: 'Al-Ikhlas', 113: 'Al-Falaq', 114: 'An-Nas',
};

function surahLabel(n) {
  return n ? `${SURAH_NAMES[n] ?? `Surah ${n}`} (${n})` : '';
}

// ── Subtopic Badge (shown on word cards in read view) ───────────────────────
function SubtopicBadge({ subtopicId, topics }) {
  // subtopicId may be a subtopic id — search across all subtopics
  let label = null;
  for (const t of topics) {
    const sub = (t.subtopics ?? []).find((s) => s.id === subtopicId);
    if (sub) { label = sub.title_ur || sub.title; break; }
    // fallback: maybe it is a topic id itself
    if (t.id === subtopicId) { label = t.title_ur || t.title; break; }
  }
  if (!label) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', fontSize: 11, fontWeight: 600,
      background: 'var(--emerald-tint, #e6f4f0)',
      color: 'var(--emerald, #1a9b6c)',
      border: '1px solid var(--emerald-light, #b5dfd2)',
      borderRadius: 20, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── Topic Tag Badge (kept for legacy) ─────────────────────────────────────────
function TopicBadge({ topicId, topics }) {
  const topic = topics.find((t) => t.id === topicId);
  if (!topic) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', fontSize: 11, fontWeight: 600,
      background: 'var(--emerald-tint, #e6f4f0)',
      color: 'var(--emerald, #1a9b6c)',
      border: '1px solid var(--emerald-light, #b5dfd2)',
      borderRadius: 20, whiteSpace: 'nowrap',
    }}>
      {topic.title_ur || topic.title}
    </span>
  );
}

// ── Inline Word Row ────────────────────────────────────────────────────────────
// Per-rule marks_per_rule + occurrence_count directly on each word.
function WordRow({ word, idx, subtopics, onChange, onRemove, disabled }) {
  const ruleDetails = word.rule_details ?? [];

  const handleToggle = (ruleId) => {
    const current = word.topic_ids ?? [];
    const currentDetails = [...ruleDetails];
    let nextIds, nextDetails;
    if (current.includes(ruleId)) {
      nextIds = current.filter((id) => id !== ruleId);
      nextDetails = currentDetails.filter((rd) => rd.subtopic_id !== ruleId);
    } else {
      nextIds = [...current, ruleId];
      nextDetails = [...currentDetails, { subtopic_id: ruleId, marks_per_rule: 1, occurrence_count: 1 }];
    }
    onChange({ ...word, topic_ids: nextIds, rule_details: nextDetails });
  };

  const handleRuleDetailChange = (ruleId, field, value) => {
    const nextDetails = ruleDetails.map((rd) =>
      rd.subtopic_id === ruleId ? { ...rd, [field]: Math.max(field === 'marks_per_rule' ? 0 : 1, value) } : rd
    );
    onChange({ ...word, rule_details: nextDetails });
  };

  // Compute word total marks
  let wordTotal = 0;
  for (const rd of ruleDetails) {
    wordTotal += (rd.marks_per_rule ?? 0) * (rd.occurrence_count ?? 1);
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      padding: '14px 16px', background: '#ffffff',
      borderRadius: 12, marginBottom: 12,
      border: '1.5px solid var(--border, #e5e7eb)',
      boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
    }}>
      {/* ── Row 1: Word + Notes (Adjacent) ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Index */}
        <span style={{
          width: 26, height: 26, borderRadius: '50%', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--emerald, #1a9b6c)', color: '#fff',
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>{idx + 1}</span>

        {/* Word Input */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <RTLInput
            value={word.word_text}
            onChange={(e) => onChange({ ...word, word_text: e.target.value })}
            placeholder="الكلمة (Word)"
            disabled={disabled}
            style={{
              width: '100%', fontSize: 20, fontWeight: 700,
              textAlign: 'right', fontFamily: 'var(--font-arabic, serif)',
              padding: '6px 12px', borderRadius: 8,
              border: '1px solid var(--border, #d1d5db)', background: '#fafafa',
            }}
          />
        </div>

        {/* Notes Input (adjacent to word) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <RTLInput
            value={word.note ?? ''}
            onChange={(e) => onChange({ ...word, note: e.target.value })}
            placeholder="نوٹ / تفصیلا ت (مخرج ، تحریک ، ترقیق...)"
            disabled={disabled}
            style={{
              width: '100%', fontSize: 13, padding: '8px 12px',
              borderRadius: 8, border: '1px solid var(--border, #d1d5db)',
              background: '#fff', color: 'var(--ink, #111)',
            }}
          />
        </div>

        {/* Word Total Marks Badge */}
        {wordTotal > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--emerald, #1a9b6c)',
            padding: '4px 10px', background: '#d1fae5', borderRadius: 20,
            whiteSpace: 'nowrap', border: '1px solid #a7f3d0', flexShrink: 0,
          }}>
            📐 {wordTotal} mark{wordTotal !== 1 ? 's' : ''}
          </span>
        )}

        {/* Remove Button */}
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          title="Remove word"
          style={{
            width: 28, height: 28, borderRadius: '50%',
            border: 'none', background: 'var(--fill-danger, #fee2e2)',
            color: 'var(--red, #dc2626)', cursor: 'pointer',
            fontSize: 16, lineHeight: 1, display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >×</button>
      </div>

      {/* ── Row 2: Selected Rule Tags & Marks Breakdown ─────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        paddingTop: 6, borderTop: '1px dashed #f0f0f0',
      }}>
        {/* Rule Selector Tag Pills */}
        {subtopics.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-pale, #9ca3af)', marginRight: 4 }}>
              Select Rules:
            </span>
            {subtopics.map((s) => {
              const active = (word.topic_ids ?? []).includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleToggle(s.id)}
                  disabled={disabled}
                  title={`Tag/untag rule: ${s.title}`}
                  style={{
                    padding: '3px 12px', fontSize: 11, fontWeight: 600,
                    borderRadius: 16, cursor: 'pointer', border: '1.5px solid',
                    background: active ? 'var(--emerald, #1a9b6c)' : 'transparent',
                    color: active ? '#fff' : 'var(--emerald, #1a9b6c)',
                    borderColor: 'var(--emerald, #1a9b6c)',
                    transition: 'all 0.15s ease',
                    boxShadow: active ? '0 1px 3px rgba(26,155,108,0.2)' : 'none',
                  }}
                >
                  {s.title_ur || s.title}
                </button>
              );
            })}
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--ink-pale)' }}>
            Select a primary topic above to choose subtopic rules for this word.
          </span>
        )}

        {/* Selected Rules Marks Configuration Strip */}
        {ruleDetails.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
            padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: 8, marginTop: 2,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--emerald, #1a9b6c)', marginRight: 2 }}>
              Marks per Rule:
            </span>
            {ruleDetails.map((rd) => {
              const sub = subtopics.find((s) => s.id === rd.subtopic_id);
              const label = sub ? (sub.title_ur || sub.title) : rd.subtopic_id.slice(0, 8);
              const mpr = rd.marks_per_rule ?? 1;
              const occ = rd.occurrence_count ?? 1;
              const ruleTotal = mpr * occ;
              return (
                <div key={rd.subtopic_id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', background: '#ffffff', borderRadius: 6,
                  border: '1px solid #a7f3d0', fontSize: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                }}>
                  <span style={{ fontWeight: 700, color: 'var(--emerald, #1a9b6c)' }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number" min={0} max={100}
                      value={mpr}
                      onChange={(e) => handleRuleDetailChange(rd.subtopic_id, 'marks_per_rule', Number(e.target.value))}
                      disabled={disabled}
                      style={{
                        width: 44, padding: '2px 4px', fontSize: 12, borderRadius: 4,
                        border: '1px solid #6ee7b7', textAlign: 'center', fontWeight: 600,
                        background: '#fafafa',
                      }}
                      title="Marks per rule occurrence"
                    />
                    <span style={{ color: 'var(--ink-pale)', fontSize: 10 }}>marks ×</span>
                    <input
                      type="number" min={1} max={50}
                      value={occ}
                      onChange={(e) => handleRuleDetailChange(rd.subtopic_id, 'occurrence_count', Number(e.target.value))}
                      disabled={disabled}
                      style={{
                        width: 44, padding: '2px 4px', fontSize: 12, borderRadius: 4,
                        border: '1px solid #6ee7b7', textAlign: 'center', fontWeight: 600,
                        background: '#fafafa',
                      }}
                      title="Occurrence count in this word"
                    />
                    <span style={{ color: 'var(--ink-pale)', fontSize: 10 }}>times =</span>
                    <span style={{ fontWeight: 700, color: '#047857', fontSize: 12 }}>
                      {ruleTotal}m
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Content Card (read view) ──────────────────────────────────────────────────
function ContentCard({ content, topics, onEdit, onDelete, canEdit }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      border: '1px solid var(--border, #e5e7eb)',
      borderRadius: 12, overflow: 'hidden',
      marginBottom: 14, background: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', cursor: 'pointer',
          background: 'var(--surface-0, #fafafa)',
          borderBottom: expanded ? '1px solid var(--border, #e5e7eb)' : 'none',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Arabic text */}
          <span style={{
            fontFamily: 'var(--font-arabic, serif)',
            fontSize: 22, direction: 'rtl', lineHeight: 1.5,
            color: 'var(--ink, #111)',
          }}>
            {content.arabic_text}
          </span>
          {/* Meta */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {(content.surah_number || content.ayah_number) && (
              <span style={{ fontSize: 12, color: 'var(--ink-soft, #6b7280)' }}>
                📖 {surahLabel(content.surah_number)}
                {content.ayah_number ? `, Ayah ${content.ayah_number}` : ''}
              </span>
            )}
            {content.topic_title && (
              <span style={{
                fontSize: 11, padding: '1px 8px', borderRadius: 20,
                background: 'var(--gold-tint, #fef9e7)',
                color: 'var(--gold, #b45309)',
                border: '1px solid var(--gold-light, #fde68a)',
                fontWeight: 600,
              }}>
                {content.topic_title_ur || content.topic_title}
              </span>
            )}
            <span style={{
              fontSize: 11, padding: '1px 8px', borderRadius: 20,
              background: 'var(--surface-1, #f3f4f5)',
              color: 'var(--ink-pale, #9ca3af)',
              border: '1px solid var(--border, #e5e7eb)',
            }}>
              {content.words?.length ?? 0} word{content.words?.length !== 1 ? 's' : ''}
            </span>
            {content.total_marks > 0 && (
              <span style={{
                fontSize: 11, padding: '1px 8px', borderRadius: 20,
                background: '#d1fae5', color: 'var(--emerald, #1a9b6c)',
                border: '1px solid #a7f3d0', fontWeight: 700,
              }}>
                📐 {content.total_marks} marks
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {canEdit && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(content); }}
                style={{ padding: '4px 12px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '1px solid var(--border-strong, #d1d5db)', background: '#fff', cursor: 'pointer' }}
              >Edit</button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(content); }}
                style={{ padding: '4px 12px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '1px solid var(--fill-danger, #fee2e2)', color: 'var(--red, #dc2626)', background: '#fff', cursor: 'pointer' }}
              >Delete</button>
            </>
          )}
          <span style={{ color: 'var(--ink-pale)', fontSize: 14 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded: word grid */}
      {expanded && (
        <div style={{ padding: '14px 18px' }}>
          {!content.words?.length && (
            <p style={{ fontSize: 13, color: 'var(--ink-pale)', textAlign: 'center', padding: '12px 0' }}>
              No words defined. Edit to add words.
            </p>
          )}
          {content.words?.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {content.words.map((w, idx) => {
                const ruleDetails = Array.isArray(w.rule_details) ? w.rule_details : [];
                let wordTotal = 0;
                for (const rd of ruleDetails) {
                  wordTotal += (rd.marks_per_rule ?? 0) * (rd.occurrence_count ?? 1);
                }
                return (
                  <div key={w.id} style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: '10px 14px', background: idx % 2 === 0 ? '#fafafa' : '#ffffff',
                    borderRadius: 8, border: '1px solid var(--border, #e5e7eb)',
                  }}>
                    {/* Row 1: Index + Word + Notes (Adjacent) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'var(--emerald, #1a9b6c)', color: '#fff',
                        fontSize: 11, fontWeight: 700, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>{idx + 1}</span>

                      <span style={{
                        fontFamily: 'var(--font-arabic, serif)', fontSize: 20, fontWeight: 700,
                        direction: 'rtl', color: 'var(--ink)', minWidth: 120,
                      }}>
                        {w.word_text}
                      </span>

                      {w.note && (
                        <span style={{
                          flex: 1, fontSize: 12, color: 'var(--ink-soft)', direction: 'rtl',
                          textAlign: 'right', fontFamily: 'var(--font-display)', background: '#f8fafc',
                          padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
                        }}>
                          📝 {w.note}
                        </span>
                      )}

                      {wordTotal > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: 'var(--emerald)',
                          background: '#d1fae5', padding: '2px 8px', borderRadius: 12, flexShrink: 0,
                        }}>
                          📐 {wordTotal} mark{wordTotal !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Row 2: Subtopics & Rule Marks */}
                    {(w.topic_ids?.length > 0 || ruleDetails.length > 0) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 11, paddingTop: 2 }}>
                        {(Array.isArray(w.topic_ids) ? w.topic_ids : []).map((sid) => (
                          <SubtopicBadge key={sid} subtopicId={sid} topics={topics} />
                        ))}

                        {ruleDetails.map((rd) => {
                          const sub = topics.flatMap((t) => t.subtopics ?? []).find((s) => s.id === rd.subtopic_id);
                          const lbl = sub ? (sub.title_ur || sub.title) : '?';
                          const mpr = rd.marks_per_rule ?? 1;
                          const occ = rd.occurrence_count ?? 1;
                          return (
                            <span key={rd.subtopic_id} style={{
                              padding: '2px 8px', background: '#e6f4f0', color: '#065f46',
                              borderRadius: 6, border: '1px solid #a7f3d0', fontSize: 11, fontWeight: 600,
                            }}>
                              {lbl}: {mpr}×{occ} = {mpr * occ}m
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Content Form (create / edit) ──────────────────────────────────────────────
function ContentForm({ courseId, topics, initialData, onSave, onCancel }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const [surahNumber, setSurahNumber] = useState(initialData?.surah_number ?? '');
  const [ayahNumber, setAyahNumber]   = useState(initialData?.ayah_number ?? '');
  const [arabicText, setArabicText]   = useState(initialData?.arabic_text ?? '');
  const [label, setLabel]             = useState(initialData?.label ?? '');
  const [topicId, setTopicId]         = useState(initialData?.topic_id ?? '');
  const [words, setWords]             = useState(
    initialData?.words?.map((w) => ({
      ...w,
      topic_ids:    Array.isArray(w.topic_ids) ? w.topic_ids : JSON.parse(w.topic_ids ?? '[]'),
      rule_details: Array.isArray(w.rule_details) ? w.rule_details : JSON.parse(w.rule_details ?? '[]'),
      note:         w.note ?? '',
    })) ?? []
  );

  // Subtopics of the selected primary topic — used as rule tags on individual words
  const activeSubtopics = topics.find((t) => t.id === topicId)?.subtopics ?? [];

  // Compute grand total marks dynamically (from word-level marks_per_rule × occurrence_count)
  let grandTotal = 0;
  for (const w of words) {
    for (const rd of (w.rule_details ?? [])) {
      grandTotal += (rd.marks_per_rule ?? 0) * (rd.occurrence_count ?? 1);
    }
  }

  // Split arabic_text into words automatically — filter empty tokens
  function handleAutoSplit() {
    if (!arabicText.trim()) return;
    // Split on whitespace, remove empty strings (extra spaces, Zero Width Joiner, etc.)
    const parts = arabicText.trim().split(/\s+/).filter((p) => p.length > 0);
    if (parts.length === 0) { toast.error('No words found.'); return; }
    setWords(parts.map((text, i) => ({
      _localId: `new_${Date.now()}_${i}`,
      word_text: text,
      sequence_order: i + 1,
      topic_ids: [],
      rule_details: [],
      note: '',
    })));
    toast.success(`Split into ${parts.length} word${parts.length !== 1 ? 's' : ''}.`);
  }

  function addWord() {
    setWords([...words, { _localId: `new_${Date.now()}`, word_text: '', sequence_order: words.length + 1, topic_ids: [], rule_details: [], note: '' }]);
  }

  function updateWord(localIdx, updated) {
    setWords(words.map((w, i) => (i === localIdx ? updated : w)));
  }

  function removeWord(localIdx) {
    setWords(words.filter((_, i) => i !== localIdx));
  }

  async function handleSubmit() {
    if (!arabicText.trim()) {
      toast.error('Arabic text is required.');
      return;
    }
    if (words.some((w) => !w.word_text?.trim())) {
      toast.error('All words must have text.');
      return;
    }

    const payload = {
      surah_number:    surahNumber ? Number(surahNumber) : null,
      ayah_number:     ayahNumber ? Number(ayahNumber) : null,
      arabic_text:     arabicText.trim(),
      label:           label.trim() || null,
      topic_id:        topicId || null,
      words:           words.map((w, i) => ({
        word_text:      w.word_text.trim(),
        sequence_order: i + 1,
        topic_ids:      w.topic_ids ?? [],
        rule_details:   w.rule_details ?? [],
        note:           w.note || null,
      })),
    };

    setBusy(true);
    try {
      if (initialData?.id) {
        await updateHomeworkContent(courseId, initialData.id, payload);
        toast.success('Content updated.');
      } else {
        await createHomeworkContent(courseId, payload);
        toast.success('Content added.');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to save content.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border, #e5e7eb)',
      borderRadius: 12, padding: '20px 22px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
    }}>
      <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
        {initialData?.id ? 'Edit Content' : 'Add New Content (Verse / Dua / Namaz)'}
      </h3>

      {/* Row 1: Surah / Ayah */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--ink-soft)' }}>
            Surah Number <span style={{ fontWeight: 400, color: 'var(--ink-pale)', fontSize: 11 }}>(Optional)</span>
          </label>
          <input
            id="cw-surah-number"
            className="f-input"
            type="number" min="1" max="114"
            value={surahNumber}
            onChange={(e) => setSurahNumber(e.target.value)}
            placeholder="e.g. 1 "
            disabled={busy}
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--ink-soft)' }}>
            Ayah Number <span style={{ fontWeight: 400, color: 'var(--ink-pale)', fontSize: 11 }}>(Optional)</span>
          </label>
          <input
            id="cw-ayah-number"
            className="f-input"
            type="number" min="1"
            value={ayahNumber}
            onChange={(e) => setAyahNumber(e.target.value)}
            placeholder="e.g. 1 "
            disabled={busy}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Row 2: Topic + Label */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--ink-soft)' }}>
            Primary Topic / Module
            <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--ink-pale)', fontSize: 11 }}>(word tags will use its subtopics)</span>
          </label>
          <select
            id="cw-topic-id"
            className="f-input"
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            disabled={busy}
            style={{ width: '100%' }}
          >
            <option value="">— None —</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.title}{t.title_ur ? ` / ${t.title_ur}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--ink-soft)' }}>
            Label (Optional)
          </label>
          <input
            id="cw-label"
            className="f-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Bismillah"
            disabled={busy}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Arabic text */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--ink-soft)' }}>
          Arabic Text <span style={{ color: 'var(--red)' }}>*</span>
        </label>
        <RTLInput
          id="cw-arabic-text"
          value={arabicText}
          onChange={(e) => setArabicText(e.target.value)}
          placeholder="اكتب الآية هنا"
          disabled={busy}
          style={{ width: '100%', fontSize: 22, minHeight: 52 }}
        />
        <button
          onClick={handleAutoSplit}
          disabled={busy || !arabicText.trim()}
          style={{
            marginTop: 8, fontSize: 12, padding: '4px 14px',
            border: '1px solid var(--border-strong)', borderRadius: 6,
            background: 'var(--surface-1)', cursor: 'pointer', fontWeight: 500,
          }}
        >
          ✂ Auto-split into words
        </button>
      </div>

      {/* Words section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
            Words & Subtopic Rule Tags
            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)' }}>
              ({words.length} word{words.length !== 1 ? 's' : ''})
            </span>
          </label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{
              fontSize: 13, fontWeight: 700, color: 'var(--emerald)',
              padding: '4px 12px', background: '#d1fae5', borderRadius: 8,
            }}>
              📐 Grand Total: {grandTotal} marks
            </span>
            <button
              onClick={addWord}
              disabled={busy}
              style={{
                fontSize: 12, padding: '4px 12px',
                border: '1px solid var(--border-strong)', borderRadius: 6,
                background: 'var(--surface-1)', cursor: 'pointer', fontWeight: 600,
              }}
            >+ Add word</button>
          </div>
        </div>

        {words.length === 0 && (
          <div style={{
            padding: '20px', textAlign: 'center', borderRadius: 8,
            border: '1.5px dashed var(--border, #e5e7eb)', color: 'var(--ink-pale)',
            fontSize: 13,
          }}>
            No words yet. Use "Auto-split" or click "Add word" to add words manually.
          </div>
        )}

        {words.map((w, idx) => (
          <WordRow
            key={w.id ?? w._localId ?? idx}
            word={w}
            idx={idx}
            subtopics={activeSubtopics}
            onChange={(updated) => updateWord(idx, updated)}
            onRemove={() => removeWord(idx)}
            disabled={busy}
          />
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <button
          onClick={onCancel}
          disabled={busy}
          style={{
            padding: '7px 18px', fontSize: 13, fontWeight: 500,
            border: '1px solid var(--border-strong)', borderRadius: 8,
            background: '#fff', cursor: 'pointer',
          }}
        >Cancel</button>
        <button
          id="cw-save-content-btn"
          onClick={handleSubmit}
          disabled={busy}
          style={{
            padding: '7px 20px', fontSize: 13, fontWeight: 600,
            border: 'none', borderRadius: 8, cursor: 'pointer',
            background: 'var(--emerald, #1a9b6c)', color: '#fff',
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? 'Saving...' : (initialData?.id ? 'Update' : 'Save content')}
        </button>
      </div>
    </div>
  );
}

// ── Main Manager ─────────────────────────────────────────────────────────────
export default function AssignmentContentManager({ courseId }) {
  const qc   = useQueryClient();
  const toast = useToast();

  const [filterTopicId, setFilterTopicId]   = useState('');
  const [showForm, setShowForm]             = useState(false);
  const [editingContent, setEditingContent] = useState(null);
  const [deletingId, setDeletingId]         = useState(null);

  const { data: topics = [], isLoading: loadingTopics } = useQuery({
    queryKey: ['topics', courseId],
    queryFn: () => getTopics(courseId),
    staleTime: 3 * 60_000,
    enabled: !!courseId,
  });

  const { data: contentList = [], isLoading: loadingContent } = useQuery({
    queryKey: ['classworkContent', courseId, filterTopicId],
    queryFn: () => getHomeworkContent(courseId, filterTopicId ? { topic_id: filterTopicId } : {}),
    staleTime: 60_000,
    enabled: !!courseId,
  });

  function refetch() {
    qc.invalidateQueries({ queryKey: ['classworkContent', courseId] });
  }

  function handleEdit(content) {
    setEditingContent(content);
    setShowForm(true);
  }

  function handleFormSave() {
    setShowForm(false);
    setEditingContent(null);
    refetch();
  }

  function handleFormCancel() {
    setShowForm(false);
    setEditingContent(null);
  }

  async function handleDelete(content) {
    if (!window.confirm(`Delete "${content.arabic_text}"? This cannot be undone.`)) return;
    setDeletingId(content.id);
    try {
      await deleteHomeworkContent(courseId, content.id);
      toast.success('Content deleted.');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to delete.');
    } finally {
      setDeletingId(null);
    }
  }

  const isLoading = loadingTopics || loadingContent;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <div>
      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Topics', value: topics.length },
          { label: 'Verses added', value: contentList.length },
          { label: 'Words tagged', value: contentList.reduce((s, c) => s + (c.words?.length ?? 0), 0) },
          { label: 'Total Marks', value: contentList.reduce((s, c) => s + (c.total_marks ?? 0), 0) },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'var(--surface-1, #f3f4f5)', borderRadius: 8,
            padding: '14px 16px', textAlign: 'center',
            border: '1px solid var(--border, #e5e7eb)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--emerald, #1a9b6c)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      {!showForm && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <select
            id="cw-filter-topic"
            className="f-input"
            value={filterTopicId}
            onChange={(e) => setFilterTopicId(e.target.value)}
            style={{ width: 'auto', minWidth: 200, padding: '7px 10px', fontSize: 13 }}
          >
            <option value="">All topics</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.title}{t.title_ur ? ` / ${t.title_ur}` : ''}</option>
            ))}
          </select>

          <Can permission="courses.edit">
            <button
              id="cw-add-content-btn"
              onClick={() => { setEditingContent(null); setShowForm(true); }}
              style={{
                padding: '8px 18px', fontSize: 13, fontWeight: 600,
                border: 'none', borderRadius: 8, cursor: 'pointer',
                background: 'var(--emerald, #1a9b6c)', color: '#fff',
              }}
            >
              + Add verse / phrase
            </button>
          </Can>
        </div>
      )}

      {/* ── Form ── */}
      {showForm && (
        <div style={{ marginBottom: 24 }}>
          <ContentForm
            courseId={courseId}
            topics={topics}
            initialData={editingContent}
            onSave={handleFormSave}
            onCancel={handleFormCancel}
          />
        </div>
      )}

      {/* ── List ── */}
      {!showForm && (
        <>
          {contentList.length === 0 && (
            <EmptyState
              icon="📖"
              title="No classwork content yet"
              description="Add Quranic verses or phrases, then break them into words and tag each word with the rules being tested."
            />
          )}
          {contentList.map((content) => (
            <ContentCard
              key={content.id}
              content={content}
              topics={topics}
              onEdit={handleEdit}
              onDelete={handleDelete}
              canEdit={deletingId !== content.id}
            />
          ))}
        </>
      )}
    </div>
  );
}
