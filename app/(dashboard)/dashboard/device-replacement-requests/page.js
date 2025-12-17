'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const statusOptions = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'];

const emptyFilters = {
  reference: '',
  email: '',
  phone: '',
  status: ''
};

const StatusBadge = ({ value }) => {
  if (!value) return '—';
  const val = String(value).toUpperCase();
  const tone =
    val === 'APPROVED'
      ? { bg: '#ECFDF3', fg: '#15803D' }
      : val === 'PENDING'
        ? { bg: '#EFF6FF', fg: '#1D4ED8' }
        : val === 'REJECTED'
          ? { bg: '#FEF2F2', fg: '#B91C1C' }
          : val === 'EXPIRED'
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

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

export default function DeviceReplacementRequestsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [filters, setFilters] = useState(emptyFilters);
  const [debouncedFilters, setDebouncedFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      Object.entries(debouncedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        params.set(key, String(value));
      });

      const res = await api.devices.replacementRequests(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, debouncedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      setDebouncedFilters(filters);
    }, 450);
    return () => clearTimeout(t);
  }, [filters]);

  const resetFilters = () => {
    setFilters(emptyFilters);
    setDebouncedFilters(emptyFilters);
    setPage(0);
  };

  const columns = useMemo(
    () => [
      {
        key: 'accountId',
        label: 'Account',
        render: (row) => (row.accountId !== undefined && row.accountId !== null ? `#${row.accountId}` : '—')
      },
      {
        key: 'oldDeviceId',
        label: 'Old Device',
        render: (row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ fontWeight: 700 }}>{row.oldDeviceId || '—'}</div>
          </div>
        )
      },
      {
        key: 'newDeviceId',
        label: 'New Device',
        render: (row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ fontWeight: 700 }}>{row.newDeviceId || '—'}</div>
          </div>
        )
      },
      {
        key: 'status',
        label: 'Status',
        render: (row) => <StatusBadge value={row.status} />
      },
      {
        key: 'expiresAt',
        label: 'Expires At',
        render: (row) => formatDateTime(row.expiresAt)
      },
      {
        key: 'createdAt',
        label: 'Created At',
        render: (row) => formatDateTime(row.createdAt)
      },
      {
        key: 'decidedAt',
        label: 'Decided At',
        render: (row) => formatDateTime(row.decidedAt)
      }
    ],
    []
  );

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? true : page + 1 < pageMeta.totalPages;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Device Replacement Requests</div>
          <div style={{ color: 'var(--muted)' }}>Highly filterable view of replacement requests.</div>
        </div>
        <Link href="/dashboard" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Dashboard
        </Link>
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700, border: '1px solid #fecdd3', background: '#fef2f2' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontWeight: 700 }}>Filters</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="reference">Reference</label>
            <input
              id="reference"
              value={filters.reference}
              onChange={(e) => setFilters((p) => ({ ...p, reference: e.target.value }))}
              placeholder="account/user reference or oauthId"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="email">Email contains</label>
            <input id="email" value={filters.email} onChange={(e) => setFilters((p) => ({ ...p, email: e.target.value }))} placeholder="gmail.com" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="phone">Phone contains</label>
            <input id="phone" value={filters.phone} onChange={(e) => setFilters((p) => ({ ...p, phone: e.target.value }))} placeholder="+243" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="status">Status</label>
            <select id="status" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
              <option value="">Any</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="page">Page</label>
              <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="size">Size</label>
              <input id="size" type="number" min={1} max={200} value={size} onChange={(e) => setSize(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={resetFilters} disabled={loading} className="btn-neutral">
            Reset
          </button>
          <button type="button" onClick={fetchRows} disabled={loading} className="btn-neutral">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={loading || !canPrev} className="btn-neutral">
            ← Prev
          </button>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={loading || !canNext} className="btn-neutral">
            Next →
          </button>
          {pageMeta.totalElements !== null && (
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
              {pageMeta.totalElements} requests total
              {pageMeta.totalPages !== null && pageMeta.totalPages > 0 ? ` · page ${page + 1}/${pageMeta.totalPages}` : ''}
            </span>
          )}
        </div>
      </div>

      <DataTable columns={columns} rows={rows} emptyLabel="No replacement requests found" />
    </div>
  );
}
