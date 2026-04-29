import Button from './Button';

/**
 * @param {string} [icon='◈']
 * @param {string} title
 * @param {string} [description]
 * @param {{ label: string, onClick: () => void }} [action]
 */
export default function EmptyState({ icon = '◈', title, description, action }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        gap: 10,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 36, opacity: 0.3, marginBottom: 4, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-mid)' }}>{title}</div>
      {description && (
        <div style={{ fontSize: 13, color: 'var(--ink-pale)', maxWidth: 320 }}>{description}</div>
      )}
      {action && (
        <div style={{ marginTop: 8 }}>
          <Button variant="outline" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
