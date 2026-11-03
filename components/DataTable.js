'use client';

import ResponsiveTable from '@/components/ResponsiveTable';
import TableActions from '@/components/TableActions';
import TableText from '@/components/TableCell';

import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isRegulatorRestrictedRecord, regulatorVisibleFields } from '@/lib/regulator-presentation';
import { fitTableColumns, tableColumnWidth } from '@/lib/table-columns';
import { shouldWrapTableValue } from '@/lib/table-content';

function TableValue({ children, column }) {
  const value = useRef(null);
  useEffect(() => {
    const element = value.current;
    if (element) element.title = typeof children === 'string' ? children : element.textContent?.trim() || '';
  }, [children]);
  return <div ref={value} className="data-table__value">{shouldWrapTableValue(children, column) ? <TableText value={children} label={typeof column?.label === 'string' && column.label ? column.label : 'Full value'} /> : children}</div>;
}

const resolveAccountId = (row) => {
  if (!row || typeof row !== 'object') return null;
  const direct = row.accountId;
  if (direct !== null && direct !== undefined && String(direct).trim() !== '') return String(direct).trim();
  const nested = row?.account?.id;
  if (nested !== null && nested !== undefined && String(nested).trim() !== '') return String(nested).trim();
  return null;
};

const normalizeGroups = (value) => {
  if (Array.isArray(value)) {
    return value.map((group) => String(group).trim().toUpperCase()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((group) => group.trim().toUpperCase()).filter(Boolean);
  }
  return [];
};

export function DataTable({
  columns,
  rows: suppliedRows,
  emptyLabel = 'No data to display.',
  compactEmptyState = false,
  showIndex = true,
  pageSize = 20,
  page: controlledPage,
  totalPages,
  totalElements,
  onPageChange,
  canPrev,
  canNext,
  showTotals = false,
  showAccountQuickNav = true,
  rowStyle
}) {
  const { session, enableRegulatorMode } = useAuth();
  const container = useRef(null);
  const columnsMenu = useRef(null);
  const [availableRem, setAvailableRem] = useState(null);
  const [chosenColumns, setChosenColumns] = useState(null);
  const rows = useMemo(() => enableRegulatorMode === false ? suppliedRows : suppliedRows.filter((row) => !isRegulatorRestrictedRecord(row)), [suppliedRows, enableRegulatorMode]);
  const isServerPagination = typeof onPageChange === 'function';
  const [localPage, setLocalPage] = useState(0);
  const page = isServerPagination ? Math.max(0, Number(controlledPage) || 0) : localPage;
  const safePageSize = Math.max(1, Number(pageSize) || 20);
  const accessTokenPayload = session?.tokens?.accessToken?.payload || null;
  const idTokenPayload = session?.tokens?.idToken?.payload || null;
  const adminGroups = useMemo(() => {
    const rawGroups = [
      accessTokenPayload?.['cognito:groups'],
      accessTokenPayload?.groups,
      idTokenPayload?.['cognito:groups'],
      idTokenPayload?.groups
    ];
    return Array.from(new Set(rawGroups.flatMap(normalizeGroups)));
  }, [accessTokenPayload, idTokenPayload]);
  const canSeeTotals = adminGroups.includes('SUPER_ADMIN') || adminGroups.includes('ADMIN');

  const visibleCols = useMemo(() => regulatorVisibleFields(columns, enableRegulatorMode).filter((col) => col.key !== 'id'), [columns, enableRegulatorMode]);
  const isEmpty = rows.length === 0;
  const shouldCompactEmptyState = compactEmptyState && isEmpty;
  const hasAccountLikeColumn = useMemo(
    () => visibleCols.some((col) => ['accountId', 'accountReference', 'account'].includes(String(col?.key || ''))),
    [visibleCols]
  );
  const shouldShowAccountQuickNav = useMemo(() => {
    if (!showAccountQuickNav) return false;
    if (hasAccountLikeColumn) return true;
    return rows.some((row) => Boolean(resolveAccountId(row)));
  }, [showAccountQuickNav, hasAccountLikeColumn, rows]);
  const effectiveCols = useMemo(() => {
    if (!shouldShowAccountQuickNav) return visibleCols;
    return [
      ...visibleCols,
      {
        key: '__account_quick_nav__',
        label: <span className="sr-only">Account</span>,
        render: (row) => {
          const accountId = resolveAccountId(row);
          if (!accountId) return '—';
          return (
            <Link
              href={`/dashboard/accounts/accounts/${encodeURIComponent(accountId)}`}
              aria-label={`Open account ${accountId}`}
              title={`Open account ${accountId}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '999px',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                textDecoration: 'none'
              }}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21a8 8 0 1 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </Link>
          );
        }
      }
    ];
  }, [shouldShowAccountQuickNav, visibleCols]);
  useEffect(() => {
    const element = container.current;
    if (!element) return undefined;
    const resize = () => {
      const style = window.getComputedStyle(element);
      const fontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setAvailableRem(width / fontSize);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const tableCols = useMemo(() => {
    const selected = chosenColumns && effectiveCols.filter((column) => chosenColumns.includes(column.key));
    return selected?.length ? selected : fitTableColumns(effectiveCols, availableRem);
  },
  [effectiveCols, chosenColumns, availableRem]);
  const occupiedRem = tableCols.reduce((total, column) => total + tableColumnWidth(column), 0);
  const showRowIndex = showIndex && (availableRem == null || availableRem >= 64 && occupiedRem + 3 <= availableRem);
  useEffect(() => {
    const closeMenu = (event) => {
      if (columnsMenu.current && (event.key === 'Escape' || event.type === 'pointerdown' && !columnsMenu.current.contains(event.target))) columnsMenu.current.open = false;
    };
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeMenu);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeMenu);
    };
  }, []);
  const columnMenu = () => (
    <details className="table-columns" ref={columnsMenu}>
      <summary>Columns{tableCols.length < effectiveCols.length ? ` (${tableCols.length}/${effectiveCols.length})` : ''}</summary>
      <div className="table-columns__menu">
        <button type="button" className="btn-neutral btn-sm" onClick={() => setChosenColumns(null)}>Fit to screen</button>
        {effectiveCols.map((column) => <label key={column.key}>
          <input type="checkbox" checked={tableCols.some((shown) => shown.key === column.key)} disabled={tableCols.length === 1 && tableCols[0].key === column.key} onChange={(event) => {
            const keys = tableCols.map((shown) => shown.key);
            setChosenColumns(event.target.checked ? [...keys, column.key] : keys.filter((key) => key !== column.key));
          }} />
          <span>{column.key === '__account_quick_nav__' ? 'Account shortcut' : column.label}</span>
        </label>)}
      </div>
    </details>
  );
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
      <div className="table-pagination__meta">
        {(showTotals || canSeeTotals) && typeof totalElements === 'number' && totalElements >= 0 ? (
          <span className="table-pagination__meta-badge">Total {totalElements.toLocaleString()} records</span>
        ) : null}
      </div>
      <div className="table-pagination__actions">
        {position === 'top' ? columnMenu() : null}
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
    </div>
  );

  return (
    <div className="card data-table-card" ref={container}>
      {!shouldCompactEmptyState ? renderPagination('top') : null}
      <ResponsiveTable className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {showRowIndex && (
              <th
                className="data-table__cell"
                style={{ textAlign: 'left', padding: '0.65rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)', width: '3rem' }}
              >
                #
              </th>
            )}
            {tableCols.map((col) => (
              <th
                key={String(col.key)}
                className="data-table__cell"
                style={{ textAlign: 'left', padding: '0.65rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)', width: col.key === '__account_quick_nav__' ? '3.5rem' : undefined }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty && (
            <tr>
              <td
                colSpan={(showRowIndex ? 1 : 0) + tableCols.length}
                style={{ padding: shouldCompactEmptyState ? '0.75rem 1rem' : '1rem', textAlign: 'center', color: 'var(--muted)' }}
              >
                {emptyLabel}
              </td>
            </tr>
          )}
          {displayRows.map((row, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid var(--border)', ...(rowStyle ? rowStyle(row, idx) : {}) }}>
              {showRowIndex && (
                <td className="data-table__cell" style={{ padding: '0.75rem', color: 'var(--muted)' }}>
                  {idx + 1 + page * safePageSize}
                </td>
              )}
              {tableCols.map((col) => {
                const value = col.render ? formatValue(col.render(row)) : String(formatValue(row[col.key]));
                const actions = String(col.key).toLowerCase() === 'actions';
                return <td key={String(col.key)} className={`data-table__cell${actions ? ' data-table__cell--actions' : ''}`} style={{ padding: '0.65rem' }}>
                  {actions ? <TableActions>{value}</TableActions> : <TableValue column={col}>{value}</TableValue>}
                </td>;
              })}
            </tr>
          ))}
        </tbody>
      </ResponsiveTable>
      {renderPagination('bottom')}
    </div>
  );
}
