'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { useToast } from '@/contexts/ToastContext';

const PROVIDER_OPTIONS = ['AVADAPAY', 'RELOADLY_AIRTIME', 'UNIPAYMENT', 'BTCPAYSERVER', 'ESIMGO', 'AIRALO', 'SMILEID', 'ARAKAPAY', 'BRIDGECARD'];
const RETRY_SUPPORTED_PROVIDERS = new Set(['AVADAPAY', 'RELOADLY_AIRTIME', 'UNIPAYMENT', 'BTCPAYSERVER', 'ESIMGO', 'AIRALO', 'SMILEID', 'BRIDGECARD']);

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={{ maxWidth: '760px' }}>
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

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const parsePayload = (payload) => {
  if (payload === null || payload === undefined) return null;
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return payload;
    }
  }
  return payload;
};

const safeStringify = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const payloadPreview = (payload) => {
  if (payload === null || payload === undefined || payload === '') return '—';
  const text = typeof payload === 'string' ? payload : safeStringify(payload);
  if (text.length <= 120) return text;
  return `${text.slice(0, 120)}...`;
};

const truncateText = (value, max = 80) => {
  if (!value) return '—';
  const text = String(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
};

const emptyFilters = {
  provider: '',
  processed: '',
  minRetries: '',
  maxRetries: '',
  createdAfter: '',
  createdBefore: '',
  transactionId: '',
  internalReference: '',
  externalReference: '',
  operatorReference: '',
  accountReference: '',
  userReference: '',
  userEmail: '',
  reference: ''
};

export default function WebhookEventsPage() {
  const { pushToast } = useToast();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [filters, setFilters] = useState(emptyFilters);
  const [debouncedFilters, setDebouncedFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });

  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [retryTarget, setRetryTarget] = useState(null);
  const [retryLoading, setRetryLoading] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      Object.entries(debouncedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        if (key === 'createdAfter' || key === 'createdBefore') {
          const ts = Date.parse(String(value));
          if (!Number.isNaN(ts)) {
            params.set(key, String(ts));
          }
          return;
        }
        params.set(key, String(value));
      });
      const res = await api.webhookEvents.list(params);
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

  const fetchDetail = async (id) => {
    if (!id) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await api.webhookEvents.get(id);
      setSelected(res || null);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
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

  const columns = useMemo(
    () => [
      {
        key: 'id',
        label: 'ID',
        render: (row) => <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{row.id ?? '—'}</span>
      },
      {
        key: 'transactionId',
        label: 'Transaction',
        render: (row) =>
          row.transactionId ? (
            <Link href={`/dashboard/transactions?transactionId=${encodeURIComponent(row.transactionId)}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
              {row.transactionId}
            </Link>
          ) : (
            '—'
          )
      },
      { key: 'provider', label: 'Provider' },
      { key: 'eventType', label: 'Event Type' },
      {
        key: 'retries',
        label: 'Retries',
        render: (row) => (row.retries ?? 0)
      },
      {
        key: 'processedAt',
        label: 'Processed At',
        render: (row) => formatDateTime(row.processedAt)
      },
      {
        key: 'lastError',
        label: 'Last Error',
        render: (row) => (
          <span title={row.lastError || ''} style={{ color: row.lastError ? '#b91c1c' : 'inherit' }}>
            {truncateText(row.lastError)}
          </span>
        )
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => {
          const hasId = row.id !== null && row.id !== undefined;
          const isProcessed = Boolean(row.processedAt);
          const provider = row.provider ? String(row.provider).toUpperCase() : '';
          const isSupported = RETRY_SUPPORTED_PROVIDERS.has(provider);
          const retryDisabledReason = !hasId ? 'Missing webhook ID' : isProcessed ? 'Webhook already processed' : !isSupported ? 'Unsupported provider' : '';
          return (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setSelected(row);
                  setShowDetail(true);
                  fetchDetail(row.id);
                }}
                className="btn-neutral btn-sm"
              >
                View
              </button>
              <button
                type="button"
                onClick={() => setRetryTarget(row)}
                className="btn-danger btn-sm"
                disabled={Boolean(retryDisabledReason)}
                title={retryDisabledReason}
              >
                Retry
              </button>
            </div>
          );
        }
      }
    ],
    []
  );

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? true : page + 1 < pageMeta.totalPages;

  const detailPayload = useMemo(() => {
    if (!selected) return '';
    const parsed = parsePayload(selected.payload);
    if (parsed === null) return '';
    if (typeof parsed === 'string') return parsed;
    try {
      return JSON.stringify(parsed, null, 2);
    } catch {
      return String(parsed);
    }
  }, [selected]);

  const onRetry = async () => {
    if (retryTarget?.id === null || retryTarget?.id === undefined) {
      pushToast({ message: 'Missing webhook ID; cannot retry.', tone: 'error' });
      return;
    }
    setRetryLoading(true);
    try {
      await api.webhookEvents.retry(retryTarget.id);
      pushToast({ message: `Webhook ${retryTarget.id} replayed.`, tone: 'success' });
      setRetryTarget(null);
      fetchRows();
      if (selected?.id === retryTarget.id) {
        fetchDetail(retryTarget.id);
      }
    } catch (err) {
      const message =
        err?.status === 404
          ? 'Retry endpoint is unavailable for this webhook event.'
          : err?.message || 'Retry failed.';
      pushToast({ message, tone: 'error' });
    } finally {
      setRetryLoading(false);
    }
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setDebouncedFilters(emptyFilters);
    setPage(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Webhook Events</div>
          <div style={{ color: 'var(--muted)' }}>Review webhook payloads, errors, and replay supported providers.</div>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Filters</div>
          <button type="button" className="btn-neutral btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
            {showFilters ? 'Hide filters' : 'Show filters'}
          </button>
        </div>
        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="provider">Provider</label>
            <input
              id="provider"
              list="provider-options"
              value={filters.provider}
              onChange={(e) => setFilters((p) => ({ ...p, provider: e.target.value }))}
              placeholder="Any or type a provider"
            />
            <datalist id="provider-options">
              {PROVIDER_OPTIONS.map((provider) => (
                <option key={provider} value={provider} />
              ))}
            </datalist>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="processed">Processed</label>
            <select id="processed" value={filters.processed} onChange={(e) => setFilters((p) => ({ ...p, processed: e.target.value }))}>
              <option value="">Any</option>
              <option value="true">Processed</option>
              <option value="false">Not processed</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="minRetries">Min retries</label>
            <input
              id="minRetries"
              type="number"
              min={0}
              value={filters.minRetries}
              onChange={(e) => setFilters((p) => ({ ...p, minRetries: e.target.value }))}
              placeholder="0"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="maxRetries">Max retries</label>
            <input
              id="maxRetries"
              type="number"
              min={0}
              value={filters.maxRetries}
              onChange={(e) => setFilters((p) => ({ ...p, maxRetries: e.target.value }))}
              placeholder="5"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="createdAfter">Created after</label>
            <input
              id="createdAfter"
              type="datetime-local"
              value={filters.createdAfter}
              onChange={(e) => setFilters((p) => ({ ...p, createdAfter: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="createdBefore">Created before</label>
            <input
              id="createdBefore"
              type="datetime-local"
              value={filters.createdBefore}
              onChange={(e) => setFilters((p) => ({ ...p, createdBefore: e.target.value }))}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="transactionId">Transaction ID</label>
            <input
              id="transactionId"
              value={filters.transactionId}
              onChange={(e) => setFilters((p) => ({ ...p, transactionId: e.target.value }))}
              placeholder="Transaction ID"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="reference">Reference</label>
            <input id="reference" value={filters.reference} onChange={(e) => setFilters((p) => ({ ...p, reference: e.target.value }))} placeholder="Any reference" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="internalReference">Internal ref</label>
            <input
              id="internalReference"
              value={filters.internalReference}
              onChange={(e) => setFilters((p) => ({ ...p, internalReference: e.target.value }))}
              placeholder="Internal reference"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="externalReference">External ref</label>
            <input
              id="externalReference"
              value={filters.externalReference}
              onChange={(e) => setFilters((p) => ({ ...p, externalReference: e.target.value }))}
              placeholder="External reference"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="operatorReference">Operator ref</label>
            <input
              id="operatorReference"
              value={filters.operatorReference}
              onChange={(e) => setFilters((p) => ({ ...p, operatorReference: e.target.value }))}
              placeholder="Operator reference"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="accountReference">Account ref</label>
            <input
              id="accountReference"
              value={filters.accountReference}
              onChange={(e) => setFilters((p) => ({ ...p, accountReference: e.target.value }))}
              placeholder="Account reference"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="userReference">User ref</label>
            <input
              id="userReference"
              value={filters.userReference}
              onChange={(e) => setFilters((p) => ({ ...p, userReference: e.target.value }))}
              placeholder="User reference"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="userEmail">User email</label>
            <input id="userEmail" value={filters.userEmail} onChange={(e) => setFilters((p) => ({ ...p, userEmail: e.target.value }))} placeholder="User email" />
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
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={loading || !canPrev} className="btn-neutral">
            ← Prev
          </button>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={loading || !canNext} className="btn-neutral">
            Next →
          </button>
          {pageMeta.totalElements !== null && (
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
              {pageMeta.totalElements} events total
              {pageMeta.totalPages !== null && pageMeta.totalPages > 0 ? ` · page ${page + 1}/${pageMeta.totalPages}` : ''}
            </span>
          )}
        </div>
        )}
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Retry supported providers: AVADAPAY, RELOADLY_AIRTIME, UNIPAYMENT, BTCPAYSERVER, ESIMGO, AIRALO, SMILEID, BRIDGECARD.
        </div>
      </div>

      <DataTable columns={columns} rows={rows} emptyLabel="No webhook events found" showIndex={false} />

      {showDetail && (
        <Modal title={`Webhook ${selected?.id ?? ''}`} onClose={() => setShowDetail(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
            {detailError && (
              <div style={{ color: '#b91c1c', fontWeight: 700, border: '1px solid #fecdd3', background: '#fef2f2', padding: '0.6rem', borderRadius: '10px' }}>
                {detailError}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Provider</div>
                <div style={{ fontWeight: 700 }}>{selected?.provider ?? '—'}</div>
              </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Event Type</div>
              <div style={{ fontWeight: 700 }}>{selected?.eventType ?? '—'}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
              <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Transaction</div>
              <div style={{ fontWeight: 700 }}>
                {selected?.transactionId ? (
                  <Link
                    href={`/dashboard/transactions?transactionId=${encodeURIComponent(selected.transactionId)}`}
                    style={{ color: 'var(--primary)', textDecoration: 'none' }}
                  >
                    {selected.transactionId}
                  </Link>
                ) : (
                  '—'
                )}
              </div>
            </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Retries</div>
                <div style={{ fontWeight: 700 }}>{selected?.retries ?? 0}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Processed At</div>
                <div style={{ fontWeight: 700 }}>{formatDateTime(selected?.processedAt)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Last Error</div>
                <div style={{ fontWeight: 700, color: selected?.lastError ? '#b91c1c' : 'inherit' }}>{selected?.lastError || '—'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ fontWeight: 700 }}>Payload</div>
              {detailLoading ? (
                <div style={{ color: 'var(--muted)' }}>Loading payload...</div>
              ) : detailPayload ? (
                <pre
                  style={{
                    maxHeight: '360px',
                    overflow: 'auto',
                    background: 'var(--surface)',
                    border: `1px solid var(--border)`,
                    borderRadius: '10px',
                    padding: '0.75rem',
                    fontSize: '12px'
                  }}
                >
                  {detailPayload}
                </pre>
              ) : (
                <div style={{ color: 'var(--muted)' }}>No payload.</div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {retryTarget && (
        <Modal title="Retry webhook event" onClose={() => setRetryTarget(null)}>
          <div style={{ color: 'var(--muted)', marginTop: '0.75rem' }}>
            This will replay webhook {retryTarget.id} directly to the service layer. Proceed?
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" onClick={() => setRetryTarget(null)} className="btn-neutral" disabled={retryLoading}>
              Cancel
            </button>
            <button type="button" onClick={onRetry} className="btn-danger" disabled={retryLoading}>
              {retryLoading ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
