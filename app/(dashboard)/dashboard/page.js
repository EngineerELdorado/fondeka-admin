'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { api } from '@/lib/api';

const DISPLAY_LOCALE = 'en-US';

const formatNumber = (val) => {
  if (val === null || val === undefined) return '—';
  const num = Number(val);
  if (Number.isNaN(num)) return val;
  return num.toLocaleString(DISPLAY_LOCALE);
};

const formatCurrency = (val) => {
  if (val === null || val === undefined) return '—';
  const num = Number(val);
  if (Number.isNaN(num)) return val;
  return num.toLocaleString(DISPLAY_LOCALE, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(DISPLAY_LOCALE, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatInputDate = (date) => {
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const toMillis = (value, { endOfDay = false } = {}) => {
  if (!value) return null;
  const raw = String(value);
  const hasTime = raw.includes('T');
  let date;
  if (hasTime) {
    date = new Date(raw);
  } else {
    const [y, m, d] = raw.split('-').map((v) => Number(v));
    if (!y || !m || !d) return null;
    date = new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  }
  if (Number.isNaN(date.getTime())) return null;
  if (hasTime && !endOfDay) return date.getTime();
  if (hasTime && endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date.getTime();
};

const formatInputDateTime = (date) => {
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const serviceOptions = ['WALLET', 'BILL_PAYMENTS', 'LENDING', 'CARD', 'CRYPTO', 'PAYMENT_REQUEST', 'E_SIM', 'AIRTIME_AND_DATA', 'OTHER'];
const actionOptions = [
  'BUY_CARD',
  'BUY_CRYPTO',
  'BUY_GIFT_CARD',
  'E_SIM_PURCHASE',
  'E_SIM_TOPUP',
  'FUND_CARD',
  'FUND_WALLET',
  'INTER_TRANSFER',
  'LOAN_DISBURSEMENT',
  'LOAN_REQUEST',
  'PAY_BILL',
  'PAY_ELECTRICITY_BILL',
  'PAY_INTERNET_BILL',
  'PAY_TV_SUBSCRIPTION',
  'PAY_WATER_BILL',
  'PAY_REQUEST',
  'REPAY_LOAN',
  'SELL_CRYPTO',
  'SEND_AIRTIME',
  'SEND_CRYPTO',
  'WITHDRAW_FROM_CARD',
  'WITHDRAW_FROM_WALLET'
].sort();
const statusOptions = ['INITIATED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED'];

const initialFilters = (() => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return {
    accountId: '',
    accountReference: '',
    userReference: '',
    userEmail: '',
    userPhone: '',
    countryId: '',
    service: '',
    action: '',
    status: '',
    paymentMethodId: '',
    paymentProviderId: '',
    billProductId: '',
    billProviderId: '',
    startDate: formatInputDate(start),
    endDate: formatInputDate(end)
  };
})();

const Pill = ({ children, tone = 'var(--accent)', soft }) => (
  <span
    className="pill"
    style={{
      background: soft || 'var(--accent-soft)',
      color: tone,
      fontWeight: 700,
      border: `1px solid color-mix(in srgb, ${tone} 32%, transparent)`
    }}
  >
    {children}
  </span>
);

const Table = ({ columns, rows, emptyLabel = 'No data' }) => (
  <div className="table-scroll">
    <div className="table-scroll__hint">Swipe to see more</div>
    <table className="data-table">
      <thead>
        <tr style={{ color: 'var(--muted)' }}>
          {columns.map((col) => (
            <th key={col.key} className="data-table__cell" style={{ textAlign: 'left', padding: '0.5rem' }}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(!rows || rows.length === 0) && (
          <tr>
            <td colSpan={columns.length} style={{ padding: '0.75rem', color: 'var(--muted)' }}>
              {emptyLabel}
            </td>
          </tr>
        )}
        {rows?.map((row, idx) => (
          <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
            {columns.map((col) => (
              <td key={col.key} className="data-table__cell" style={{ padding: '0.5rem', fontWeight: col.bold ? 700 : 500 }}>
                {col.render ? col.render(row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

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

const RefreshIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M20 12a8 8 0 1 1-2.2-5.6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M20 5v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const formatCryptoHoldings = (list) =>
  (list || []).map((item, idx) => ({
    id: item.productNetworkId || idx,
    asset: `${item.productName || item.symbol || 'Asset'} • ${item.networkName || ''}`.trim(),
    symbol: item.symbol || '—',
    balance: item.balance ?? '0',
    balanceFiat: item.balanceFiat ?? '0'
  }));

export default function DashboardPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [datePreset, setDatePreset] = useState('');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentProviders, setPaymentProviders] = useState([]);
  const [billProducts, setBillProducts] = useState([]);
  const [billProviders, setBillProviders] = useState([]);
  const [countries, setCountries] = useState([]);
  const [showHoldings, setShowHoldings] = useState(false);
  const refreshInFlight = useRef(false);

  const applyFilters = () => {
    setAppliedFilters(filters);
    setShowFilters(false);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setDatePreset('');
  };

  const fetchDashboard = useCallback(
    async ({ silent = false } = {}) => {
      if (refreshInFlight.current) return;
      refreshInFlight.current = true;
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      try {
        const params = new URLSearchParams();
        Object.entries(appliedFilters).forEach(([key, value]) => {
          if (value === '' || value === null || value === undefined) return;
          if (['accountId', 'countryId', 'paymentMethodId', 'paymentProviderId', 'billProductId', 'billProviderId'].includes(key)) {
            const num = Number(value);
            if (!Number.isNaN(num)) params.set(key, String(num));
          } else if (['startDate', 'endDate'].includes(key)) {
            const ts = toMillis(value, { endOfDay: key === 'endDate' });
            if (ts !== null) params.set(key, String(ts));
          } else {
            params.set(key, String(value));
          }
        });
        const res = await api.getDashboard(params);
        setData(res || null);
        setLastUpdated(new Date());
      } catch (err) {
        setError(err.message);
      } finally {
        refreshInFlight.current = false;
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [appliedFilters]
  );

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboard({ silent: true });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboard]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [pmRes, provRes, billProductRes, billProviderRes, countryRes] = await Promise.all([
          api.paymentMethods.list(new URLSearchParams({ page: '0', size: '200' })),
          api.paymentProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.billProducts.list(new URLSearchParams({ page: '0', size: '200' })),
          api.billProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.countries.list(new URLSearchParams({ page: '0', size: '200' }))
        ]);
        const toList = (res) => (Array.isArray(res) ? res : res?.content || []);
        setPaymentMethods(toList(pmRes));
        setPaymentProviders(toList(provRes));
        setBillProducts(toList(billProductRes));
        setBillProviders(toList(billProviderRes));
        setCountries(toList(countryRes));
      } catch {
        // silent fail; dropdowns will stay empty
      }
    };
    fetchOptions();
  }, []);


  const totals = data?.totals || {};
  const metrics = data?.metrics || {};
  const timeseries = data?.timeseries || [];
  const holdings = data?.holdings || {};
  const chartData = useMemo(
    () =>
      (timeseries || [])
        .slice()
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((p) => ({
          ...p,
          label: p.date
        })),
    [timeseries]
  );

  const dateLabel = useMemo(() => {
    const start = appliedFilters.startDate ? new Date(appliedFilters.startDate) : null;
    const end = appliedFilters.endDate ? new Date(appliedFilters.endDate) : null;
    const today = new Date();
    const sameDay = start && end && start.toDateString() === end.toDateString();
    const isToday =
      start &&
      end &&
      sameDay &&
      start.getFullYear() === today.getFullYear() &&
      start.getMonth() === today.getMonth() &&
      start.getDate() === today.getDate();

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const isYesterday =
      start &&
      end &&
      sameDay &&
      start.getFullYear() === yesterday.getFullYear() &&
      start.getMonth() === yesterday.getMonth() &&
      start.getDate() === yesterday.getDate();

    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday as first
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    const isThisWeek =
      start &&
      end &&
      start.getTime() === startOfWeek.getTime() &&
      end.getFullYear() === today.getFullYear() &&
      end.getMonth() === today.getMonth();

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    const isThisMonth =
      start &&
      end &&
      start.getTime() === startOfMonth.getTime() &&
      end.getFullYear() === endOfMonth.getFullYear() &&
      end.getMonth() === endOfMonth.getMonth() &&
      end.getDate() === endOfMonth.getDate();

    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999);
    const isThisYear =
      start &&
      end &&
      start.getTime() === startOfYear.getTime() &&
      end.getFullYear() === endOfYear.getFullYear() &&
      end.getMonth() === endOfYear.getMonth() &&
      end.getDate() === endOfYear.getDate();

    if (isToday) return 'Viewing today';
    if (isYesterday) return 'Viewing yesterday';
    if (isThisWeek) return 'Viewing this week';
    if (isThisMonth) return 'Viewing this month';
    if (isThisYear) return 'Viewing this year';
    if (start && end) {
      return `${formatDateTime(start)} → ${formatDateTime(end)}`;
    }
    return 'Date range not set';
  }, [appliedFilters.startDate, appliedFilters.endDate]);

  const activeFilterCount = useMemo(
    () => Object.values(appliedFilters).filter((v) => v !== '' && v !== null && v !== undefined).length,
    [appliedFilters]
  );

  const totalRevenue = useMemo(() => {
    if (totals.revenue !== undefined && totals.revenue !== null) return Number(totals.revenue) || 0;
    const fee = Number(totals.fee ?? totals.feeRevenue) || 0;
    const commission = Number(totals.commission ?? totals.commissionRevenue) || 0;
    return fee + commission;
  }, [totals]);

  const kpiCards = [
    { label: 'Fiat balance', value: formatCurrency(holdings.fiatBalanceTotal), sub: 'Across fiat accounts', tone: '#2563eb' },
    {
      label: 'Crypto balance (USD)',
      value: formatCurrency(holdings.cryptoBalanceFiat),
      sub: 'All crypto converted',
      tone: '#0ea5e9',
      onClick: () => setShowHoldings(true)
    },
    { label: 'Transactions', value: formatNumber(totals.totalCount), sub: `Volume ${formatCurrency(totals.totalVolume)}` },
    { label: 'Completed', value: formatNumber(totals.completedCount), sub: `Volume ${formatCurrency(totals.completedVolume)}`, tone: '#16a34a' },
    { label: 'Failed', value: formatNumber(totals.failedCount), sub: `Volume ${formatCurrency(totals.failedVolume)}`, tone: '#b91c1c' },
    { label: 'Processing', value: formatNumber(totals.processingCount), sub: `Volume ${formatCurrency(totals.processingVolume)}`, tone: '#1d4ed8' },
    {
      label: 'Revenue',
      value: formatCurrency(totalRevenue),
      sub: 'Total revenue',
      tone: '#7c3aed'
    }
  ];

  const applyDatePreset = (preset) => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (preset === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      setFilters((p) => ({ ...p, startDate: formatInputDate(start), endDate: formatInputDate(end) }));
      setDatePreset(preset);
      return;
    }

    if (preset === 'last7') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 6);
      setFilters((p) => ({ ...p, startDate: formatInputDate(start), endDate: formatInputDate(end) }));
      setDatePreset(preset);
      return;
    }

    if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      setFilters((p) => ({ ...p, startDate: formatInputDate(start), endDate: formatInputDate(end) }));
      setDatePreset(preset);
      return;
    }

    if (preset === 'year') {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      setFilters((p) => ({ ...p, startDate: formatInputDate(start), endDate: formatInputDate(end) }));
      setDatePreset(preset);
      return;
    }

    setFilters((p) => ({ ...p, startDate: '', endDate: '' }));
    setDatePreset('');
  };

  const metricCards = [
    { key: 'cardsIssued', label: 'Cards issued' },
    { key: 'loansDisbursed', label: 'Loans disbursed' },
    { key: 'loanDisbursedVolume', label: 'Loan disbursed volume' },
    { key: 'loansOpen', label: 'Loans open' },
    { key: 'loansOutstanding', label: 'Loans outstanding' },
    { key: 'esimsPurchased', label: 'eSIM purchases' },
    { key: 'airtimePurchases', label: 'Airtime purchases' },
    { key: 'billPayments', label: 'Bill payments' },
    { key: 'cryptoTransactions', label: 'Crypto transactions' },
    { key: 'kycApproved', label: 'KYC approved' },
    { key: 'newAccounts', label: 'New accounts' },
    { key: 'activeAccounts', label: 'Active accounts' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'grid', gap: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 900, fontSize: '22px' }}>Performance</div>
              <div className="pill" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 900, fontSize: '13px' }}>
                {dateLabel}
              </div>
            </div>
            <div style={{ color: 'var(--muted)' }}>Clean view across services, rails, geos, and accounts.</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setAutoRefresh((prev) => !prev)} aria-pressed={autoRefresh} className="btn-neutral btn-sm">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                <RefreshIcon size={14} />
                Auto refresh
                <span
                  aria-hidden="true"
                  style={{
                    position: 'relative',
                    width: '30px',
                    height: '16px',
                    borderRadius: '999px',
                    border: `1px solid ${autoRefresh ? 'var(--accent)' : 'var(--border)'}`,
                    background: autoRefresh ? 'color-mix(in srgb, var(--accent) 12%, var(--surface))' : 'var(--bg)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '1px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '999px',
                      background: autoRefresh ? 'var(--accent)' : 'var(--muted)',
                      transform: autoRefresh ? 'translateX(14px)' : 'translateX(0)',
                      transition: 'all 0.2s ease'
                    }}
                  />
                </span>
              </span>
            </button>
            <button type="button" onClick={() => fetchDashboard()} className="btn-neutral" disabled={loading}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <RefreshIcon size={14} />
                {loading ? 'Refreshing…' : 'Refresh'}
              </span>
            </button>
          </div>
        </div>

        <div className="card" style={{ border: `1px dashed var(--border)`, background: 'color-mix(in srgb, var(--surface) 95%, var(--bg) 5%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
            <div style={{ fontWeight: 700 }}>Filters</div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {activeFilterCount > 0 && <Pill tone="#0ea5e9">Applied: {activeFilterCount}</Pill>}
              <button type="button" className="btn-neutral btn-sm" onClick={() => setShowFilters((p) => !p)}>
                {showFilters ? 'Hide filters' : 'Show filters'}
              </button>
            </div>
          </div>

          {showFilters && (
            <>
              <div className="dashboard-filters-grid" style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '0' }}>
                  <label htmlFor="startDate" style={{ color: 'var(--muted)', fontSize: '12px' }}>Start</label>
                  <input
                    id="startDate"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => {
                      setFilters((p) => ({ ...p, startDate: e.target.value }));
                      setDatePreset('');
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '0' }}>
                  <label htmlFor="endDate" style={{ color: 'var(--muted)', fontSize: '12px' }}>End</label>
                  <input
                    id="endDate"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => {
                      setFilters((p) => ({ ...p, endDate: e.target.value }));
                      setDatePreset('');
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button type="button" className={`btn-sm ${datePreset === 'today' ? 'btn-primary' : 'btn-neutral'}`} onClick={() => applyDatePreset('today')}>
                    Today
                  </button>
                  <button type="button" className={`btn-sm ${datePreset === 'last7' ? 'btn-primary' : 'btn-neutral'}`} onClick={() => applyDatePreset('last7')}>
                    Last 7 days
                  </button>
                  <button type="button" className={`btn-sm ${datePreset === 'month' ? 'btn-primary' : 'btn-neutral'}`} onClick={() => applyDatePreset('month')}>
                    This month
                  </button>
                  <button type="button" className={`btn-sm ${datePreset === 'year' ? 'btn-primary' : 'btn-neutral'}`} onClick={() => applyDatePreset('year')}>
                    This year
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => applyDatePreset('')}>
                    Clear
                  </button>
                </div>
              </div>

              <div className="dashboard-filters-wide-grid" style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="service" style={{ color: 'var(--muted)', fontSize: '12px' }}>Service</label>
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
                  <label htmlFor="status" style={{ color: 'var(--muted)', fontSize: '12px' }}>Status</label>
                  <select id="status" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
                    <option value="">Any</option>
                    {statusOptions.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="paymentMethodId" style={{ color: 'var(--muted)', fontSize: '12px' }}>Payment method</label>
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
                  <label htmlFor="paymentProviderId" style={{ color: 'var(--muted)', fontSize: '12px' }}>Payment provider</label>
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
                  <label htmlFor="billProductId" style={{ color: 'var(--muted)', fontSize: '12px' }}>Bill product</label>
                  <select id="billProductId" value={filters.billProductId} onChange={(e) => setFilters((p) => ({ ...p, billProductId: e.target.value }))}>
                    <option value="">Any</option>
                    {billProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.displayName || product.code || product.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="billProviderId" style={{ color: 'var(--muted)', fontSize: '12px' }}>Bill provider</label>
                  <select id="billProviderId" value={filters.billProviderId} onChange={(e) => setFilters((p) => ({ ...p, billProviderId: e.target.value }))}>
                    <option value="">Any</option>
                    {billProviders.map((prov) => (
                      <option key={prov.id} value={prov.id}>
                        {prov.displayName || prov.name || prov.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="accountReference" style={{ color: 'var(--muted)', fontSize: '12px' }}>Account ref</label>
                  <input id="accountReference" value={filters.accountReference} onChange={(e) => setFilters((p) => ({ ...p, accountReference: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="userReference" style={{ color: 'var(--muted)', fontSize: '12px' }}>User ref</label>
                  <input id="userReference" value={filters.userReference} onChange={(e) => setFilters((p) => ({ ...p, userReference: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="countryId" style={{ color: 'var(--muted)', fontSize: '12px' }}>Country</label>
                  <select id="countryId" value={filters.countryId} onChange={(e) => setFilters((p) => ({ ...p, countryId: e.target.value }))}>
                    <option value="">Any</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.alpha2Code ? `(${c.alpha2Code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="accountId" style={{ color: 'var(--muted)', fontSize: '12px' }}>Account ID</label>
                  <input id="accountId" value={filters.accountId} onChange={(e) => setFilters((p) => ({ ...p, accountId: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="action" style={{ color: 'var(--muted)', fontSize: '12px' }}>Action</label>
                  <select id="action" value={filters.action} onChange={(e) => setFilters((p) => ({ ...p, action: e.target.value }))}>
                    <option value="">Any</option>
                    {actionOptions.map((act) => (
                      <option key={act} value={act}>
                        {act}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="userEmail" style={{ color: 'var(--muted)', fontSize: '12px' }}>User email</label>
                  <input id="userEmail" value={filters.userEmail} onChange={(e) => setFilters((p) => ({ ...p, userEmail: e.target.value }))} placeholder="email@example.com" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="userPhone" style={{ color: 'var(--muted)', fontSize: '12px' }}>User phone</label>
                  <input id="userPhone" value={filters.userPhone} onChange={(e) => setFilters((p) => ({ ...p, userPhone: e.target.value }))} placeholder="+243" />
                </div>
              </div>
            </>
          )}

          {showFilters && (
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.6rem' }}>
              <button type="button" className="btn-primary" onClick={applyFilters} disabled={loading}>
                {loading ? 'Applying…' : 'Apply filters'}
              </button>
              <button type="button" className="btn-neutral" onClick={resetFilters} disabled={loading}>
                Reset
              </button>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>All tiles respect the filters/date window.</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}

      <div className="dashboard-kpi-grid">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className="card"
            style={{ display: 'grid', gap: '0.2rem', cursor: kpi.onClick ? 'pointer' : 'default' }}
            onClick={kpi.onClick}
            role={kpi.onClick ? 'button' : undefined}
            tabIndex={kpi.onClick ? 0 : undefined}
            onKeyDown={kpi.onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && kpi.onClick() : undefined}
          >
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{kpi.label}</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: kpi.tone || 'var(--accent)' }}>{kpi.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-split-grid">
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800 }}>Volume trend</div>
              <Pill tone="#2563eb">Volume</Pill>
            </div>
            {chartData.length === 0 ? (
              <div style={{ color: 'var(--muted)', minHeight: '200px', display: 'flex', alignItems: 'center' }}>No data in this window</div>
            ) : (
              <div className="dashboard-chart">
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="left"
                      tickFormatter={(v) => formatCurrency(v)}
                      tick={{ fontSize: 11 }}
                      width={70}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === 'volume') return [formatCurrency(value), 'Volume'];
                        if (name === 'revenue') return [formatCurrency(value), 'Total revenue'];
                        return [value, name];
                      }}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="volume" name="Volume" stroke="#0f172a" strokeWidth={2.5} dot={false} yAxisId="left" />
                    <Line type="monotone" dataKey="revenue" name="Total revenue" stroke="#16a34a" strokeWidth={2} dot={false} yAxisId="left" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {timeseries.length > 0 && (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', color: 'var(--muted)', fontSize: '12px' }}>
                <span>From {timeseries[0]?.date}</span>
                <span>→</span>
                <span>{timeseries[timeseries.length - 1]?.date}</span>
              </div>
            )}
          </div>

          <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800 }}>Service mix</div>
              <Pill tone="#2563eb">Volume {formatCurrency(totals.totalVolume)}</Pill>
            </div>
            <Table
              columns={[
                { key: 'service', label: 'Service' },
                { key: 'count', label: 'Count', render: (row) => formatNumber(row.count), bold: true },
                { key: 'volume', label: 'Volume', render: (row) => formatCurrency(row.volume) },
                { key: 'fee', label: 'Our fees', render: (row) => formatCurrency(row.fee) }
              ]}
              rows={data?.services}
            />
          </div>
        </div>
        <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontWeight: 800 }}>Key metrics</div>
          <div className="dashboard-metrics-grid">
            {metricCards.map((m) => (
              <div key={m.key} style={{ padding: '0.75rem', border: `1px solid var(--border)`, borderRadius: '12px', display: 'grid', gap: '0.15rem', background: 'color-mix(in srgb, var(--surface) 90%, var(--accent-soft) 10%)' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{m.label}</div>
                <div style={{ fontWeight: 800, fontSize: '18px' }}>{formatNumber(metrics?.[m.key])}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {holdings.cryptoHoldings && holdings.cryptoHoldings.length > 0 && (
        <div className="card" style={{ display: 'grid', gap: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800 }}>Crypto holdings</div>
            <Pill tone="#0ea5e9">Breakdown</Pill>
          </div>
          <Table
            columns={[
              { key: 'asset', label: 'Asset / Network', render: (row) => row.asset || '—' },
              { key: 'symbol', label: 'Symbol' },
              { key: 'balance', label: 'Balance', render: (row) => formatNumber(row.balance) },
              { key: 'balanceFiat', label: 'USD', render: (row) => formatCurrency(row.balanceFiat) }
            ]}
            rows={formatCryptoHoldings(holdings.cryptoHoldings)}
            emptyLabel="No crypto holdings"
          />
        </div>
      )}

      <div className="dashboard-tables-grid">
        <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontWeight: 800 }}>Actions</div>
          <Table
            columns={[
              { key: 'action', label: 'Action' },
              { key: 'count', label: 'Count', render: (row) => formatNumber(row.count), bold: true },
              { key: 'volume', label: 'Volume', render: (row) => formatCurrency(row.volume) }
            ]}
            rows={data?.actions}
          />
        </div>
        <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontWeight: 800 }}>Payment rails</div>
          <Table
            columns={[
              { key: 'paymentMethodName', label: 'Method', render: (row) => row.paymentMethodName || row.paymentMethodId || '—' },
              { key: 'count', label: 'Count', render: (row) => formatNumber(row.count), bold: true },
              { key: 'volume', label: 'Volume', render: (row) => formatCurrency(row.volume) }
            ]}
            rows={data?.paymentMethods}
          />
        </div>
        <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontWeight: 800 }}>Bill products</div>
          <Table
            columns={[
              { key: 'billProductName', label: 'Product', render: (row) => row.billProductName || row.billProductId || '—' },
              { key: 'count', label: 'Count', render: (row) => formatNumber(row.count), bold: true },
              { key: 'volume', label: 'Volume', render: (row) => formatCurrency(row.volume) },
              { key: 'fee', label: 'Our fees', render: (row) => formatCurrency(row.fee) },
              { key: 'commission', label: 'Commission', render: (row) => formatCurrency(row.commission) },
              { key: 'revenue', label: 'Total revenue', render: (row) => formatCurrency(row.revenue) }
            ]}
            rows={data?.billProducts}
          />
        </div>
        <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontWeight: 800 }}>Bill providers</div>
          <Table
            columns={[
              { key: 'billProviderName', label: 'Provider', render: (row) => row.billProviderName || row.billProviderId || '—' },
              { key: 'count', label: 'Count', render: (row) => formatNumber(row.count), bold: true },
              { key: 'volume', label: 'Volume', render: (row) => formatCurrency(row.volume) },
              { key: 'fee', label: 'Our fees', render: (row) => formatCurrency(row.fee) },
              { key: 'commission', label: 'Commission', render: (row) => formatCurrency(row.commission) },
              { key: 'revenue', label: 'Total revenue', render: (row) => formatCurrency(row.revenue) }
            ]}
            rows={data?.billProviders}
          />
        </div>
        <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontWeight: 800 }}>Geo</div>
          <Table
            columns={[
              { key: 'countryName', label: 'Country', render: (row) => row.countryName || row.countryCode || row.countryId || '—' },
              { key: 'count', label: 'Count', render: (row) => formatNumber(row.count), bold: true },
              { key: 'volume', label: 'Volume', render: (row) => formatCurrency(row.volume) }
            ]}
            rows={data?.countries}
          />
        </div>
      </div>

      <div className="dashboard-split-grid">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ fontWeight: 800 }}>Top accounts</div>
            <Pill tone="#0ea5e9">Leaderboard</Pill>
          </div>
          <Table
            columns={[
              { key: 'accountReference', label: 'Account', render: (row) => row.accountReference || row.accountId },
              { key: 'username', label: 'Username', render: (row) => row.username || '—' },
              { key: 'count', label: 'Transactions', render: (row) => formatNumber(row.count), bold: true },
              { key: 'volume', label: 'Volume', render: (row) => formatCurrency(row.volume) }
            ]}
            rows={data?.topAccounts}
            emptyLabel="No accounts in this window"
          />
        </div>
        <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontWeight: 800 }}>Status health</div>
          <Table
            columns={[
              { key: 'status', label: 'Status' },
              { key: 'count', label: 'Count', render: (row) => formatNumber(row.count), bold: true },
              { key: 'volume', label: 'Volume', render: (row) => formatCurrency(row.volume) }
            ]}
            rows={data?.statuses}
          />
        </div>
      </div>

    </div>
  );
}
