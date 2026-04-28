import { useLocation } from 'react-router-dom';

export default function Placeholder() {
  const { pathname } = useLocation();
  const name = pathname.split('/').filter(Boolean)[0] ?? 'page';

  return (
    <div className="card">
      <div className="card-body" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-soft)', fontSize: 14 }}>
        <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>◈</div>
        <strong>{name.charAt(0).toUpperCase() + name.slice(1)}</strong> — coming soon.
      </div>
    </div>
  );
}
