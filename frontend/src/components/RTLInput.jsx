/**
 * Urdu/Arabic text input. Applies dir=rtl and the Amiri display font automatically.
 * Renders a <textarea> when `multiline` is true, otherwise an <input>.
 *
 * @param {boolean} [multiline=false]
 * @param {number} [rows=3]
 */
export default function RTLInput({
  multiline = false,
  rows = 3,
  placeholder,
  value,
  onChange,
  style,
  ...rest
}) {
  const shared = {
    dir: 'rtl',
    fontFamily: 'var(--font-display)',
    fontSize: 16,
    lineHeight: 1.6,
    padding: '10px 13px',
    border: '1.5px solid var(--sand-deep)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--ink)',
    background: 'var(--white)',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    ...style,
  };

  const focusHandlers = {
    onFocus: (e) => {
      e.target.style.borderColor = 'var(--emerald-bright)';
      e.target.style.boxShadow = '0 0 0 3px rgba(42,170,132,0.1)';
    },
    onBlur: (e) => {
      e.target.style.borderColor = 'var(--sand-deep)';
      e.target.style.boxShadow = 'none';
    },
  };

  if (multiline) {
    return (
      <textarea
        dir="rtl"
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{ ...shared, resize: 'none' }}
        {...focusHandlers}
        {...rest}
      />
    );
  }

  return (
    <input
      type="text"
      dir="rtl"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      style={shared}
      {...focusHandlers}
      {...rest}
    />
  );
}
