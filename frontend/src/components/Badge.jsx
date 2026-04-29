const STYLES = {
  green:  { background: 'var(--emerald-light)', color: 'var(--emerald)' },
  gold:   { background: 'var(--gold-light)',    color: 'var(--amber)' },
  blue:   { background: 'var(--blue-light)',    color: 'var(--blue)' },
  red:    { background: 'var(--red-light)',     color: 'var(--red)' },
  sand:   { background: 'var(--sand-mid)',      color: 'var(--ink-soft)' },
  purple: { background: '#ede9fe',              color: '#5b21b6' },
};

/**
 * Chip / Badge component.
 * @param {'green'|'gold'|'blue'|'red'|'sand'|'purple'} [variant='sand']
 */
export default function Badge({ variant = 'sand', children, style, ...rest }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 11,
        fontWeight: 500,
        padding: '3px 9px',
        borderRadius: 999,
        ...(STYLES[variant] ?? STYLES.sand),
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
