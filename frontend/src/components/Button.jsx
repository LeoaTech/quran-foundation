const SIZE = {
  sm: { padding: '6px 14px', fontSize: 12 },
  md: { padding: '9px 18px', fontSize: 13 },
  lg: { padding: '12px 24px', fontSize: 14 },
};

const VARIANT = {
  primary: {
    background: 'var(--emerald)',
    color: 'var(--white)',
    border: 'none',
    boxShadow: '0 2px 8px rgba(26,107,82,0.25)',
  },
  outline: {
    background: 'var(--white)',
    color: 'var(--ink-mid)',
    border: '1.5px solid var(--sand-deep)',
    boxShadow: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--emerald)',
    border: 'none',
    boxShadow: 'none',
  },
};

/**
 * @param {'primary'|'outline'|'ghost'} [variant='primary']
 * @param {'sm'|'md'|'lg'} [size='md']
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  type = 'button',
  style,
  children,
  ...rest
}) {
  const v = VARIANT[variant] ?? VARIANT.primary;
  const s = SIZE[size] ?? SIZE.md;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: s.padding,
        fontSize: s.fontSize,
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'all 0.15s',
        lineHeight: 1,
        ...v,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
