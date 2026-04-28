import Button from './Button';

/**
 * @param {string} title
 * @param {string} [subtitle]
 * @param {{ label: string, onClick: () => void, variant?: string }} [action]
 */
export default function PageHeader({ title, subtitle, action }) {
  return (
    <div
      style={{
        marginBottom: 24,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            color: 'var(--ink)',
            lineHeight: 1.2,
            marginBottom: subtitle ? 3 : 0,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{subtitle}</p>
        )}
      </div>

      {action && (
        <Button variant={action.variant ?? 'primary'} size="md" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
