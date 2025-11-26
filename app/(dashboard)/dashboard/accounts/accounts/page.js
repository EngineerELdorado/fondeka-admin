'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>×</button>
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

export default function AccountsListPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [accountNumber, setAccountNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (accountNumber) params.set('accountNumber', accountNumber);
      const res = await api.accounts.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      const flattened = (list || []).map((item) => {
        const acc = item?.account || item;
        const user = acc?.user || item?.user;
        return {
          id: acc?.id ?? item?.id,
          accountNumber: acc?.accountNumber,
          countryName: acc?.countryName || acc?.countryCode,
          countryCode: acc?.countryCode,
          loanBalance: acc?.loanBalance,
          accountBalance: acc?.accountBalance,
          nextDueAmount: acc?.nextDueAmount,
          nextRepaymentDate: acc?.nextRepaymentDate,
          eligibleLoanAmount: acc?.eligibleLoanAmount,
          userName: user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : undefined,
          raw: item
        };
      });
      setRows(flattened);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, accountNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'accountNumber', label: 'Account' },
      { key: 'userName', label: 'User' },
      { key: 'countryName', label: 'Country' },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openDetail(row)} className="btn-neutral">
              View
            </button>
            <button type="button" onClick={() => handleAml(row.id)} className="btn-primary">
              Check AML
            </button>
          </div>
        )
      }
    ],
    []
  );

  const handleAml = async (id) => {
    setError(null);
    setInfo(null);
    try {
      const res = await api.accounts.checkAml(id);
      setInfo(`AML check for account ${id}: ${JSON.stringify(res)}`);
    } catch (err) {
      setError(err.message);
    }
  };

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
          <div style={{ color: 'var(--muted)' }}>Search and review accounts; run AML checks.</div>
        </div>
        <Link href="/dashboard/accounts" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Accounts hub
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label htmlFor="accountNumber">Account number</label>
          <input id="accountNumber" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
        </div>
        <div>
          <label htmlFor="page">Page</label>
          <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="size">Size</label>
          <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel="No accounts found" />

      {showDetail && (
        <Modal title={`Account ${selected?.accountNumber || selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Account number', value: selected?.accountNumber },
              { label: 'Country', value: selected?.countryName || '—' },
              { label: 'User', value: selected?.userName || '—' },
              { label: 'Balance', value: selected?.accountBalance },
              { label: 'Loan balance', value: selected?.loanBalance },
              { label: 'Next repayment', value: selected?.nextRepaymentDate },
              { label: 'Next due amount', value: selected?.nextDueAmount }
            ]}
          />
        </Modal>
      )}
    </div>
  );
}
