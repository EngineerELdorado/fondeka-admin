'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const initialFilters = {
  accountId: '',
  accountReference: '',
  userReference: '',
  usernameContains: '',
  email: '',
  phone: '',
  countryId: '',
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

const Badge = ({ children }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.2rem 0.45rem',
      background: '#eef2ff',
      color: '#4338ca',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 600
    }}
  >
    {children}
  </span>
);

export default function AccountsListPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);

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

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        if (['accountId', 'countryId'].includes(key)) {
          const num = Number(value);
          if (!Number.isNaN(num)) params.set(key, String(num));
        } else if (['startDate', 'endDate'].includes(key)) {
          const ts = Date.parse(value);
          if (!Number.isNaN(ts)) params.set(key, String(ts));
        } else {
          params.set(key, String(value));
        }
      });
      const res = await api.accounts.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      const flattened = (list || []).map((item) => ({
        id: item.accountId ?? item.id,
        accountReference: item.accountReference ?? item.accountNumber ?? item.accountId,
        countryName: item.countryName || item.countryCode,
        countryCode: item.countryCode,
        userName: [item.userFirstName, item.userMiddleName, item.userLastName].filter(Boolean).join(' ') || item.username,
        username: item.username,
        userReference: item.userReference,
        email: item.email,
        phone: item.phoneNumber,
        emailVerified: item.emailVerified,
        phoneVerified: item.phoneVerified,
        kycStatus: item.kycStatus,
        kycProvider: item.kycProvider,
        kycLevel: item.kycLevel,
        balance: item.balance,
        previousDebt: item.previousDebt,
        eligibleLoanAmount: item.eligibleLoanAmount,
        lastTransactions: item.lastTransactions || [],
        cryptoWallets: item.cryptoWallets || [],
        raw: item
      }));
      setRows(flattened);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await api.countries.list(new URLSearchParams({ page: '0', size: '200' }));
        const list = Array.isArray(res) ? res : res?.content || [];
        setCountries(list);
      } catch {
        // ignore silently
      }
    };
    fetchCountries();
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
    const chips = [];
    const add = (label, key) => chips.push({ label, key });
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
      switch (key) {
        case 'accountId':
          add(`Account ID: ${value}`, key);
          break;
        case 'accountReference':
          add(`Account ref: ${value}`, key);
          break;
        case 'userReference':
          add(`User ref: ${value}`, key);
          break;
        case 'usernameContains':
          add(`Username contains: ${value}`, key);
          break;
        case 'email':
          add(`Email: ${value}`, key);
          break;
        case 'phone':
          add(`Phone: ${value}`, key);
          break;
        case 'countryId':
          add(`Country ID: ${value}`, key);
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
    return chips;
  }, [appliedFilters]);

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'accountReference', label: 'Account' },
      { key: 'userName', label: 'User' },
      { key: 'countryName', label: 'Country' },
      { key: 'phone', label: 'Phone' },
      { key: 'balance', label: 'Balance' },
      { key: 'eligibleLoanAmount', label: 'Eligible loan' },
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
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Accounts</div>
          <div style={{ color: 'var(--muted)' }}>Find accounts quickly with deep filters and drill into recent activity.</div>
        </div>
        <Link href="/dashboard/accounts" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Accounts hub
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="accountId">Account ID</label>
            <input id="accountId" value={filters.accountId} onChange={(e) => setFilters((p) => ({ ...p, accountId: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="accountReference">Account reference/number</label>
            <input id="accountReference" value={filters.accountReference} onChange={(e) => setFilters((p) => ({ ...p, accountReference: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="userReference">User reference</label>
            <input id="userReference" value={filters.userReference} onChange={(e) => setFilters((p) => ({ ...p, userReference: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="usernameContains">Username contains</label>
            <input id="usernameContains" value={filters.usernameContains} onChange={(e) => setFilters((p) => ({ ...p, usernameContains: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="email">Email</label>
            <input id="email" value={filters.email} onChange={(e) => setFilters((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="phone">Phone</label>
            <input id="phone" value={filters.phone} onChange={(e) => setFilters((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="countryId">Country</label>
            <select id="countryId" value={filters.countryId} onChange={(e) => setFilters((p) => ({ ...p, countryId: e.target.value }))}>
              <option value="">All</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.alpha2Code})
                </option>
              ))}
            </select>
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

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel="No accounts found" />

      {showDetail && (
        <Modal title={`Account ${selected?.accountReference || selected?.id}`} onClose={() => setShowDetail(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <DetailGrid
              rows={[
                { label: 'Account ID', value: selected?.id },
                { label: 'Account reference', value: selected?.accountReference },
                { label: 'User', value: selected?.userName || selected?.username },
                { label: 'Country', value: selected?.countryName || selected?.countryCode || '—' },
                { label: 'KYC status', value: selected?.kycStatus },
                { label: 'KYC level', value: selected?.kycLevel },
                { label: 'Balance', value: selected?.balance },
                { label: 'Eligible loan', value: selected?.eligibleLoanAmount }
              ]}
            />

            {selected?.lastTransactions?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontWeight: 700 }}>Recent transactions (max 10)</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Created', 'Reference', 'Status', 'Service', 'Action', 'Amount'].map((label) => (
                          <th key={label} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selected.lastTransactions.map((txn) => (
                        <tr key={txn.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem' }}>{formatDateTime(txn.createdAt)}</td>
                          <td style={{ padding: '0.5rem' }}>{txn.reference}</td>
                          <td style={{ padding: '0.5rem' }}>{renderStatusBadge(txn.status)}</td>
                          <td style={{ padding: '0.5rem' }}>{txn.service}</td>
                          <td style={{ padding: '0.5rem' }}>{txn.action}</td>
                          <td style={{ padding: '0.5rem' }}>
                            {txn.amount} {txn.currency || ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selected?.cryptoWallets?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontWeight: 700 }}>Crypto wallets</div>
                {(() => {
                  const totals = (selected?.cryptoWallets || []).reduce((acc, w) => {
                    if (!w || w.balance === undefined || w.balance === null || !w.currency) return acc;
                    const num = Number(w.balance);
                    if (Number.isNaN(num)) return acc;
                    acc[w.currency] = (acc[w.currency] || 0) + num;
                    return acc;
                  }, {});
                  const entries = Object.entries(totals);
                  if (entries.length === 0) return null;
                  return (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Totals by currency:</span>
                      {entries.map(([cur, amt]) => (
                        <Badge key={cur}>
                          {amt} {cur}
                        </Badge>
                      ))}
                    </div>
                  );
                })()}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['ID', 'Product', 'Network', 'Balance'].map((label) => (
                          <th key={label} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selected.cryptoWallets.map((wallet) => (
                        <tr key={wallet.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem' }}>{wallet.id}</td>
                          <td style={{ padding: '0.5rem' }}>{wallet.productName}</td>
                          <td style={{ padding: '0.5rem' }}>
                            <Badge>{wallet.networkDisplayName || wallet.networkName || 'Network'}</Badge>
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span>{wallet.balance}</span>
                              {wallet.currency && <Badge>{wallet.currency}</Badge>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};
