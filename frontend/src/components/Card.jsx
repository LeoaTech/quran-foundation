export function Card({ children, style, ...rest }) {
  return (
    <div
      style={{
        background: 'var(--white)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--sand-mid)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, style, ...rest }) {
  return (
    <div
      style={{
        padding: '16px 20px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, style, ...rest }) {
  return (
    <div style={{ padding: '16px 20px 20px', ...style }} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ children, style, ...rest }) {
  return (
    <div
      style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--sand-mid)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 10,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
