import LoadingSpinner from "./LoadingSpinner";
import EmptyState from "./EmptyState";

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
  emptyTitle = "No records found",
  emptyDescription = ""
}) {
  return (
    <div className="table-wrapper">
      <table className="tbl">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: "40px 14px", textAlign: "center" }}
              >
                <LoadingSpinner />
              </td>
            </tr>
          )}

          {!loading && rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: "0" }}
              >
                <EmptyState
                  title={emptyTitle}
                  description={emptyDescription}
                />
              </td>
            </tr>
          )}

          {!loading &&
            rows.map((row, i) => (
              <tr
                key={row.id ?? i}
                style={{ transition: "background 0.1s" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--sand)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "";
                }}
              >
                {columns.map((col) => (
                  <td key={col.key}>
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
