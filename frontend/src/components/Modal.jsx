import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Button from "./Button";

const WIDTH = { sm: 400, md: 520, lg: 720 };

/**
 * @param {boolean} open
 * @param {string} [title]
 * @param {'sm'|'md'|'lg'} [size='md']
 * @param {() => void} onClose
 */
export default function Modal({ open, title, size = "md", onClose, children }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Track mobile state
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!open) return null;

  const modalWidth = isMobile ? "100%" : (WIDTH[size] ?? WIDTH.md);
  const modalMaxWidth = isMobile ? "100%" : (WIDTH[size] ?? WIDTH.md);
  const modalMaxHeight = isMobile ? "100vh" : "calc(100vh - 48px)";
  const modalBorderRadius = isMobile ? 0 : "var(--radius-lg)";
  const modalPadding = isMobile ? 0 : 24;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 200,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 24
      }}
    >
      <div
        style={{
          background: "var(--white)",
          borderRadius: modalBorderRadius,
          width: modalWidth,
          maxWidth: modalMaxWidth,
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          maxHeight: modalMaxHeight,
          overflow: "hidden"
        }}
      >
        {/* Header */}
        {title && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: isMobile ? "16px 18px 14px" : "18px 24px 16px",
              borderBottom: "1px solid var(--sand-mid)",
              flexShrink: 0
            }}
          >
            <span
              style={{
                fontSize: isMobile ? 14 : 15,
                fontWeight: 600,
                color: "var(--ink)"
              }}
            >
              {title}
            </span>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--ink-pale)",
                fontSize: 20,
                lineHeight: 1,
                padding: "2px 6px",
                borderRadius: "var(--radius-sm)"
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* Body — scrollable */}
        <div
          style={{
            padding: isMobile ? "16px 18px" : "20px 24px",
            overflowY: "auto",
            flex: 1
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
