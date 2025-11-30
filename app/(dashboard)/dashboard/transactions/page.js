'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const serviceOptions = ['WALLET', 'BILL_PAYMENTS', 'LENDING', 'CARD', 'CRYPTO', 'PAYMENT_REQUEST', 'E_SIM', 'AIRTIME_AND_DATA', 'GIFT_CARDS', 'OTHER'];
const actionOptions = [
  'BUY_CARD',
  'BUY_CRYPTO',
  'BUY_GIFT_CARD',
  'E_SIM_PURCHASE',
  'E_SIM_TOPUP',
  'FUND_CARD',
  'FUND_WALLET',
  'LOAN_DISBURSEMENT',
  'PAY_ELECTRICITY_BILL',
  'PAY_INTERNET_BILL',
  'PAY_REQUEST',
  'PAY_TV_SUBSCRIPTION',
  'PAY_WATER_BILL',
  'RECEIVE_CRYPTO',
  'REPAY_LOAN',
  'SELL_CRYPTO',
  'SEND_AIRTIME',
  'SEND_CRYPTO',
  'WITHDRAW_FROM_WALLET'
].sort();
const balanceEffectOptions = ['CREDIT', 'DEBIT', 'NONE'];
const statusOptions = ['COMPLETED', 'PROCESSING', 'FAILED', 'PENDING', 'CANCELLED', 'REFUNDED', 'REVERSED'];

const initialFilters = {
  reference: '',
  externalReference: '',
  operatorReference: '',
  idempotencyKey: '',
  action: '',
  service: '',
  balanceEffect: '',
  status: '',
  paymentMethodId: '',
  paymentProviderId: '',
  paymentMethodPaymentProviderId: '',
  accountReference: '',
  userReference: '',
  userNameContains: '',
  minAmount: '',
  maxAmount: '',
  refunded: '',
  startDate: '',
  endDate: ''
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700 }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

const FilterChip = ({ label, onClear }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.35rem',
      padding: '0.35rem 0.6rem',
      background: 'var(--muted-bg, #f3f4f6)',
      borderRadius: '999px',
      fontSize: '13px',
      color: 'var(--text)'
    }}
  >
    {label}
    <button
      type="button"
      onClick={onClear}
      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}
      aria-label={`Clear ${label}`}
    >
      ×
    </button>
  </span>
);

export default function TransactionsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentProviders, setPaymentProviders] = useState([]);
  const [pmps, setPmps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);

  const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      const addIf = (key, value) => {
        if (value !== '' && value !== null && value !== undefined) params.set(key, String(value));
      };
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        if (['minAmount', 'maxAmount', 'paymentMethodId', 'paymentProviderId', 'paymentMethodPaymentProviderId'].includes(key)) {
          const num = Number(value);
          if (!Number.isNaN(num)) addIf(key, num);
        } else if (['startDate', 'endDate'].includes(key)) {
          const ts = Date.parse(value);
          if (!Number.isNaN(ts)) addIf(key, ts);
        } else if (key === 'refunded') {
          addIf(key, value);
        } else {
          addIf(key, value);
        }
      });
      const res = await api.transactions.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStatusBadge = (value) => {
    if (!value) return '—';
    const val = String(value).toUpperCase();
    const tone =
      val === 'COMPLETED'
        ? { bg: '#ECFDF3', fg: '#15803D' }
        : val === 'PROCESSING'
          ? { bg: '#EFF6FF', fg: '#1D4ED8' }
          : val === 'FAILED'
            ? { bg: '#FEF2F2', fg: '#B91C1C' }
            : val === 'CANCELED' || val === 'CANCELLED'
              ? { bg: '#FFF7ED', fg: '#C2410C' }
              : { bg: '#E5E7EB', fg: '#374151' };
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.2rem 0.5rem',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 700,
          background: tone.bg,
          color: tone.fg
        }}
      >
        {val}
      </span>
    );
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [pmRes, provRes, pmpRes] = await Promise.all([
          api.paymentMethods.list(new URLSearchParams({ page: '0', size: '200' })),
          api.paymentProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.paymentMethodPaymentProviders.list(new URLSearchParams({ page: '0', size: '200' }))
        ]);
        const toList = (res) => (Array.isArray(res) ? res : res?.content || []);
        setPaymentMethods(toList(pmRes));
        setPaymentProviders(toList(provRes));
        setPmps(toList(pmpRes));
      } catch {
        // soft fail on options fetch
      }
    };
    fetchOptions();
  }, []);

  const applyFilters = () => {
    setPage(0);
    setAppliedFilters(filters);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(0);
  };

  const activeFilterChips = useMemo(() => {
    const entries = [];
    const add = (label, key) => {
      entries.push({
        label,
        key
      });
    };
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
      switch (key) {
        case 'reference':
          add(`Reference: ${value}`, key);
          break;
        case 'externalReference':
          add(`External: ${value}`, key);
          break;
        case 'operatorReference':
          add(`Operator ref: ${value}`, key);
          break;
        case 'idempotencyKey':
          add(`Idempotency: ${value}`, key);
          break;
        case 'action':
          add(`Action: ${value}`, key);
          break;
        case 'service':
          add(`Service: ${value}`, key);
          break;
        case 'balanceEffect':
          add(`Effect: ${value}`, key);
          break;
        case 'status':
          add(`Status: ${value}`, key);
          break;
        case 'paymentMethodId':
          add(`Payment method #${value}`, key);
          break;
        case 'paymentProviderId':
          add(`Payment provider #${value}`, key);
          break;
        case 'paymentMethodPaymentProviderId':
          add(`PMPP #${value}`, key);
          break;
        case 'accountReference':
          add(`Account: ${value}`, key);
          break;
        case 'userReference':
          add(`User: ${value}`, key);
          break;
        case 'userNameContains':
          add(`Username contains: ${value}`, key);
          break;
        case 'minAmount':
          add(`Min amount: ${value}`, key);
          break;
        case 'maxAmount':
          add(`Max amount: ${value}`, key);
          break;
        case 'refunded':
          add(`Refunded: ${value}`, key);
          break;
        case 'startDate':
          add(`From: ${value}`, key);
          break;
        case 'endDate':
          add(`To: ${value}`, key);
          break;
        default:
          break;
      }
    });
    return entries;
  }, [appliedFilters]);

  const columns = useMemo(
    () => [
      {
        key: 'id',
        label: 'ID',
        render: (row) => row.transactionId || row.id
      },
      {
        key: 'createdAt',
        label: 'Created',
        render: (row) => formatDateTime(row.createdAt)
      },
      { key: 'reference', label: 'Reference' },
      { key: 'externalReference', label: 'External ref' },
      { key: 'service', label: 'Service' },
      { key: 'action', label: 'Action' },
      { key: 'balanceEffect', label: 'Effect' },
      {
        key: 'status',
        label: 'Status',
        render: (row) => renderStatusBadge(row.status)
      },
      {
        key: 'amount',
        label: 'Amount',
        render: (row) => `${row.amount ?? '—'} ${row.currency || ''}`.trim()
      },
      { key: 'paymentMethodName', label: 'Method' },
      { key: 'paymentProviderName', label: 'Provider' },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openDetail(row)} className="btn-neutral">
              View
            </button>
          </div>
        )
      }
    ],
    []
  );

  const openDetail = (row) => {
    setSelected(row);
    setShowDetail(true);
    setInfo(null);
    setError(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Transactions</div>
          <div style={{ color: 'var(--muted)' }}>Trace transactions with deep filters and quick drill-down.</div>
        </div>
        <Link href="/dashboard" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Dashboard
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="reference">Reference</label>
            <input id="reference" value={filters.reference} onChange={(e) => setFilters((p) => ({ ...p, reference: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="externalReference">External ref</label>
            <input id="externalReference" value={filters.externalReference} onChange={(e) => setFilters((p) => ({ ...p, externalReference: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="operatorReference">Operator ref</label>
            <input id="operatorReference" value={filters.operatorReference} onChange={(e) => setFilters((p) => ({ ...p, operatorReference: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="idempotencyKey">Idempotency key</label>
            <input id="idempotencyKey" value={filters.idempotencyKey} onChange={(e) => setFilters((p) => ({ ...p, idempotencyKey: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="service">Service</label>
            <select id="service" value={filters.service} onChange={(e) => setFilters((p) => ({ ...p, service: e.target.value }))}>
              <option value="">All</option>
              {serviceOptions.map((svc) => (
                <option key={svc} value={svc}>
                  {svc}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="action">Action</label>
            <select id="action" value={filters.action} onChange={(e) => setFilters((p) => ({ ...p, action: e.target.value }))}>
              <option value="">All</option>
              {actionOptions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="balanceEffect">Effect</label>
            <select id="balanceEffect" value={filters.balanceEffect} onChange={(e) => setFilters((p) => ({ ...p, balanceEffect: e.target.value }))}>
              <option value="">Any</option>
              {balanceEffectOptions.map((be) => (
                <option key={be} value={be}>
                  {be}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="status">Status</label>
            <select id="status" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
              <option value="">Any</option>
              {statusOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="paymentMethodId">Payment method</label>
            <select id="paymentMethodId" value={filters.paymentMethodId} onChange={(e) => setFilters((p) => ({ ...p, paymentMethodId: e.target.value }))}>
              <option value="">Any</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name || pm.displayName || pm.id}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="paymentProviderId">Payment provider</label>
            <select id="paymentProviderId" value={filters.paymentProviderId} onChange={(e) => setFilters((p) => ({ ...p, paymentProviderId: e.target.value }))}>
              <option value="">Any</option>
              {paymentProviders.map((prov) => (
                <option key={prov.id} value={prov.id}>
                  {prov.name || prov.displayName || prov.id}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="paymentMethodPaymentProviderId">PMPP</label>
            <select
              id="paymentMethodPaymentProviderId"
              value={filters.paymentMethodPaymentProviderId}
              onChange={(e) => setFilters((p) => ({ ...p, paymentMethodPaymentProviderId: e.target.value }))}
            >
              <option value="">Any</option>
              {pmps.map((pmp) => (
                <option key={pmp.id} value={pmp.id}>
                  {(pmp.paymentMethodName || pmp.paymentMethodDisplayName || 'Method') + ' → ' + (pmp.paymentProviderName || 'Provider')}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="refunded">Refunded</label>
            <select id="refunded" value={filters.refunded} onChange={(e) => setFilters((p) => ({ ...p, refunded: e.target.value }))}>
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="accountReference">Account ref</label>
            <input id="accountReference" value={filters.accountReference} onChange={(e) => setFilters((p) => ({ ...p, accountReference: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="userReference">User ref</label>
            <input id="userReference" value={filters.userReference} onChange={(e) => setFilters((p) => ({ ...p, userReference: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="userNameContains">Username contains</label>
            <input id="userNameContains" value={filters.userNameContains} onChange={(e) => setFilters((p) => ({ ...p, userNameContains: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="minAmount">Min amount</label>
              <input id="minAmount" type="number" value={filters.minAmount} onChange={(e) => setFilters((p) => ({ ...p, minAmount: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="maxAmount">Max amount</label>
              <input id="maxAmount" type="number" value={filters.maxAmount} onChange={(e) => setFilters((p) => ({ ...p, maxAmount: e.target.value }))} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="startDate">Start date</label>
            <input id="startDate" type="datetime-local" value={filters.startDate} onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="endDate">End date</label>
            <input id="endDate" type="datetime-local" value={filters.endDate} onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="page">Page</label>
              <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="size">Size</label>
              <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={applyFilters} disabled={loading} className="btn-primary">
            {loading ? 'Applying…' : 'Apply filters'}
          </button>
          <button type="button" onClick={resetFilters} disabled={loading} className="btn-neutral">
            Reset
          </button>
          <button type="button" onClick={fetchRows} disabled={loading} className="btn-neutral">
            {loading ? 'Refreshing…' : 'Refresh data'}
          </button>
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Set filters then apply to query.</span>
        </div>

        {activeFilterChips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {activeFilterChips.map((chip) => (
              <FilterChip
                key={chip.key}
                label={chip.label}
                onClear={() => {
                  const next = { ...appliedFilters, [chip.key]: '' };
                  setAppliedFilters(next);
                  setFilters((p) => ({ ...p, [chip.key]: '' }));
                }}
              />
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}
      {info && (
        <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>
          {info}
        </div>
      )}

      <DataTable columns={columns} rows={rows} emptyLabel="No transactions found" />

      {showDetail && (
        <Modal title={`Transaction ${selected?.reference || selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'Transaction ID', value: selected?.transactionId || selected?.id },
              { label: 'Created', value: formatDateTime(selected?.createdAt) },
              { label: 'Reference', value: selected?.reference },
              { label: 'External ref', value: selected?.externalReference },
              { label: 'Operator ref', value: selected?.operatorReference },
              { label: 'Service', value: selected?.service },
              { label: 'Action', value: selected?.action },
              { label: 'Effect', value: selected?.balanceEffect },
              { label: 'Status', value: selected?.status },
              { label: 'Amount', value: `${selected?.amount ?? '—'} ${selected?.currency || ''}`.trim() },
              { label: 'Gross amount', value: selected?.grossAmount },
              { label: 'External fee', value: selected?.externalFeeAmount },
              { label: 'Internal fee', value: selected?.internalFeeAmount },
              { label: 'Other fees', value: selected?.otherFeesAmount },
              { label: 'All fees', value: selected?.allFees },
              { label: 'Commission amount', value: selected?.commissionAmount },
              { label: 'Recipient', value: selected?.recipient },
              { label: 'Payment method', value: selected?.paymentMethodName || selected?.paymentMethodId },
              { label: 'Payment provider', value: selected?.paymentProviderName || selected?.paymentProviderId },
              { label: 'Refunded', value: selected?.refunded ? 'Yes' : 'No' }
            ]}
          />
        </Modal>
      )}
    </div>
  );
}
