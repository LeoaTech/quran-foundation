import { createContext, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

export const ToastContext = createContext(null);

const ICONS = { success: '✓', error: '✕', warning: '!' };

const COLORS = {
  success: { bg: 'var(--emerald)',    text: 'var(--white)' },
  error:   { bg: 'var(--red)',        text: 'var(--white)' },
  warning: { bg: 'var(--gold)',       text: 'var(--white)' },
};

function ToastItem({ id, type = 'success', message, onRemove }) {
  const c = COLORS[type] ?? COLORS.success;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        background: c.bg,
        color: c.text,
        boxShadow: 'var(--shadow-md)',
        fontSize: 13,
        fontWeight: 500,
        minWidth: 260,
        maxWidth: 380,
        animation: 'fadeUp 0.25s ease both',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 14 }}>{ICONS[type]}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={() => onRemove(id)}
        style={{
          background: 'rgba(255,255,255,0.25)',
          border: 'none',
          borderRadius: 4,
          color: 'inherit',
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1,
          padding: '2px 6px',
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ type = 'success', message, duration = 4000 }) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    if (duration > 0) setTimeout(() => remove(id), duration);
  }, [remove]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {createPortal(
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            alignItems: 'flex-end',
          }}
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} {...t} onRemove={remove} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
