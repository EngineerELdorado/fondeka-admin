'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
    ? num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: Math.abs(num) >= 1 ? 2 : 6 })
    : String(value);
  return [amount, currency].filter(Boolean).join(' ');
};

const formatRate = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString(undefined, { maximumFractionDigits: 12 }) : String(value);
};

const badge = (value, truthyLabel = 'Yes', falseLabel = 'No') => {
  const active = value === true;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      borderRadius: '999px',
      padding: '0.18rem 0.5rem',
      fontSize: '12px',
      fontWeight: 700,
      background: active ? '#ECFDF3' : '#F3F4F6',
      color: active ? '#15803D' : '#6B7280'
    }}>
      {active ? truthyLabel : falseLabel}
    </span>
  );
};

export default function FiatWalletsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [totalElements, setTotalElements] = useState(null);
  const [accountId, setAccountId] = useState('');
  const [accountReference, setAccountReference] = useState('');
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activityRows, setActivityRows] = useState([]);
  const [activityPage, setActivityPage] = useState(0);
  const [activitySize, setActivitySize] = useState(20);
  const [activityTotalElements, setActivityTotalElements] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const nextAccountId = params.get('accountId') || '';
    const nextAccountReference = params.get('accountReference') || '';
    const nextEmail = params.get('email') || '';
    const nextCurrency = params.get('currency') || '';
    if (nextAccountId || nextAccountReference || nextEmail || nextCurrency) {
      setAccountId(nextAccountId);
      setAccountReference(nextAccountReference);
      setEmail(nextEmail);
      setCurrency(nextCurrency);
      setPage(0);
    }
  }, []);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      if (accountId.trim()) params.set('accountId', accountId.trim());
      if (accountReference.trim()) params.set('accountReference', accountReference.trim());
      if (email.trim()) params.set('email', email.trim());
      if (currency.trim()) params.set('currency', currency.trim().toUpperCase());
      const res = await api.fiatWallets.list(params);
      setRows(Array.isArray(res) ? res : res?.content || []);
      setTotalElements(Array.isArray(res) ? null : res?.totalElements ?? null);
    } catch (err) {
      setError(err.message || 'Failed to load fiat wallets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, accountId, accountReference, email, currency]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (row) => {
    setSelected(row);
    setShowDetail(true);
    setDetailLoading(true);
    setActivityPage(0);
    setActivityRows([]);
    setActivityTotalElements(null);
    setActivityError(null);
    setError(null);
    try {
      const detail = await api.fiatWallets.get(row.id);
      setSelected(detail || row);
    } catch (err) {
      setError(err.message || 'Failed to load fiat wallet detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const loadWalletActivities = async (walletId = selected?.id) => {
    if (!walletId) return;
    setActivityLoading(true);
    setActivityError(null);
    try {
      const params = new URLSearchParams({ page: String(activityPage), size: String(activitySize) });
      const res = await api.fiatWallets.activities(walletId, params);
      setActivityRows(Array.isArray(res) ? res : res?.content || []);
      setActivityTotalElements(Array.isArray(res) ? null : res?.totalElements ?? null);
    } catch (err) {
      setActivityError(err.message || 'Failed to load wallet activities');
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (!showDetail || !selected?.id) return;
    loadWalletActivities(selected.id);
  }, [showDetail, selected?.id, activityPage, activitySize]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearFilters = () => {
    setAccountId('');
    setAccountReference('');
    setEmail('');
    setCurrency('');
    setPage(0);
  };

  const columns = useMemo(() => [
    { key: 'id', label: 'Wallet ID' },
    {
      key: 'accountReference',
      label: 'Account',
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          <Link href={`/dashboard/accounts/accounts/${row.accountId}`} style={{ color: 'var(--accent)', fontWeight: 700 }}>
            {row.accountReference || `Account ${row.accountId}`}
          </Link>
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.name || '-'}</span>
        </div>
      )
    },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    {
      key: 'currency',
      label: 'Currency',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {row.logoUrl ? (
            <span
              aria-hidden="true"
              style={{
                width: 20,
                height: 20,
                borderRadius: '999px',
                backgroundImage: `url(${row.logoUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                flexShrink: 0
              }}
            />
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem' }}>
            <span style={{ fontWeight: 800 }}>{row.currency || '-'}</span>
            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.displayName || '-'}</span>
          </div>
        </div>
      )
    },
    { key: 'balance', label: 'Balance', render: (row) => formatAmount(row.balance, row.currency) },
    { key: 'walletEnabled', label: 'Wallet enabled', render: (row) => badge(row.walletEnabled) },
    { key: 'legacyBalanceBacked', label: 'Legacy backed', render: (row) => badge(row.legacyBalanceBacked) },
    {
      key: 'rate',
      label: 'USD rate',
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          <span>{formatRate(row.rate)}</span>
          <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.rateProvider || '-'}</span>
        </div>
      )
    },
    { key: 'updatedAt', label: 'Updated', render: (row) => formatDateTime(row.updatedAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={() => openDetail(row)}>View</button>
          <Link href={`/dashboard/accounts/balance-activities?fiatWalletId=${encodeURIComponent(row.id)}`} className="btn-neutral">Ledger</Link>
          <Link href={`/dashboard/accounts/accounts/${row.accountId}`} className="btn-neutral">Account</Link>
        </div>
      )
    }
  ], []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Fiat Wallets</div>
          <div style={{ color: 'var(--muted)' }}>Search account fiat wallets across currencies. Use account detail for manual credit and debit operations.</div>
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
          <input id="size" type="number" min={1} max={500} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>
        <div style={{ minWidth: '140px' }}>
          <label htmlFor="accountId">Account ID</label>
          <input id="accountId" value={accountId} onChange={(e) => { setPage(0); setAccountId(e.target.value); }} placeholder="7" />
        </div>
        <div style={{ minWidth: '170px' }}>
          <label htmlFor="accountReference">Account reference</label>
          <input id="accountReference" value={accountReference} onChange={(e) => { setPage(0); setAccountReference(e.target.value); }} placeholder="ACC-123" />
        </div>
        <div style={{ minWidth: '200px' }}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => { setPage(0); setEmail(e.target.value); }} placeholder="user@example.com" />
        </div>
        <div style={{ width: '120px' }}>
          <label htmlFor="currency">Currency</label>
          <input id="currency" value={currency} onChange={(e) => { setPage(0); setCurrency(e.target.value); }} placeholder="CDF" />
        </div>
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <button type="button" onClick={clearFilters} className="btn-neutral">Clear filters</button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
        {totalElements === null ? `${rows.length} visible wallet${rows.length === 1 ? '' : 's'}` : `${totalElements} total wallet${totalElements === 1 ? '' : 's'}`}
      </div>
      <DataTable columns={columns} rows={rows} emptyLabel={loading ? 'Loading fiat wallets...' : 'No fiat wallets found'} />

      {showDetail && (
        <Modal title={`Fiat wallet ${selected?.id ?? ''}`} onClose={() => setShowDetail(false)}>
          {detailLoading ? (
            <div style={{ color: 'var(--muted)' }}>Loading wallet detail...</div>
          ) : (
            <DetailGrid
              rows={[
                { label: 'Wallet ID', value: selected?.id },
                { label: 'Account ID', value: selected?.accountId },
                { label: 'Account reference', value: selected?.accountReference },
                { label: 'Name', value: selected?.name },
                { label: 'Email', value: selected?.email },
                { label: 'Phone', value: selected?.phone },
                { label: 'Currency product ID', value: selected?.currencyProductId },
                { label: 'Currency', value: selected?.currency },
                { label: 'Display name', value: selected?.displayName },
                { label: 'Balance', value: formatAmount(selected?.balance, selected?.currency) },
                { label: 'Wallet enabled', value: selected?.walletEnabled === true ? 'Yes' : 'No' },
                { label: 'Legacy balance backed', value: selected?.legacyBalanceBacked === true ? 'Yes' : 'No' },
                { label: 'Base currency', value: selected?.baseCurrency },
                { label: 'Rate', value: formatRate(selected?.rate) },
                { label: 'Rate provider', value: selected?.rateProvider },
                { label: 'Rate fetched at', value: formatDateTime(selected?.rateFetchedAt) },
                { label: 'Created', value: formatDateTime(selected?.createdAt) },
                { label: 'Updated', value: formatDateTime(selected?.updatedAt) }
              ]}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800 }}>Balance ledger</div>
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                  Wallet-scoped fiat wallet activities. Latest new balance should reconcile to the wallet balance.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--muted)', fontSize: '12px' }}>
                  Page
                  <input type="number" min={0} value={activityPage} onChange={(e) => setActivityPage(Number(e.target.value))} style={{ width: 70 }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--muted)', fontSize: '12px' }}>
                  Size
                  <input type="number" min={1} value={activitySize} onChange={(e) => setActivitySize(Number(e.target.value))} style={{ width: 70 }} />
                </label>
                <button type="button" className="btn-neutral" disabled={activityLoading} onClick={() => loadWalletActivities()}>
                  {activityLoading ? 'Loading...' : 'Refresh'}
                </button>
                {selected?.id && (
                  <Link href={`/dashboard/accounts/balance-activities?fiatWalletId=${encodeURIComponent(selected.id)}`} className="btn-neutral">
                    Full ledger
                  </Link>
                )}
              </div>
            </div>
            {activityError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{activityError}</div>}
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              {activityTotalElements === null ? `${activityRows.length} visible activit${activityRows.length === 1 ? 'y' : 'ies'}` : `${activityTotalElements} total activit${activityTotalElements === 1 ? 'y' : 'ies'}`}
            </div>
            <DataTable
              columns={[
                { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
                { key: 'activityType', label: 'Type' },
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
                }
              ]}
              rows={activityRows}
              emptyLabel={activityLoading ? 'Loading wallet activities...' : 'No wallet activities found'}
            />
          </div>
          <div className="modal-actions">
            {selected?.accountId && (
              <Link href={`/dashboard/accounts/accounts/${selected.accountId}`} className="btn-primary">Open account</Link>
            )}
            <button type="button" onClick={() => setShowDetail(false)} className="btn-neutral">Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
