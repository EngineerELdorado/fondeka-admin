'use client';

import React, { useMemo } from 'react';

export function DataTable({ columns, rows, emptyLabel = 'No data to display.', showIndex = true }) {
  const visibleCols = useMemo(() => columns.filter((col) => col.key !== 'id'), [columns]);
  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    return value;
  };

  return (
    <div className="card table-scroll">
      <div className="table-scroll__hint">Swipe to see more</div>
      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {showIndex && (
              <th
                className="data-table__cell"
                style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}
              >
                #
              </th>
            )}
            {visibleCols.map((col) => (
              <th
                key={String(col.key)}
                className="data-table__cell"
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
              {showIndex && (
                <td className="data-table__cell" style={{ padding: '0.75rem', color: 'var(--muted)' }}>
                  {idx + 1 + (Array.isArray(rows?.pageOffset) ? 0 : 0)}
                </td>
              )}
              {visibleCols.map((col) => (
                <td key={String(col.key)} className="data-table__cell" style={{ padding: '0.75rem' }}>
                  {col.render ? formatValue(col.render(row)) : String(formatValue(row[col.key]))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
