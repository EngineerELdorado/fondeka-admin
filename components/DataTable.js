'use client';

import React, { useMemo, useState } from 'react';

export function DataTable({ columns, rows, emptyLabel = 'No data to display.', showIndex = true }) {
  const [showAllColumns, setShowAllColumns] = useState(false);
  const visibleCols = useMemo(() => columns.filter((col) => col.key !== 'id'), [columns]);
  const resolvedCols = useMemo(() => {
    const shouldAutoPrioritize = visibleCols.length > 6;

    return visibleCols.map((col, index) => {
      const explicitPriority = col.priority ?? (col.hideOnMobile ? 'low' : null);
      if (explicitPriority) {
        return { ...col, priority: explicitPriority };
      }

      if (!shouldAutoPrioritize) {
        return { ...col, priority: 'high' };
      }

      const key = String(col.key || '').toLowerCase();
      const label = String(col.label || '').toLowerCase();
      const isActions = key === 'actions' || label === 'actions';
      const isPrimary = index < 3 || isActions;

      return { ...col, priority: isPrimary ? 'high' : 'low' };
    });
  }, [visibleCols]);
  const hasLowPriority = resolvedCols.some((col) => col.priority === 'low');
  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    return value;
  };

  return (
    <div className="card table-scroll" data-show-all={showAllColumns ? 'true' : 'false'}>
      {hasLowPriority && (
        <div className="table-scroll__controls">
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => setShowAllColumns((prev) => !prev)}
          >
            {showAllColumns ? 'Hide extra columns' : 'Show all columns'}
          </button>
          <div className="table-scroll__hint">Swipe to see more</div>
        </div>
      )}
      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {showIndex && (
              <th
                className="data-table__cell"
                data-priority="high"
                style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}
              >
                #
              </th>
            )}
            {resolvedCols.map((col) => (
              <th
                key={String(col.key)}
                className="data-table__cell"
                data-priority={col.priority || 'high'}
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
              <td colSpan={(showIndex ? 1 : 0) + resolvedCols.length} style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted)' }}>
                {emptyLabel}
              </td>
            </tr>
          )}
          {rows.map((row, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
              {showIndex && (
                <td className="data-table__cell" data-priority="high" style={{ padding: '0.75rem', color: 'var(--muted)' }}>
                  {idx + 1 + (Array.isArray(rows?.pageOffset) ? 0 : 0)}
                </td>
              )}
              {resolvedCols.map((col) => (
                <td key={String(col.key)} className="data-table__cell" data-priority={col.priority || 'high'} style={{ padding: '0.75rem' }}>
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
