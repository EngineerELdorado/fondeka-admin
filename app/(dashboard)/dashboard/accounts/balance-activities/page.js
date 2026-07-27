'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyFilters = {
  fiatWalletId: '',
  accountId: '',
  currency: '',
  activityType: '',
  transactionReference: '',
  userEmail: ''
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>x</button>
      </div>
      {children}
    </div>
  </div>
);

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700 }}>{row.value ?? '-'}</div>
      </div>
    ))}
  </div>
);

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

const activityTone = (type, delta) => {
  const normalized = String(type || '').toUpperCase();
  const amount = Number(delta);
  if (normalized.includes('DEPOSIT') || amount > 0) return { bg: '#ECFDF3', fg: '#15803D' };
  if (normalized.includes('WITHDRAW') || normalized.includes('DEBIT') || amount < 0) return { bg: '#FEF2F2', fg: '#B91C1C' };
  return { bg: '#F3F4F6', fg: '#4B5563' };
};

const ActivityBadge = ({ type, delta }) => {
  const tone = activityTone(type, delta);
  return (
    <span style={{ display: 'inline-flex', borderRadius: '999px', padding: '0.18rem 0.5rem', background: tone.bg, color: tone.fg, fontSize: '12px', fontWeight: 800 }}>
      {type || '-'}
    </span>
  );
};

export default function FiatWalletActivitiesPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [totalElements, setTotalElements] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const next = { ...emptyFilters };
    Object.keys(next).forEach((key) => {
      next[key] = params.get(key) || '';
    });
    if (Object.values(next).some(Boolean)) {
      setFilters(next);
      setAppliedFilters(next);
    }
  }, []);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      Object.entries(appliedFilters).forEach(([key, value]) => {
        const trimmed = String(value || '').trim();
        if (trimmed) params.set(key, key === 'currency' ? trimmed.toUpperCase() : trimmed);
      });
      const res = await api.fiatWalletActivities.list(params);
      setRows(Array.isArray(res) ? res : res?.content || []);
      setTotalElements(Array.isArray(res) ? null : res?.totalElements ?? null);
    } catch (err) {
      setError(err.message || 'Failed to load fiat wallet activities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => {
    setAppliedFilters(filters);
    setPage(0);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(0);
  };

  const openDetail = async (row) => {
    setSelected(row);
    setShowDetail(true);
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await api.fiatWalletActivities.get(row.id);
      setSelected(detail || row);
    } catch (err) {
      setError(err.message || 'Failed to load activity detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    {
      key: 'fiatWalletId',
      label: 'Wallet',
      render: (row) => (
        <Link href={`/dashboard/fiat-wallets?accountId=${encodeURIComponent(row.accountId || '')}&currency=${encodeURIComponent(row.currency || '')}`} style={{ color: 'var(--accent)', fontWeight: 700 }}>
          {row.fiatWalletId || '-'}
        </Link>
      )
    },
    {
      key: 'accountReference',
      label: 'Account',
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          {row.accountId ? (
            <Link href={`/dashboard/accounts/accounts/${row.accountId}`} style={{ color: 'var(--accent)', fontWeight: 700 }}>
              {row.accountReference || `Account ${row.accountId}`}
            </Link>
          ) : row.accountReference || '-'}
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.email || row.username || '-'}</span>
        </div>
      )
    },
    { key: 'currency', label: 'Currency' },
    { key: 'activityType', label: 'Type', render: (row) => <ActivityBadge type={row.activityType} delta={row.delta} /> },
    { key: 'delta', label: 'Delta', render: (row) => formatAmount(row.delta, row.currency) },
    { key: 'previousBalance', label: 'Previous', render: (row) => formatAmount(row.previousBalance, row.currency) },
    { key: 'newBalance', label: 'New', render: (row) => formatAmount(row.newBalance, row.currency) },
    {
      key: 'transactionReference',
      label: 'Transaction',
      render: (row) => row.transactionId ? (
        <Link href={`/dashboard/transactions?transactionId=${row.transactionId}`} style={{ color: 'var(--accent)', fontWeight: 700 }}>
          {row.transactionReference || row.transactionId}
        </Link>
      ) : row.transactionReference || '-'
    },
    { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => <button type="button" onClick={() => openDetail(row)} className="btn-neutral">View</button>
    }
  ], []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Fiat Wallet Activities</div>
          <div style={{ color: 'var(--muted)' }}>Read-only fiat wallet balance ledger. Use this instead of legacy account balance activities for new wallet movements.</div>
        </div>
        <Link href="/dashboard/accounts" className="btn-neutral">Accounts hub</Link>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
        <div style={{ width: '90px' }}>
          <label htmlFor="page">Page</label>
          <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
        </div>
        <div style={{ width: '90px' }}>
          <label htmlFor="size">Size</label>
          <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>
        <div style={{ minWidth: '130px' }}>
          <label htmlFor="fiatWalletId">Wallet ID</label>
          <input id="fiatWalletId" value={filters.fiatWalletId} onChange={(e) => updateFilter('fiatWalletId', e.target.value)} placeholder="10" />
        </div>
        <div style={{ minWidth: '130px' }}>
          <label htmlFor="accountId">Account ID</label>
          <input id="accountId" value={filters.accountId} onChange={(e) => updateFilter('accountId', e.target.value)} placeholder="7" />
        </div>
        <div style={{ width: '110px' }}>
          <label htmlFor="currency">Currency</label>
          <input id="currency" value={filters.currency} onChange={(e) => updateFilter('currency', e.target.value)} placeholder="CDF" />
        </div>
        <div style={{ minWidth: '160px' }}>
          <label htmlFor="activityType">Activity type</label>
          <input id="activityType" value={filters.activityType} onChange={(e) => updateFilter('activityType', e.target.value)} placeholder="DEPOSIT" />
        </div>
        <div style={{ minWidth: '180px' }}>
          <label htmlFor="transactionReference">Transaction ref</label>
          <input id="transactionReference" value={filters.transactionReference} onChange={(e) => updateFilter('transactionReference', e.target.value)} placeholder="TX123" />
        </div>
        <div style={{ minWidth: '200px' }}>
          <label htmlFor="userEmail">User email</label>
          <input id="userEmail" type="email" value={filters.userEmail} onChange={(e) => updateFilter('userEmail', e.target.value)} placeholder="user@example.com" />
        </div>
        <button type="button" onClick={applyFilters} className="btn-primary">Apply</button>
        <button type="button" onClick={clearFilters} className="btn-neutral">Clear</button>
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-neutral">{loading ? 'Loading...' : 'Refresh'}</button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
        {totalElements === null ? `${rows.length} visible activit${rows.length === 1 ? 'y' : 'ies'}` : `${totalElements} total activit${totalElements === 1 ? 'y' : 'ies'}`}
      </div>
      <DataTable columns={columns} rows={rows} emptyLabel={loading ? 'Loading fiat wallet activities...' : 'No fiat wallet activities found'} />

      {showDetail && (
        <Modal title={`Fiat wallet activity ${selected?.id ?? ''}`} onClose={() => setShowDetail(false)}>
          {detailLoading ? (
            <div style={{ color: 'var(--muted)' }}>Loading activity detail...</div>
          ) : (
            <DetailGrid
              rows={[
                { label: 'Activity ID', value: selected?.id },
                { label: 'Fiat wallet ID', value: selected?.fiatWalletId },
                { label: 'Account ID', value: selected?.accountId },
                { label: 'Account reference', value: selected?.accountReference },
                { label: 'User', value: selected?.userFullName || selected?.username },
                { label: 'Email', value: selected?.email },
                { label: 'Currency', value: selected?.currency },
                { label: 'Activity type', value: selected?.activityType },
                { label: 'Previous balance', value: formatAmount(selected?.previousBalance, selected?.currency) },
                { label: 'Delta', value: formatAmount(selected?.delta, selected?.currency) },
                { label: 'New balance', value: formatAmount(selected?.newBalance, selected?.currency) },
                { label: 'Transaction ID', value: selected?.transactionId },
                { label: 'Transaction ref', value: selected?.transactionReference },
                { label: 'Created', value: formatDateTime(selected?.createdAt) }
              ]}
            />
          )}
          <div className="modal-actions">
            {selected?.transactionId && (
              <Link href={`/dashboard/transactions?transactionId=${selected.transactionId}`} className="btn-primary">Open transaction</Link>
            )}
            {selected?.accountId && (
              <Link href={`/dashboard/accounts/accounts/${selected.accountId}`} className="btn-neutral">Open account</Link>
            )}
            <button type="button" onClick={() => setShowDetail(false)} className="btn-neutral">Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
