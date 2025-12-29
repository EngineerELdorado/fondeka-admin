'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const statusOptions = ['PENDING', 'SUCCESS', 'FAILED'];

const StatusBadge = ({ value }) => {
  if (!value) return '—';
  const val = String(value).toUpperCase();
  const tone =
    val === 'SUCCESS'
      ? { bg: '#ECFDF3', fg: '#15803D' }
      : val === 'PENDING'
        ? { bg: '#EFF6FF', fg: '#1D4ED8' }
        : val === 'FAILED'
          ? { bg: '#FEF2F2', fg: '#B91C1C' }
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

export default function CardOrderRetriesPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [status, setStatus] = useState('PENDING');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [markFailed, setMarkFailed] = useState(null);
  const [failReason, setFailReason] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (status) params.set('status', status);
      const res = await api.cardOrderRetries.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err.message || 'Failed to load retries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!info && !error) return;
    const t = setTimeout(() => {
      setInfo(null);
      setError(null);
    }, 3500);
    return () => clearTimeout(t);
  }, [info, error]);

  const handleRunNow = async (row) => {
    if (!row?.id) return;
    setActionLoading(`run-${row.id}`);
    setError(null);
    setInfo(null);
    try {
      await api.cardOrderRetries.runNow(row.id);
      setInfo(`Retry ${row.id} queued.`);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to run retry');
    } finally {
      setActionLoading('');
    }
  };

  const handleMarkFailed = async () => {
    if (!markFailed?.id) return;
    setActionLoading(`fail-${markFailed.id}`);
    setError(null);
    setInfo(null);
    try {
      await api.cardOrderRetries.markFailed(markFailed.id, failReason.trim());
      setInfo(`Retry ${markFailed.id} marked as failed.`);
      setMarkFailed(null);
      setFailReason('');
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to mark retry as failed');
    } finally {
      setActionLoading('');
    }
  };

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'transactionId', label: 'Transaction' },
      { key: 'intentId', label: 'Intent' },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
      { key: 'attempts', label: 'Attempts' },
      { key: 'nextRunAt', label: 'Next run', render: (row) => formatDateTime(row.nextRunAt) },
      { key: 'updatedAt', label: 'Updated', render: (row) => formatDateTime(row.updatedAt) },
      { key: 'lastError', label: 'Last error', render: (row) => row.lastError || '—' },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => handleRunNow(row)} disabled={actionLoading === `run-${row.id}` || row.status === 'FAILED'}>
              {actionLoading === `run-${row.id}` ? 'Running…' : 'Run now'}
            </button>
            <button type="button" className="btn-danger btn-sm" onClick={() => setMarkFailed(row)} disabled={actionLoading === `fail-${row.id}` || row.status === 'FAILED'}>
              Mark failed
            </button>
          </div>
        )
      }
    ],
    [actionLoading]
  );

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? true : page + 1 < pageMeta.totalPages;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Card Order Retries</div>
          <div style={{ color: 'var(--muted)' }}>Monitor and manage card order retry attempts.</div>
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
      {info && (
        <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>
          {info}
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => {
                setPage(0);
                setStatus(e.target.value);
              }}
            >
              <option value="">All</option>
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="size">Page size</label>
            <select id="size" value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {[10, 20, 50].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral btn-sm" onClick={fetchRows} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Page {page + 1}
            {pageMeta.totalPages !== null ? ` of ${pageMeta.totalPages}` : ''}
          </div>
        </div>
      </div>

      <DataTable columns={columns} rows={rows} emptyLabel={loading ? 'Loading…' : 'No retries found'} />

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
        <button type="button" className="btn-neutral btn-sm" disabled={!canPrev} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          Prev
        </button>
        <button type="button" className="btn-neutral btn-sm" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>

      {markFailed && (
        <Modal title={`Mark retry ${markFailed.id} as failed`} onClose={() => (actionLoading ? null : setMarkFailed(null))}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)' }}>
              This will stop automatic retries for this order. Provide a reason if available.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="failReason">Reason</label>
              <input id="failReason" value={failReason} onChange={(e) => setFailReason(e.target.value)} placeholder="Optional reason" />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setMarkFailed(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={handleMarkFailed} disabled={actionLoading}>
                {actionLoading ? 'Saving…' : 'Mark failed'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
