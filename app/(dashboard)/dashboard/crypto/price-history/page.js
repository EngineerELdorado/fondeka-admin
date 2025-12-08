'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyFilters = { currency: '', from: '', to: '', page: 0, size: 50 };

export default function CryptoPriceHistoryPage() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currencies, setCurrencies] = useState([]);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(appliedFilters.page));
      params.set('size', String(appliedFilters.size));
      if (appliedFilters.currency) params.set('currency', appliedFilters.currency);
      if (appliedFilters.from) params.set('from', appliedFilters.from);
      if (appliedFilters.to) params.set('to', appliedFilters.to);
      const res = await api.cryptoPriceHistory.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      const sorted = [...(list || [])].sort((a, b) => {
        const aTime = new Date(a.capturedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.capturedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setRows(sorted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const res = await api.cryptoProducts.list(new URLSearchParams({ page: '0', size: '200' }));
        const list = Array.isArray(res) ? res : res?.content || [];
        const uniq = Array.from(new Set((list || []).map((p) => p.currency).filter(Boolean))).sort();
        setCurrencies(uniq);
      } catch {
        // ignore
      }
    };
    loadCurrencies();
  }, []);

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'currency', label: 'Currency' },
    { key: 'fiat', label: 'Fiat' },
    { key: 'price', label: 'Price' },
    { key: 'capturedAt', label: 'Captured at' },
    { key: 'createdAt', label: 'Created at' },
    { key: 'updatedAt', label: 'Updated at' }
  ], []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Crypto Price History</div>
          <div style={{ color: 'var(--muted)' }}>Read-only log of captured crypto prices.</div>
        </div>
        <Link href="/dashboard/crypto" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Crypto hub
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="currency">Currency</label>
            <select
              id="currency"
              value={filters.currency}
              onChange={(e) => setFilters((p) => ({ ...p, currency: e.target.value }))}
            >
              <option value="">All</option>
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="from">From (ISO)</label>
            <input
              id="from"
              type="datetime-local"
              value={filters.from}
              onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="to">To (ISO)</label>
            <input
              id="to"
              type="datetime-local"
              value={filters.to}
              onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="page">Page</label>
            <input id="page" type="number" min={0} value={filters.page} onChange={(e) => setFilters((p) => ({ ...p, page: Number(e.target.value) }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="size">Size</label>
            <input id="size" type="number" min={1} value={filters.size} onChange={(e) => setFilters((p) => ({ ...p, size: Number(e.target.value) }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setAppliedFilters(filters)}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Loading…' : 'Apply'}
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(emptyFilters);
              setAppliedFilters(emptyFilters);
            }}
            disabled={loading}
            className="btn-neutral"
          >
            Reset
          </button>
          <button type="button" onClick={fetchRows} disabled={loading} className="btn-neutral">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel="No price history found" />
    </div>
  );
}
