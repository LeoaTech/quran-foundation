import { useState, useEffect } from 'react';
import { useActivityLog } from '../../../hooks/useActivityLog';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import Button from '../../../components/Button';

// ── Role badge colours ────────────────────────────────────────────────────────

const ROLE_STYLES = {
  super_admin:    { background: '#ede9fe', color: '#5b21b6' },
  center_manager: { background: 'var(--emerald-light)', color: 'var(--emerald)' },
  teacher:        { background: 'var(--gold-light)',    color: 'var(--amber)' },
  student:        { background: 'var(--sand-mid)',      color: 'var(--ink-soft)' },
};

function RoleBadge({ role }) {
  const style = ROLE_STYLES[role] ?? { background: 'var(--sand-mid)', color: 'var(--ink-soft)' };
  const label = role ? role.replace(/_/g, ' ') : 'unknown';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        flexShrink: 0,
        ...style,
      }}
    >
      {label}
    </span>
  );
}

// ── Action icon map ───────────────────────────────────────────────────────────

const ACTION_ICONS = {
  'enrollment.create':     '👤',
  'enrollment.update':     '📝',
  'course.create':         '📚',
  'course.update':         '📚',
  'course_level.create':   '🎓',
  'course_level.update':   '🎓',
  'topic.create':          '📌',
  'topic.update':          '📌',
  'topic.delete':          '🗑',
  'fee.upsert':            '💰',
  'fee.delete':            '💰',
  'class.create':          '🏫',
  'class.update':          '🏫',
  'attendance.mark':       '✅',
  'attendance.correction': '🔧',
  'user.create':           '🙍',
  'user.role_assign':      '🔑',
  'center.create':         '🏢',
  'center.update':         '🏢',
};

function actionIcon(action) {
  return ACTION_ICONS[action] ?? '●';
}

// ── Relative time ─────────────────────────────────────────────────────────────

function relativeTime(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Filter options ────────────────────────────────────────────────────────────

const ACTION_FILTERS = [
  { value: '',            label: 'All actions' },
  { value: 'enrollment',  label: 'Enrollments' },
  { value: 'class',       label: 'Classes' },
  { value: 'course',      label: 'Courses & Levels' },
  { value: 'fee',         label: 'Fees' },
  { value: 'attendance',  label: 'Attendance' },
  { value: 'user',        label: 'Users' },
  { value: 'center',      label: 'Center' },
];

// ── Log row ───────────────────────────────────────────────────────────────────

function LogRow({ log, isLast }) {
  const abs = new Date(log.created_at).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 20px',
        borderBottom: isLast ? 'none' : '1px solid var(--sand-mid)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sand)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
    >
      {/* Icon bubble */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'var(--emerald-pale)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {actionIcon(log.action)}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Actor + role */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
            {log.actor_full_name}
          </span>
          <RoleBadge role={log.actor_role} />
        </div>

        {/* Summary */}
        <p style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5, marginBottom: 6 }}>
          {log.summary_en}
        </p>

        {/* Action tag + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--ink-pale)',
              background: 'var(--sand-mid)',
              padding: '2px 7px',
              borderRadius: 4,
              letterSpacing: '0.03em',
              fontFamily: 'monospace',
            }}
          >
            {log.action}
          </span>
          <span
            title={abs}
            style={{ fontSize: 12, color: 'var(--ink-pale)', cursor: 'default' }}
          >
            {relativeTime(log.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ActivityLogTab({ centerId }) {
  const [actionFilter, setActionFilter] = useState('');
  const [appliedFilter, setAppliedFilter] = useState('');

  const { logs, total, hasMore, isLoading, isFetching, error, loadMore, resetFilter } =
    useActivityLog(centerId, { action: appliedFilter || undefined });

  // When the filter changes reset accumulated pages
  useEffect(() => {
    resetFilter();
    setAppliedFilter(actionFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter]);

  return (
    <div>
      {/* ── Header bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--ink)',
              marginBottom: 2,
            }}
          >
            Activity Log
          </h2>
          <p style={{ fontSize: 12, color: 'var(--ink-pale)' }}>
            {total > 0 ? `${total} events recorded` : 'No events yet'}
            {isFetching && !isLoading && (
              <span style={{ marginLeft: 8, color: 'var(--emerald)' }}>↻ refreshing…</span>
            )}
          </p>
        </div>

        {/* Action filter dropdown */}
        <select
          id="activity-action-filter"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--ink-mid)',
            background: 'var(--white)',
            border: '1.5px solid var(--sand-mid)',
            borderRadius: 'var(--radius-sm)',
            padding: '7px 12px',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {ACTION_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* ── Feed card ── */}
      <div
        style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius-md)',
          border: '1.5px solid var(--sand-mid)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <LoadingSpinner size={28} />
          </div>
        ) : error ? (
          <EmptyState
            icon="⊙"
            title="Could not load activity"
            description="Something went wrong loading the activity log."
          />
        ) : logs.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No activity yet"
            description="Actions like enrollments, attendance, and course changes will appear here."
          />
        ) : (
          <>
            {logs.map((log, i) => (
              <LogRow key={log.id} log={log} isLast={i === logs.length - 1 && !hasMore} />
            ))}

            {/* Load more */}
            {hasMore && (
              <div
                style={{
                  padding: '14px 20px',
                  borderTop: '1px solid var(--sand-mid)',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <Button
                  id="activity-load-more"
                  variant="outline"
                  size="sm"
                  disabled={isFetching}
                  onClick={loadMore}
                >
                  {isFetching ? 'Loading…' : `Load more (${total - logs.length} remaining)`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Auto-refresh note */}
      <p
        style={{
          fontSize: 11,
          color: 'var(--ink-pale)',
          marginTop: 10,
          textAlign: 'right',
        }}
      >
        Auto-refreshes every 30 seconds
      </p>
    </div>
  );
}
