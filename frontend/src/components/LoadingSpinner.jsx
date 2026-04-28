const KEYFRAMES = `
@keyframes spin {
  to { transform: rotate(360deg); }
}`;

let injected = false;

function inject() {
  if (injected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
  injected = true;
}

/**
 * @param {number} [size=24]
 * @param {string} [color='var(--emerald)']
 */
export default function LoadingSpinner({ size = 24, color = 'var(--emerald)', style }) {
  inject();
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2.5px solid var(--sand-mid)`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
