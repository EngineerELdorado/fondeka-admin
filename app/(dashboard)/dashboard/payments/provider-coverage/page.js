'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const initialFilters = {
  activeOnly: true,
  action: '',
  context: ''
};

const ACTIONS = [
  'FUND_WALLET',
  'WITHDRAW',
  'TRANSFER',
  'BUY_AIRTIME',
  'BUY_GIFT_CARD',
  'PAY_BILL',
  'PAY_TV_SUBSCRIPTION',
  'ORDER_BANK_ACCOUNT'
];

const CONTEXTS = ['COLLECTION', 'PAYOUT'];

const toList = (value) => (Array.isArray(value) ? value : []);

const methodName = (method) =>
  method?.paymentMethodName || method?.name || method?.paymentMethodCode || method?.code || `Method #${method?.paymentMethodId || method?.id || '—'}`;

const providerName = (provider) =>
  provider?.paymentProviderName || provider?.providerName || provider?.name || `Provider #${provider?.paymentProviderId || provider?.id || '—'}`;

const renderMethodList = (items) => {
  const list = toList(items);
  if (!list.length) return '—';
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
      {list.map((item, index) => (
        <span key={`${methodName(item)}-${index}`} style={{ border: '1px solid var(--border)', borderRadius: '999px', padding: '0.2rem 0.5rem', fontSize: '12px', fontWeight: 700 }}>
          {methodName(item)}
        </span>
      ))}
    </div>
  );
};

const renderProviderList = (items) => {
  const list = toList(items);
  if (!list.length) return '—';
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
      {list.map((item, index) => (
        <span key={`${providerName(item)}-${index}`} style={{ border: '1px solid var(--border)', borderRadius: '999px', padding: '0.2rem 0.5rem', fontSize: '12px', fontWeight: 700 }}>
          {providerName(item)}
        </span>
      ))}
    </div>
  );
};

const SharedBadge = ({ shared, uniqueProviderName }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.2rem 0.55rem',
    borderRadius: '999px',
    border: `1px solid ${shared ? '#BFDBFE' : '#FED7AA'}`,
    background: shared ? '#EFF6FF' : '#FFF7ED',
    color: shared ? '#1D4ED8' : '#9A3412',
    fontSize: '12px',
    fontWeight: 800
  }}>
    {shared ? 'Shared' : `Unique${uniqueProviderName ? `: ${uniqueProviderName}` : ''}`}
  </span>
);

export default function ProviderCoveragePage() {
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [providers, setProviders] = useState([]);
  const [view, setView] = useState('paymentMethods');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCoverage = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (appliedFilters.activeOnly) params.set('activeOnly', 'true');
      if (appliedFilters.action.trim()) params.set('action', appliedFilters.action.trim());
      if (appliedFilters.context.trim()) params.set('context', appliedFilters.context.trim());
      const res = await api.paymentMethodPaymentProviders.coverage(params);
      setPaymentMethods(toList(res?.paymentMethods));
      setProviders(toList(res?.providers));
    } catch (err) {
      setError(err.message);
      setPaymentMethods([]);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoverage();
  }, [appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => setAppliedFilters({ ...filters });

  const clearFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
  };

  const paymentMethodColumns = [
    { key: 'paymentMethodName', label: 'Payment method', render: (row) => methodName(row) },
    { key: 'paymentMethodCode', label: 'Code', render: (row) => row.paymentMethodCode || row.code || '—' },
    { key: 'providerCount', label: 'Providers' },
    { key: 'coverage', label: 'Coverage', render: (row) => <SharedBadge shared={Boolean(row.shared)} uniqueProviderName={row.uniqueProviderName} /> },
    { key: 'providers', label: 'Provider names', render: (row) => renderProviderList(row.providers) }
  ];

  const providerColumns = [
    { key: 'paymentProviderName', label: 'Provider', render: (row) => providerName(row) },
    { key: 'paymentMethodCount', label: 'Methods' },
    { key: 'sharedPaymentMethodCount', label: 'Shared' },
    { key: 'uniquePaymentMethodCount', label: 'Unique' },
    { key: 'sharedPaymentMethods', label: 'Shared methods', render: (row) => renderMethodList(row.sharedPaymentMethods) },
    { key: 'uniquePaymentMethods', label: 'Unique methods', render: (row) => renderMethodList(row.uniquePaymentMethods) }
  ];

  const rows = view === 'paymentMethods' ? paymentMethods : providers;
  const columns = view === 'paymentMethods' ? paymentMethodColumns : providerColumns;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Provider Coverage Map</div>
          <div style={{ color: 'var(--muted)' }}>Inspect shared and unique payment-method coverage across providers.</div>
        </div>
        <Link href="/dashboard/payments" className="btn-neutral" style={{ textDecoration: 'none' }}>
          Payments hub
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
          <input type="checkbox" checked={filters.activeOnly} onChange={(e) => setFilters((p) => ({ ...p, activeOnly: e.target.checked }))} />
          Active mappings only
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="action">Action</label>
          <input
            id="action"
            list="coverage-actions"
            placeholder="Any"
            value={filters.action}
            onChange={(e) => setFilters((p) => ({ ...p, action: e.target.value }))}
          />
          <datalist id="coverage-actions">
            {ACTIONS.map((item) => <option key={item} value={item} />)}
          </datalist>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="context">Context</label>
          <select id="context" value={filters.context} onChange={(e) => setFilters((p) => ({ ...p, context: e.target.value }))}>
            <option value="">Any</option>
            {CONTEXTS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={applyFilters} disabled={loading}>{loading ? 'Loading…' : 'Apply'}</button>
          <button type="button" className="btn-neutral" onClick={clearFilters} disabled={loading}>Clear</button>
          <button type="button" className="btn-neutral" onClick={fetchCoverage} disabled={loading}>Refresh</button>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className={view === 'paymentMethods' ? 'btn-primary' : 'btn-neutral'} onClick={() => setView('paymentMethods')}>
          Payment methods ({paymentMethods.length})
        </button>
        <button type="button" className={view === 'providers' ? 'btn-primary' : 'btn-neutral'} onClick={() => setView('providers')}>
          Providers ({providers.length})
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        pageSize={25}
        emptyLabel={loading ? 'Loading coverage…' : 'No coverage records found'}
        showAccountQuickNav={false}
      />
    </div>
  );
}
