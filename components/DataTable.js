import React from 'react';

export function DataTable({ columns, rows, emptyLabel = 'No data to display.', showIndex = true }) {
  const visibleCols = columns.filter((col) => col.key !== 'id');

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {showIndex && <th style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>#</th>}
            {visibleCols.map((col) => (
              <th
                key={String(col.key)}
                style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={(showIndex ? 1 : 0) + visibleCols.length} style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted)' }}>
                {emptyLabel}
              </td>
            </tr>
          )}
          {rows.map((row, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
              {showIndex && <td style={{ padding: '0.75rem', color: 'var(--muted)' }}>{idx + 1 + (Array.isArray(rows?.pageOffset) ? 0 : 0)}</td>}
              {visibleCols.map((col) => (
                <td key={String(col.key)} style={{ padding: '0.75rem' }}>
                  {col.render ? col.render(row) : String(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
