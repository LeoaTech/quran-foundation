const COLOR = {
  green:   { topBar: 'var(--emerald-bright)', value: 'var(--emerald)' },
  gold:    { topBar: 'var(--gold)',            value: 'var(--gold)' },
  blue:    { topBar: 'var(--blue)',            value: 'var(--blue)' },
  neutral: { topBar: 'var(--sand-deep)',       value: 'var(--ink-mid)' },
};

/**
 * @param {'green'|'gold'|'blue'|'neutral'} [variant='neutral']
 */
export default function MetricCard({ label, value, sub, variant = 'neutral', style }) {
  const c = COLOR[variant] ?? COLOR.neutral;

  return (
    <div
      style={{
        background: 'var(--white)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 22px',
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--sand-mid)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* 3px top colour bar */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 3,
          borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          background: c.topBar,
        }}
      />

      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, lineHeight: 1, marginBottom: 4, color: c.value }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: 'var(--ink-pale)' }}>{sub}</div>
      )}
    </div>
  );
}
