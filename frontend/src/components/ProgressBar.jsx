const FILL_COLOR = {
  green:   'linear-gradient(90deg, var(--emerald), var(--emerald-bright))',
  gold:    'var(--gold)',
  blue:    'var(--blue)',
  neutral: 'var(--sand-deep)',
  red:     'var(--red)',
};

/**
 * @param {number} value 0–100
 * @param {'green'|'gold'|'blue'|'neutral'|'red'} [variant='green']
 * @param {number} [height=6]
 */
export default function ProgressBar({ value = 0, variant = 'green', height = 6, style }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      style={{
        height,
        background: 'var(--sand-mid)',
        borderRadius: 99,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${clamped}%`,
          borderRadius: 99,
          background: FILL_COLOR[variant] ?? FILL_COLOR.green,
          transition: 'width 0.6s ease',
        }}
      />
    </div>
  );
}
