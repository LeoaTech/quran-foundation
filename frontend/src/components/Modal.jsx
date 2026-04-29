import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';

const WIDTH = { sm: 400, md: 520, lg: 720 };

/**
 * @param {boolean} open
 * @param {string} [title]
 * @param {'sm'|'md'|'lg'} [size='md']
 * @param {() => void} onClose
 */
export default function Modal({ open, title, size = 'md', onClose, children }) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'var(--white)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: WIDTH[size] ?? WIDTH.md,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 48px)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px 16px',
              borderBottom: '1px solid var(--sand-mid)',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
              {title}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--ink-pale)',
                fontSize: 20,
                lineHeight: 1,
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* Body — scrollable */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
