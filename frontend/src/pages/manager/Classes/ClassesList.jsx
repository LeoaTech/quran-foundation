import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import Button from '../../../components/Button';
import Can from '../../../components/Can';
import Badge from '../../../components/Badge';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import AddClassModal from './AddClassModal';
import { getClasses } from '../../../api/classes';
import { getCourses } from '../../../api/courses';
import { getCenter } from '../../../api/centers';

const TYPE_CHIP = {
  hifz:    { label: 'Hifz',    cls: 'chip chip-green' },
  nazra:   { label: 'Nazra',   cls: 'chip chip-blue'  },
  tajweed: { label: 'Tajweed', cls: 'chip chip-gold'  },
  arabic:  { label: 'Arabic',  cls: 'chip chip-sand'  },
};

function capacityColor(enrolled, max) {
  if (!max) return 'var(--ink-mid)';
  const pct = enrolled / max;
  if (pct >= 1)   return 'var(--red)';
  if (pct >= 0.8) return 'var(--amber)';
  return 'var(--emerald)';
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  let hours = parseInt(h, 10);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;
  return `${hours}:${m} ${suffix}`;
}

function thStyle() {
  return { textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 14px 10px', borderBottom: '1px solid var(--sand-mid)' };
}

function tdStyle(hasBorder = true) {
  return { padding: '11px 14px', fontSize: 13, color: 'var(--ink-mid)', borderBottom: hasBorder ? '1px solid var(--sand)' : 'none', verticalAlign: 'middle' };
}

export default function ClassesList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const centerId = user?.center_id;

  const [addOpen, setAddOpen]     = useState(false);
  const [courseFilter, setCourse] = useState('');
  const [showAll, setShowAll]     = useState(false);

  const { data: center } = useQuery({
    queryKey: ['center', centerId],
    queryFn:  () => getCenter(centerId),
    staleTime: 10 * 60_000,
    enabled:  !!centerId,
  });

  const { data: coursesRaw = [] } = useQuery({
    queryKey: ['courses'],
    queryFn:  getCourses,
    staleTime: 5 * 60_000,
  });

  const { data: classesRaw = [], isLoading, error } = useQuery({
    queryKey: ['classes', centerId, courseFilter, showAll],
    queryFn:  () => getClasses(centerId, {
      ...(courseFilter ? { course_id: courseFilter } : {}),
      ...(!showAll    ? { is_active: true }          : {}),
    }),
    staleTime: 60_000,
    enabled:  !!centerId,
  });

  const classes  = classesRaw?.data ?? classesRaw ?? [];
  const courses  = coursesRaw?.data ?? coursesRaw ?? [];
  const centerName = center?.name ?? 'My Center';

  if (!centerId) {
    return (
      <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13 }}>
        No center assigned to your account.
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13 }}>
        Failed to load classes.
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
            Classes — {centerName}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            {classes.length} class{classes.length !== 1 ? 'es' : ''}
            {!showAll ? ' (active)' : ''}
          </p>
        </div>
        <Can permission="classes.create">
          <Button variant="primary" onClick={() => setAddOpen(true)}>+ Add class</Button>
        </Can>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <select
          className="f-select"
          style={{ width: 180 }}
          value={courseFilter}
          onChange={(e) => setCourse(e.target.value)}
        >
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1.5px solid var(--sand-deep)' }}>
          {[{ label: 'Active', value: false }, { label: 'All', value: true }].map(({ label, value }) => (
            <button
              key={label}
              onClick={() => setShowAll(value)}
              style={{
                padding: '8px 16px',
                fontSize: 12, fontWeight: 500,
                background: showAll === value ? 'var(--emerald-light)' : 'var(--white)',
                color: showAll === value ? 'var(--emerald)' : 'var(--ink-soft)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <LoadingSpinner size={32} />
        </div>
      ) : classes.length === 0 ? (
        <EmptyState
          icon="◈"
          title="No classes found"
          description={courseFilter ? 'No classes for this course.' : 'Create the first class section for this center.'}
          action={<Button variant="primary" onClick={() => setAddOpen(true)}>+ Add class</Button>}
        />
      ) : (
        <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Class name', 'Course', 'Teacher', 'Schedule', 'Students / Cap.', 'Status', ''].map((h) => (
                  <th key={h} style={thStyle()}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classes.map((cls, i) => {
                const isLast   = i === classes.length - 1;
                const enrolled = cls.enrolled_count ?? cls.student_count ?? 0;
                const cap      = cls.max_capacity;
                const capColor = capacityColor(enrolled, cap);
                const courseType = cls.course_type ?? cls.course?.type;
                const chip = TYPE_CHIP[courseType] ?? null;

                return (
                  <tr
                    key={cls.id}
                    onClick={() => navigate(`/manager/classes/${cls.id}`)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.querySelectorAll('td').forEach((td) => (td.style.background = 'var(--sand)'))}
                    onMouseLeave={(e) => e.currentTarget.querySelectorAll('td').forEach((td) => (td.style.background = ''))}
                  >
                    <td style={tdStyle(!isLast)}>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{cls.name}</div>
                      {cls.name_ur && (
                        <div style={{ fontSize: 11, color: 'var(--ink-pale)', direction: 'rtl', textAlign: 'right', fontFamily: 'var(--font-display)' }}>{cls.name_ur}</div>
                      )}
                    </td>
                    <td style={tdStyle(!isLast)}>
                      <div style={{ fontWeight: 500, color: 'var(--ink)' }}>
                        {cls.course_name ?? cls.course?.name ?? '—'}
                        {chip && <span className={chip.cls} style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px' }}>{chip.label}</span>}
                      </div>
                      {cls.course_level_title && (
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                          {cls.course_level_title}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle(!isLast)}>
                      <span style={{ fontSize: 12 }}>{cls.primary_teacher_name ?? '—'}</span>
                    </td>
                    <td style={tdStyle(!isLast)}>
                      {cls.schedule_days && (
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {cls.schedule_days.split(',').map((d) => (
                            <span key={d} style={{ fontSize: 10, padding: '2px 6px', background: 'var(--sand-mid)', borderRadius: 'var(--radius-sm)', color: 'var(--ink-soft)' }}>{d.trim()}</span>
                          ))}
                        </div>
                      )}
                      {cls.start_time && (
                        <div style={{ fontSize: 11, color: 'var(--ink-pale)', marginTop: 3 }}>{formatTime(cls.start_time)}</div>
                      )}
                    </td>
                    <td style={tdStyle(!isLast)}>
                      <span style={{ fontWeight: 600, color: capColor }}>
                        {enrolled}
                      </span>
                      {cap ? (
                        <span style={{ fontSize: 12, color: 'var(--ink-pale)' }}> / {cap}</span>
                      ) : null}
                    </td>
                    <td style={tdStyle(!isLast)}>
                      <Badge variant={cls.is_active ? 'green' : 'sand'}>
                        {cls.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td style={tdStyle(!isLast)} onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/manager/classes/${cls.id}`)}>
                        View →
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddClassModal
        open={addOpen}
        centerId={centerId}
        onClose={() => setAddOpen(false)}
      />
    </>
  );
}
