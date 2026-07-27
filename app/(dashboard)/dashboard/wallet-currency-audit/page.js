'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const actionOptions = [
  '',
  'PAY_ELECTRICITY_BILL',
  'PAY_TV_SUBSCRIPTION',
  'PAY_WATER_BILL',
  'PAY_INTERNET_BILL',
  'FUND_CARD',
  'WITHDRAW_FROM_CARD',
  'BUY_CRYPTO',
  'SELL_CRYPTO',
  'FUND_WALLET',
  'WITHDRAW_FROM_WALLET'
].sort();

const emptyFilters = {
  accountId: '',
  action: '',
  reference: '',
  reviewStatus: '',
  reason: ''
};

const reasonDescriptions = {
  TRANSACTION_WALLET_CURRENCY_MISMATCH: 'Transaction currency does not match the fiat wallet currency debited.',
  MISSING_BILLING_CURRENCY: 'Transaction was wallet-funded but has no billing currency.',
  INVALID_BILLING_AMOUNT: 'Transaction was wallet-funded but billing amount is missing or not positive.',
  BILL_PROVIDER_CURRENCY_MISMATCH: 'Bill provider mapping has a provider currency, but the transaction billing currency differs.'
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={{ gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
          x
        </button>
      </div>
      {children}
    </div>
  </div>
);

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'grid', gap: '0.15rem', padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{row.value ?? '-'}</div>
      </div>
    ))}
  </div>
);

const JsonBlock = ({ value }) => (
  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowX: 'auto', background: 'color-mix(in srgb, var(--surface) 86%, var(--accent-soft) 14%)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.75rem', fontSize: '12px' }}>
    {value === null || value === undefined ? '-' : JSON.stringify(value, null, 2)}
  </pre>
);

const normalizeList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.content)) return response.content;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatAmount = (value, currency) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  const amount = Number.isFinite(num)
    ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(value);
  return [amount, currency].filter(Boolean).join(' ');
};

const statusTone = (value) => {
  const status = String(value || '').toUpperCase();
  if (['COMPLETED', 'SUCCESS', 'SUCCESSFUL'].includes(status)) return { bg: '#ECFDF3', fg: '#15803D' };
  if (['FAILED', 'REJECTED', 'CANCELLED'].includes(status)) return { bg: '#FEF2F2', fg: '#B91C1C' };
  if (['SUBMITTED', 'PROCESSING', 'PENDING', 'INITIATED'].includes(status)) return { bg: '#FFFBEB', fg: '#B45309' };
  return { bg: '#F3F4F6', fg: '#374151' };
};

const Badge = ({ value, tone }) => {
  if (!value) return '-';
  const resolved = tone || statusTone(value);
  return (
    <span style={{ display: 'inline-flex', padding: '0.18rem 0.5rem', borderRadius: '999px', fontSize: '12px', fontWeight: 800, background: resolved.bg, color: resolved.fg }}>
      {String(value)}
    </span>
  );
};

const ReasonList = ({ reasons }) => {
  const list = Array.isArray(reasons) ? reasons : [];
  if (!list.length) return '-';
  return (
    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
      {list.map((reason) => (
        <span
          key={reason}
          title={reasonDescriptions[reason] || reason}
          style={{ display: 'inline-flex', padding: '0.18rem 0.5rem', borderRadius: '999px', fontSize: '12px', fontWeight: 800, background: '#FEF2F2', color: '#B91C1C' }}
        >
          {reason}
        </span>
      ))}
    </div>
  );
};

const providerDisplay = (value) => (value === 'NO_EXTERNAL_PROVIDER' ? 'No external provider' : value || '-');

const reviewStatusTone = (value) => {
  const status = String(value || 'OPEN').toUpperCase();
  if (status === 'REVIEWED') return { bg: '#ECFDF3', fg: '#15803D' };
  if (status === 'IGNORED') return { bg: '#F3F4F6', fg: '#4B5563' };
  return { bg: '#FFFBEB', fg: '#B45309' };
};

export default function WalletCurrencyAuditPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [selected, setSelected] = useState(null);
  const [reviewPendingByTransactionId, setReviewPendingByTransactionId] = useState({});

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', String(Math.max(0, Number(page) || 0)));
    params.set('size', String(Math.min(MAX_PAGE_SIZE, Math.max(1, Number(size) || DEFAULT_PAGE_SIZE))));
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (['reviewStatus', 'reason'].includes(key)) return;
      const trimmed = String(value ?? '').trim();
      if (trimmed) params.set(key, key === 'action' ? trimmed.toUpperCase() : trimmed);
    });
    return params;
  }, [appliedFilters, page, size]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.walletCurrencyAudit.violations(buildQuery());
      setRows(normalizeList(res));
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setRows([]);
      setPageMeta({ totalElements: null, totalPages: null });
      setError(err?.message || 'Failed to load wallet currency audit violations.');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const applyFilters = () => {
    setPage(0);
    setAppliedFilters(filters);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(0);
  };

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === Number(size) : page + 1 < pageMeta.totalPages;
  const visibleRows = useMemo(() => {
    const reviewStatus = String(appliedFilters.reviewStatus || '').trim().toUpperCase();
    const reason = String(appliedFilters.reason || '').trim().toUpperCase();
    return rows.filter((row) => {
      if (reviewStatus && String(row.reviewStatus || 'OPEN').toUpperCase() !== reviewStatus) return false;
      if (reason && !(Array.isArray(row.violationReasons) && row.violationReasons.some((item) => String(item).toUpperCase().includes(reason)))) return false;
      return true;
    });
  }, [appliedFilters.reason, appliedFilters.reviewStatus, rows]);

  const updateViolationRow = (transactionId, nextRow) => {
    setRows((prev) => prev.map((row) => (String(row.transactionId) === String(transactionId) ? { ...row, ...(nextRow || {}) } : row)));
    setSelected((prev) => (prev && String(prev.transactionId) === String(transactionId) ? { ...prev, ...(nextRow || {}) } : prev));
  };

  const handleReview = async (row, status) => {
    if (!row?.transactionId) return;
    const note = window.prompt(
      status === 'REVIEWED' ? 'Review note' : 'Ignore note',
      status === 'REVIEWED' ? 'Confirmed and handled.' : 'Known false positive or not actionable.'
    );
    if (note === null) return;
    const transactionId = row.transactionId;
    setReviewPendingByTransactionId((prev) => ({ ...prev, [transactionId]: true }));
    setError(null);
    setInfo(null);
    try {
      const updated = await api.walletCurrencyAudit.reviewViolation(transactionId, { status, note: String(note || '').trim() });
      updateViolationRow(transactionId, updated || { reviewStatus: status, reviewNote: String(note || '').trim() });
      setInfo(`Marked ${row.internalReference || transactionId} as ${status.toLowerCase()}.`);
    } catch (err) {
      setError(err?.message || `Failed to mark violation as ${status.toLowerCase()}.`);
    } finally {
      setReviewPendingByTransactionId((prev) => ({ ...prev, [transactionId]: false }));
    }
  };

  const handleClearReview = async (row) => {
    if (!row?.transactionId) return;
    const confirmed = window.confirm(`Reopen ${row.internalReference || row.transactionId}?`);
    if (!confirmed) return;
    const transactionId = row.transactionId;
    setReviewPendingByTransactionId((prev) => ({ ...prev, [transactionId]: true }));
    setError(null);
    setInfo(null);
    try {
      await api.walletCurrencyAudit.clearViolationReview(transactionId);
      updateViolationRow(transactionId, {
        reviewStatus: 'OPEN',
        reviewedByAdminId: null,
        reviewedByAdminEmail: null,
        reviewedAt: null,
        reviewNote: null
      });
      setInfo(`Reopened ${row.internalReference || transactionId}.`);
    } catch (err) {
      setError(err?.message || 'Failed to reopen violation.');
    } finally {
      setReviewPendingByTransactionId((prev) => ({ ...prev, [transactionId]: false }));
    }
  };

  const columns = useMemo(() => [
    {
      key: 'internalReference',
      label: 'Reference',
      render: (row) => row.transactionId ? (
        <Link href={`/dashboard/transactions?transactionId=${row.transactionId}`} style={{ color: 'var(--accent)', fontWeight: 800 }}>
          {row.internalReference || row.transactionId}
        </Link>
      ) : row.internalReference || row.externalReference || row.operatorReference || '-'
    },
    {
      key: 'accountReference',
      label: 'Account',
      render: (row) => row.accountId ? (
        <div style={{ display: 'grid', gap: '0.1rem' }}>
          <Link href={`/dashboard/accounts/accounts/${row.accountId}`} style={{ color: 'var(--accent)', fontWeight: 700 }}>
            {row.accountReference || `Account ${row.accountId}`}
          </Link>
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.username || row.userReference || '-'}</span>
        </div>
      ) : '-'
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <div style={{ display: 'grid', gap: '0.1rem' }}>
          <span style={{ fontWeight: 700 }}>{row.action || '-'}</span>
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.service || '-'}</span>
        </div>
      )
    },
    { key: 'status', label: 'Status', render: (row) => <Badge value={row.status} /> },
    {
      key: 'wallet',
      label: 'Wallet',
      render: (row) => (
        <div style={{ display: 'grid', gap: '0.1rem' }}>
          <span>{row.fiatWalletCurrency || '-'}</span>
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.fiatWalletBalanceEffect || '-'}</span>
        </div>
      )
    },
    { key: 'amount', label: 'Transaction amount', render: (row) => formatAmount(row.amount, row.currency) },
    { key: 'billingAmount', label: 'Billing amount', render: (row) => formatAmount(row.billingAmount, row.billingCurrency) },
    { key: 'expectedProviderCurrency', label: 'Expected provider currency', render: (row) => row.expectedProviderCurrency || '-' },
    { key: 'violationReasons', label: 'Violation reasons', render: (row) => <ReasonList reasons={row.violationReasons} /> },
    { key: 'reviewStatus', label: 'Review status', render: (row) => <Badge value={row.reviewStatus || 'OPEN'} tone={reviewStatusTone(row.reviewStatus)} /> },
    { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => {
        const pending = Boolean(reviewPendingByTransactionId[row.transactionId]);
        const reviewStatus = String(row.reviewStatus || 'OPEN').toUpperCase();
        return (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => setSelected(row)}>View</button>
            {row.transactionId && <Link href={`/dashboard/transactions?transactionId=${row.transactionId}`} className="btn-neutral btn-sm">View transaction</Link>}
            <button type="button" className="btn-neutral btn-sm" onClick={() => setSelected(row)}>Provider events</button>
            {reviewStatus === 'OPEN' ? (
              <>
                <button type="button" className="btn-success btn-sm" disabled={pending} onClick={() => handleReview(row, 'REVIEWED')}>
                  {pending ? 'Saving...' : 'Mark reviewed'}
                </button>
                <button type="button" className="btn-neutral btn-sm" disabled={pending} onClick={() => handleReview(row, 'IGNORED')}>
                  Ignore
                </button>
              </>
            ) : (
              <button type="button" className="btn-danger btn-sm" disabled={pending} onClick={() => handleClearReview(row)}>
                {pending ? 'Saving...' : 'Reopen'}
              </button>
            )}
          </div>
        );
      }
    }
  ], [reviewPendingByTransactionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const providerEvents = useMemo(
    () => [...(Array.isArray(selected?.providerEvents) ? selected.providerEvents : [])].sort(
      (a, b) => Number(a?.sequenceNumber || 0) - Number(b?.sequenceNumber || 0)
    ),
    [selected?.providerEvents]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.2rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Wallet Currency Audit</div>
          <div style={{ color: 'var(--muted)' }}>Read-only audit for wallet-funded transactions that violate currency contract expectations.</div>
        </div>
        <button type="button" className="btn-neutral btn-sm" onClick={fetchRows} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['OPEN', 'REVIEWED', 'IGNORED'].map((status) => (
            <button
              key={status}
              type="button"
              className={filters.reviewStatus === status ? 'btn-primary btn-sm' : 'btn-neutral btn-sm'}
              onClick={() => {
                const next = { ...filters, reviewStatus: filters.reviewStatus === status ? '' : status };
                setFilters(next);
                setAppliedFilters(next);
                setPage(0);
              }}
            >
              {status}
            </button>
          ))}
          {Object.keys(reasonDescriptions).map((reason) => (
            <button
              key={reason}
              type="button"
              className={filters.reason === reason ? 'btn-danger btn-sm' : 'btn-neutral btn-sm'}
              onClick={() => {
                const next = { ...filters, reason: filters.reason === reason ? '' : reason };
                setFilters(next);
                setAppliedFilters(next);
                setPage(0);
              }}
            >
              {reason}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="accountId">Account ID</label>
            <input id="accountId" value={filters.accountId} onChange={(e) => setFilters((prev) => ({ ...prev, accountId: e.target.value }))} placeholder="9" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="action">Action</label>
            <select id="action" value={filters.action} onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}>
              {actionOptions.map((action) => (
                <option key={action || 'all'} value={action}>{action || 'All actions'}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="reference">Reference</label>
            <input id="reference" value={filters.reference} onChange={(e) => setFilters((prev) => ({ ...prev, reference: e.target.value }))} placeholder="TX123 / EXT123 / OP123" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="reviewStatus">Review status</label>
            <select id="reviewStatus" value={filters.reviewStatus} onChange={(e) => setFilters((prev) => ({ ...prev, reviewStatus: e.target.value }))}>
              <option value="">All review statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="REVIEWED">REVIEWED</option>
              <option value="IGNORED">IGNORED</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="reason">Reason contains</label>
            <select id="reason" value={filters.reason} onChange={(e) => setFilters((prev) => ({ ...prev, reason: e.target.value }))}>
              <option value="">All reasons</option>
              {Object.keys(reasonDescriptions).map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="page">Page</label>
            <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="size">Size</label>
            <input id="size" type="number" min={1} max={MAX_PAGE_SIZE} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={applyFilters} disabled={loading}>Apply filters</button>
          <button type="button" className="btn-neutral" onClick={resetFilters} disabled={loading}>Clear</button>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', color: 'var(--muted)', fontSize: '13px' }}>
        <span>
          {visibleRows.length} visible violation{visibleRows.length === 1 ? '' : 's'}
          {pageMeta.totalElements !== null ? ` / ${pageMeta.totalElements} returned by backend filters` : ''}
        </span>
        <span>Review actions only update audit metadata. They do not block, retry, or mutate payments.</span>
      </div>

      <DataTable
        columns={columns}
        rows={visibleRows}
        page={page}
        pageSize={size}
        totalPages={appliedFilters.reviewStatus || appliedFilters.reason ? null : pageMeta.totalPages}
        totalElements={appliedFilters.reviewStatus || appliedFilters.reason ? null : pageMeta.totalElements}
        onPageChange={setPage}
        canPrev={canPrev}
        canNext={canNext}
        emptyLabel={loading ? 'Loading wallet currency violations...' : 'No wallet currency violations found'}
      />

      {selected && (
        <Modal title={`Wallet currency violation ${selected.internalReference || selected.transactionId || ''}`} onClose={() => setSelected(null)}>
          <DetailGrid
            rows={[
              { label: 'Transaction ID', value: selected.transactionId },
              { label: 'Internal reference', value: selected.internalReference },
              { label: 'External reference', value: selected.externalReference },
              { label: 'Operator reference', value: selected.operatorReference },
              { label: 'Created', value: formatDateTime(selected.createdAt) },
              { label: 'Status', value: <Badge value={selected.status} /> },
              { label: 'Service', value: selected.service },
              { label: 'Action', value: selected.action },
              { label: 'Account', value: selected.accountReference || selected.accountId },
              { label: 'User', value: selected.username || selected.userReference || selected.userId },
              { label: 'Fiat wallet', value: `${selected.fiatWalletId || '-'} / ${selected.fiatWalletCurrency || '-'}` },
              { label: 'Wallet effect', value: selected.fiatWalletBalanceEffect },
              { label: 'Amount', value: formatAmount(selected.amount, selected.currency) },
              { label: 'Gross amount', value: formatAmount(selected.grossAmount, selected.currency) },
              { label: 'Settlement amount', value: formatAmount(selected.settlementAmount, selected.currency) },
              { label: 'Billing amount', value: formatAmount(selected.billingAmount, selected.billingCurrency) },
              { label: 'Expected provider currency', value: selected.expectedProviderCurrency },
              { label: 'Review status', value: <Badge value={selected.reviewStatus || 'OPEN'} tone={reviewStatusTone(selected.reviewStatus)} /> },
              { label: 'Reviewed by', value: selected.reviewedByAdminEmail || selected.reviewedByAdminId },
              { label: 'Reviewed at', value: formatDateTime(selected.reviewedAt) },
              { label: 'Review note', value: selected.reviewNote },
              { label: 'Bill product/provider mapping', value: selected.billProductBillProviderId },
              { label: 'Bill product', value: selected.billProductName || selected.billProductId },
              { label: 'Bill provider', value: selected.billProviderName || selected.billProviderId }
            ]}
          />

          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <div style={{ fontWeight: 800 }}>Violation reasons</div>
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              {(Array.isArray(selected.violationReasons) ? selected.violationReasons : []).map((reason) => (
                <div key={reason} style={{ display: 'grid', gap: '0.1rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 800, color: '#B91C1C' }}>{reason}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{reasonDescriptions[reason] || 'No description available.'}</div>
                </div>
              ))}
              {(!Array.isArray(selected.violationReasons) || selected.violationReasons.length === 0) && (
                <div style={{ color: 'var(--muted)' }}>No violation reasons returned.</div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <div style={{ fontWeight: 800 }}>Provider events</div>
            {providerEvents.length === 0 ? (
              <div style={{ color: 'var(--muted)' }}>No provider events recorded.</div>
            ) : providerEvents.map((event, index) => (
              <details key={event.id || `${event.sequenceNumber || index}-${event.eventType || 'event'}`} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '0.7rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 800 }}>
                  #{event.sequenceNumber ?? index + 1} {event.eventType || 'EVENT'} / {providerDisplay(event.providerName)} / {event.status || 'No status'}
                </summary>
                <DetailGrid
                  rows={[
                    { label: 'Created', value: formatDateTime(event.createdAt) },
                    { label: 'Provider', value: providerDisplay(event.providerName) },
                    { label: 'Operation', value: event.operation },
                    { label: 'Status', value: event.status },
                    { label: 'Reference', value: event.providerReference }
                  ]}
                />
                {(event.payload || event.error) && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                    {event.payload && <div style={{ display: 'grid', gap: '0.35rem' }}><div style={{ fontWeight: 700 }}>Payload</div><JsonBlock value={event.payload} /></div>}
                    {event.error && <div style={{ display: 'grid', gap: '0.35rem' }}><div style={{ fontWeight: 700 }}>Error</div><JsonBlock value={event.error} /></div>}
                  </div>
                )}
              </details>
            ))}
          </div>

          <div className="modal-actions">
            {selected.transactionId && <Link href={`/dashboard/transactions?transactionId=${selected.transactionId}`} className="btn-primary">Open transaction</Link>}
            {selected.accountId && <Link href={`/dashboard/accounts/accounts/${selected.accountId}`} className="btn-neutral">Open account</Link>}
            {String(selected.reviewStatus || 'OPEN').toUpperCase() === 'OPEN' ? (
              <>
                <button type="button" className="btn-success" disabled={Boolean(reviewPendingByTransactionId[selected.transactionId])} onClick={() => handleReview(selected, 'REVIEWED')}>
                  {reviewPendingByTransactionId[selected.transactionId] ? 'Saving...' : 'Mark reviewed'}
                </button>
                <button type="button" className="btn-neutral" disabled={Boolean(reviewPendingByTransactionId[selected.transactionId])} onClick={() => handleReview(selected, 'IGNORED')}>
                  Ignore
                </button>
              </>
            ) : (
              <button type="button" className="btn-danger" disabled={Boolean(reviewPendingByTransactionId[selected.transactionId])} onClick={() => handleClearReview(selected)}>
                {reviewPendingByTransactionId[selected.transactionId] ? 'Saving...' : 'Reopen'}
              </button>
            )}
            <button type="button" className="btn-neutral" onClick={() => setSelected(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
