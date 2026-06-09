export function Card({ children, style, ...rest }) {
  return (
    <div
      style={{
        background: "var(--white)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--sand-mid)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
        ...style
      }}
      className="card"
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
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        ...style
      }}
      className="card-header"
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, style, ...rest }) {
  return (
    <div
      style={{ ...style }}
      className="card-body"
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardFooter({ children, style, ...rest }) {
  return (
    <div
      style={{
        borderTop: "1px solid var(--sand-mid)",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 10,
        ...style
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
