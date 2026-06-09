const COLOR = {
  green: { topBar: "var(--emerald-bright)", value: "var(--emerald)" },
  gold: { topBar: "var(--gold)", value: "var(--gold)" },
  blue: { topBar: "var(--blue)", value: "var(--blue)" },
  neutral: { topBar: "var(--sand-deep)", value: "var(--ink-mid)" }
};

/**
 * @param {'green'|'gold'|'blue'|'neutral'} [variant='neutral']
 */
export default function MetricCard({
  label,
  value,
  sub,
  variant = "neutral",
  style
}) {
  const c = COLOR[variant] ?? COLOR.neutral;

  return (
    <div
      className={`metric-card ${variant}`}
      style={{
        background: "var(--white)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        border: "1px solid var(--sand-mid)",
        position: "relative",
        overflow: "hidden",
        ...style
      }}
    >
      {/* 3px top colour bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          background: c.topBar
        }}
      />

      <div className="metric-label">{label}</div>
      <div className={`metric-value ${variant}`}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}
