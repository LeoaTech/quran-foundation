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
import { getCourses } from '../../../api/courses';

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

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'topics', label: 'Topics' },
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
            {course.difficulty_level && (
              <span className={`chip chip-${course.difficulty_level === 'beginner' ? 'green' : course.difficulty_level === 'intermediate' ? 'gold' : 'red'}`}>
                {course.difficulty_level === 'beginner' ? 'Beginner' : course.difficulty_level === 'intermediate' ? 'Intermediate' : 'Advanced'}
              </span>
            )}
            {!course.is_active && <span className="chip chip-red" style={{ fontSize: 10 }}>Inactive</span>}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--ink-soft)', marginTop: 4, marginBottom: 8, alignItems: 'center' }}>
            {course.duration_months && (
              <span>⏱ <strong>Duration:</strong> {course.duration_months} month{course.duration_months !== 1 ? 's' : ''}</span>
            )}
            {course.fee != null && (
              <span>₨ <strong>Fee:</strong> {Number(course.fee).toLocaleString()} PKR</span>
            )}
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
      {tab === 'classes' && <ClassesTab courseId={courseId} />}
    </>
  );
}
