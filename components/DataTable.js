'use client';

import React, { useEffect, useMemo, useState } from 'react';

export function DataTable({
  columns,
  rows,
  emptyLabel = 'No data to display.',
  showIndex = true,
  pageSize = 10,
  page: controlledPage,
  totalPages,
  onPageChange,
  canPrev,
  canNext
}) {
  const isServerPagination = typeof onPageChange === 'function';
  const [localPage, setLocalPage] = useState(0);
  const page = isServerPagination ? Math.max(0, Number(controlledPage) || 0) : localPage;
  const safePageSize = Math.max(1, Number(pageSize) || 10);

  const visibleCols = useMemo(() => columns.filter((col) => col.key !== 'id'), [columns]);
  const localTotalPages = Math.max(1, Math.ceil(rows.length / safePageSize));
  const inferredCanNext = rows.length === safePageSize && rows.length > 0;
  const effectiveCanNext = typeof canNext === 'boolean' ? canNext : inferredCanNext;
  const effectiveTotalPages = isServerPagination
    ? Math.max(1, Number.isFinite(totalPages) ? Number(totalPages) : page + (effectiveCanNext ? 2 : 1))
    : localTotalPages;
  const paginatedRows = useMemo(() => {
    const start = page * safePageSize;
    return rows.slice(start, start + safePageSize);
  }, [page, rows, safePageSize]);
  const displayRows = isServerPagination ? rows : paginatedRows;

  useEffect(() => {
    if (!isServerPagination) {
      setLocalPage((prev) => Math.min(prev, localTotalPages - 1));
    }
  }, [isServerPagination, localTotalPages]);

  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    return value;
  };

  const prevDisabled = isServerPagination ? (typeof canPrev === 'boolean' ? !canPrev : page === 0) : page === 0;
  const nextDisabled = isServerPagination ? !effectiveCanNext : page >= effectiveTotalPages - 1;

  const goToPage = (nextPage) => {
    const target = Math.max(0, nextPage);
    if (isServerPagination) {
      onPageChange(target);
      return;
    }
    setLocalPage(target);
  };

  const renderPagination = (position) => (
    <div className={`table-pagination table-pagination--${position}`} role="navigation" aria-label={`Table pagination (${position})`}>
      <button type="button" className="table-pagination__arrow" onClick={() => goToPage(page - 1)} disabled={prevDisabled}>
        ←
      </button>
      <span className="table-pagination__label">
        Page {page + 1} of {effectiveTotalPages}
      </span>
      <button
        type="button"
        className="table-pagination__arrow"
        onClick={() => goToPage(page + 1)}
        disabled={nextDisabled}
      >
        →
      </button>
    </div>
  );

  return (
    <div className="card table-scroll">
      {renderPagination('top')}
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
          {displayRows.map((row, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
              {showIndex && (
                <td className="data-table__cell" style={{ padding: '0.75rem', color: 'var(--muted)' }}>
                  {idx + 1 + page * safePageSize}
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
      {renderPagination('bottom')}
    </div>
  );
}
