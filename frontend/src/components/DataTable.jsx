import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';

/**
 * @param {{ key: string, label: string, render?: (value, row) => ReactNode }[]} columns
 * @param {object[]} rows
 * @param {boolean} [loading]
 * @param {string} [emptyTitle]
 * @param {string} [emptyDescription]
 */
export default function DataTable({
  columns,
  rows = [],
  loading = false,
  emptyTitle = 'No records found',
  emptyDescription = '',
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--ink-pale)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '0 14px 10px',
                  borderBottom: '1px solid var(--sand-mid)',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={columns.length} style={{ padding: '40px 14px', textAlign: 'center' }}>
                <LoadingSpinner />
              </td>
            </tr>
          )}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: '0' }}>
                <EmptyState title={emptyTitle} description={emptyDescription} />
              </td>
            </tr>
          )}

          {!loading && rows.map((row, i) => (
            <tr
              key={row.id ?? i}
              style={{ transition: 'background 0.1s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sand)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: '11px 14px',
                    fontSize: 13,
                    color: 'var(--ink-mid)',
                    borderBottom: i < rows.length - 1 ? '1px solid var(--sand)' : 'none',
                    verticalAlign: 'middle',
                  }}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
