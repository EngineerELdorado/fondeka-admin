'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { useToast } from '@/contexts/ToastContext';

const OUTBOX_TYPES = {
  events: {
    label: 'Event Outbox',
    description: 'Internal async jobs created by the app.',
    primaryField: 'type',
    primaryLabel: 'Type',
    filters: ['type', 'status', 'minRetries', 'maxRetries', 'createdAfter', 'createdBefore', 'lockedBy', 'dedupeKey']
  },
  notifications: {
    label: 'Notification Outbox',
    description: 'Queued push, email, and sms notification jobs.',
    primaryField: 'type',
    primaryLabel: 'Type',
    filters: ['type', 'status', 'minRetries', 'maxRetries', 'createdAfter', 'createdBefore', 'lockedBy', 'dedupeKey']
  },
  webhooks: {
    label: 'Webhook Outbox',
    description: 'Incoming provider webhooks queued for worker dispatch.',
    primaryField: 'provider',
    primaryLabel: 'Provider',
    filters: ['provider', 'status', 'minRetries', 'maxRetries', 'createdAfter', 'createdBefore', 'lockedBy', 'handlerKey']
  }
};

const emptyFilters = {
  type: '',
  provider: '',
  status: '',
  minRetries: '',
  maxRetries: '',
  createdAfter: '',
  createdBefore: '',
  lockedBy: '',
  dedupeKey: '',
  handlerKey: ''
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={{ maxWidth: '880px' }}>
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

const StatusBadge = ({ value }) => {
  if (!value) return '—';
  const val = String(value).toUpperCase();
  const tone =
    val === 'PROCESSED'
      ? { bg: '#ECFDF3', fg: '#15803D' }
      : val === 'PENDING'
        ? { bg: '#EFF6FF', fg: '#1D4ED8' }
        : val === 'PROCESSING'
          ? { bg: '#FEFCE8', fg: '#A16207' }
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

const toText = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const payloadPreview = (payload, max = 500) => {
  const text = toText(payload);
  if (!text) return '—';
  return text.length <= max ? text : `${text.slice(0, max)}...`;
};

const toPrettyPayload = (payload) => {
  if (payload === null || payload === undefined || payload === '') return '';
  if (typeof payload !== 'string') {
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const toEpochMs = (value) => {
  if (!value) return null;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
};

const actionMeta = {
  retry: { label: 'Retry', buttonClass: 'btn-neutral', method: 'retry' },
  cancel: { label: 'Cancel', buttonClass: 'btn-danger', method: 'cancel' },
  'mark-failed': { label: 'Mark failed', buttonClass: 'btn-danger', method: 'markFailed' }
};

export default function OutboxPage() {
  const { pushToast } = useToast();
  const [outboxType, setOutboxType] = useState('events');
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);

  const [selected, setSelected] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [payloadTarget, setPayloadTarget] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const outboxConfig = OUTBOX_TYPES[outboxType];

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(Math.max(0, Number(page) || 0)),
        size: String(Math.min(200, Math.max(1, Number(size) || 50)))
      });
      outboxConfig.filters.forEach((key) => {
        const value = appliedFilters[key];
        if (value === '' || value === null || value === undefined) return;
        if (key === 'createdAfter' || key === 'createdBefore') {
          const epochMs = toEpochMs(value);
          if (epochMs !== null) params.set(key, String(epochMs));
          return;
        }
        params.set(key, String(value));
      });
      const res = await api.outbox[outboxType].list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err.message || 'Failed to load outbox rows.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id) => {
    if (id === null || id === undefined) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await api.outbox[outboxType].get(id);
      setSelected(res || null);
    } catch (err) {
      setDetailError(err.message || 'Failed to load outbox detail.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [outboxType, page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setShowRawPayload(false);
  }, [selected?.id, outboxType]);

  const columns = [
      {
        key: 'outboxId',
        label: 'ID',
        render: (row) => <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{row.id ?? '—'}</span>
      },
      {
        key: 'typeOrProvider',
        label: 'Type / Provider',
        render: (row) => {
          const primaryValue = row?.[outboxConfig.primaryField] || '—';
          if (outboxType !== 'webhooks') return primaryValue;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <span>{primaryValue}</span>
              <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.eventType || '—'}</span>
            </div>
          );
        }
      },
      { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
      { key: 'retries', label: 'Retries', render: (row) => row.retries ?? 0 },
      { key: 'lockedBy', label: 'Locked By', render: (row) => row.lockedBy || '—' },
      { key: 'nextAttemptAt', label: 'Next Attempt At', render: (row) => formatDateTime(row.nextAttemptAt) },
      { key: 'createdAt', label: 'Created At', render: (row) => formatDateTime(row.createdAt) },
      {
        key: 'payload',
        label: 'Payload',
        render: (row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '240px', maxWidth: '240px' }}>
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere'
              }}
            >
              {payloadPreview(row.payload, 80)}
            </span>
            {toText(row.payload) ? (
              <button type="button" className="btn-neutral btn-sm" onClick={() => setPayloadTarget(row)} style={{ alignSelf: 'flex-start' }}>
                See more
              </button>
            ) : null}
          </div>
        )
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => {
          const hasId = row.id !== null && row.id !== undefined;
          const isProcessed = Boolean(row.processedAt);
          const actionDisabledReason = !hasId ? 'Missing outbox ID' : '';
          return (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-neutral btn-sm"
                onClick={() => {
                  setDetailOpen(true);
                  setSelected(row);
                  fetchDetail(row.id);
                }}
              >
                View
              </button>
              {!isProcessed && (
                <>
                  <button
                    type="button"
                    className="btn-neutral btn-sm"
                    disabled={!hasId}
                    title={actionDisabledReason}
                    onClick={() => {
                      setActionReason('');
                      setActionTarget({ action: 'retry', row });
                    }}
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    disabled={!hasId}
                    title={actionDisabledReason}
                    onClick={() => {
                      setActionReason('');
                      setActionTarget({ action: 'cancel', row });
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    disabled={!hasId}
                    title={actionDisabledReason}
                    onClick={() => {
                      setActionReason('');
                      setActionTarget({ action: 'mark-failed', row });
                    }}
                  >
                    Mark failed
                  </button>
                </>
              )}
            </div>
          );
        }
      }
    ];

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size && rows.length > 0 : page + 1 < pageMeta.totalPages;

  const detailPayload = useMemo(() => {
    if (!selected) return '';
    return showRawPayload ? toText(selected.payload) : toPrettyPayload(selected.payload);
  }, [selected, showRawPayload]);

  const resetFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(0);
  };

  const applyFilters = () => {
    setPage(0);
    setAppliedFilters(filters);
  };

  const handleOutboxTypeChange = (nextType) => {
    if (nextType === outboxType) return;
    setOutboxType(nextType);
    setRows([]);
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(0);
    setSelected(null);
    setDetailOpen(false);
    setDetailError(null);
  };

  const handleAction = async () => {
    const row = actionTarget?.row;
    const action = actionTarget?.action;
    const meta = actionMeta[action];
    if (!row || !meta || row.id === null || row.id === undefined) return;
    setActionLoading(true);
    try {
      const reason = actionReason.trim();
      const payload = reason ? { reason } : undefined;
      await api.outbox[outboxType][meta.method](row.id, payload);
      pushToast({ message: `${meta.label} queued for ${outboxType} #${row.id}.`, tone: 'success' });
      setActionTarget(null);
      setActionReason('');
      fetchRows();
      if (selected?.id === row.id) {
        fetchDetail(row.id);
      }
    } catch (err) {
      pushToast({ message: err.message || `Failed to ${meta.label.toLowerCase()}.`, tone: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Admin Outbox Visibility</div>
          <div style={{ color: 'var(--muted)' }}>{outboxConfig.description}</div>
        </div>
        <Link href="/dashboard" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Dashboard
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        {Object.entries(OUTBOX_TYPES).map(([key, config]) => (
          <button key={key} type="button" className="btn-neutral btn-sm" onClick={() => handleOutboxTypeChange(key)} style={key === outboxType ? { fontWeight: 800 } : undefined}>
            {config.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700, border: '1px solid #fecdd3', background: '#fef2f2' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>Filters & Paging</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
            <button type="button" className="btn-neutral btn-sm" onClick={fetchRows} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {showFilters && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {(outboxType === 'webhooks' ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label htmlFor="provider">Provider</label>
                    <input id="provider" value={filters.provider} onChange={(e) => setFilters((p) => ({ ...p, provider: e.target.value }))} placeholder="UNIPAYMENT" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label htmlFor="handlerKey">Handler Key</label>
                    <input id="handlerKey" value={filters.handlerKey} onChange={(e) => setFilters((p) => ({ ...p, handlerKey: e.target.value }))} placeholder="UNIPAYMENT_DEPOSIT" />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label htmlFor="type">Type</label>
                    <input id="type" value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))} placeholder="BILL_ARAKA_SUBMIT" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label htmlFor="dedupeKey">Dedupe Key</label>
                    <input id="dedupeKey" value={filters.dedupeKey} onChange={(e) => setFilters((p) => ({ ...p, dedupeKey: e.target.value }))} placeholder="NOTIFY_DEFAULT:..." />
                  </div>
                </>
              ))}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="status">Status</label>
                <select id="status" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
                  <option value="">Any</option>
                  <option value="PENDING">PENDING</option>
                  <option value="PROCESSING">PROCESSING</option>
                  <option value="PROCESSED">PROCESSED</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="minRetries">Min retries</label>
                <input id="minRetries" type="number" min={0} value={filters.minRetries} onChange={(e) => setFilters((p) => ({ ...p, minRetries: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="maxRetries">Max retries</label>
                <input id="maxRetries" type="number" min={0} value={filters.maxRetries} onChange={(e) => setFilters((p) => ({ ...p, maxRetries: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="lockedBy">Locked by</label>
                <input id="lockedBy" value={filters.lockedBy} onChange={(e) => setFilters((p) => ({ ...p, lockedBy: e.target.value }))} placeholder="worker.1" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="createdAfter">Created after</label>
                <input id="createdAfter" type="datetime-local" value={filters.createdAfter} onChange={(e) => setFilters((p) => ({ ...p, createdAfter: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="createdBefore">Created before</label>
                <input id="createdBefore" type="datetime-local" value={filters.createdBefore} onChange={(e) => setFilters((p) => ({ ...p, createdBefore: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="page">Page</label>
                <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="size">Rows</label>
                <input id="size" type="number" min={1} max={200} value={size} onChange={(e) => setSize(Number(e.target.value))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label>Navigate</label>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <button type="button" className="btn-neutral" disabled={loading || !canPrev} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    ←
                  </button>
                  <button type="button" className="btn-neutral" disabled={loading || !canNext} onClick={() => setPage((p) => p + 1)}>
                    →
                  </button>
                  <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Page {page + 1}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label>Total elements</label>
                <div style={{ color: 'var(--muted)', fontSize: '13px', paddingTop: '0.7rem' }}>
                  {typeof pageMeta.totalElements === 'number' ? pageMeta.totalElements.toLocaleString() : '—'}
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
              <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Set filters then apply to query.</span>
            </div>
          </>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={size}
        totalPages={pageMeta.totalPages}
        totalElements={pageMeta.totalElements}
        onPageChange={setPage}
        canPrev={canPrev}
        canNext={canNext}
        emptyLabel={loading ? 'Loading outbox rows...' : `No ${outboxType} rows found.`}
      />

      {payloadTarget && (
        <Modal title={`Payload ${outboxType} #${payloadTarget.id ?? ''}`} onClose={() => setPayloadTarget(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {payloadTarget.payloadTruncated ? (
              <div style={{ color: '#b45309', fontSize: '12px' }}>Payload truncated by API response.</div>
            ) : null}
            <pre
              style={{
                margin: 0,
                maxHeight: '460px',
                overflow: 'auto',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '0.75rem',
                fontSize: '12px',
                background: 'rgba(148, 163, 184, 0.08)'
              }}
            >
              {toPrettyPayload(payloadTarget.payload) || '—'}
            </pre>
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setPayloadTarget(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {detailOpen && (
        <Modal title={`${outboxConfig.label} Detail`} onClose={() => setDetailOpen(false)}>
          {detailError && (
            <div className="card" style={{ color: '#b91c1c', fontWeight: 700, border: '1px solid #fecdd3', background: '#fef2f2' }}>
              {detailError}
            </div>
          )}
          {detailLoading ? (
            <div style={{ color: 'var(--muted)' }}>Loading detail...</div>
          ) : selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.6rem' }}>
                {[
                  { label: 'ID', value: selected.id },
                  { label: outboxConfig.primaryLabel, value: selected?.[outboxConfig.primaryField] || '—' },
                  { label: 'Status', value: selected.status || '—' },
                  { label: 'Retries', value: selected.retries ?? 0 },
                  { label: 'Locked At', value: formatDateTime(selected.lockedAt) },
                  { label: 'Locked By', value: selected.lockedBy || '—' },
                  { label: 'Next Attempt At', value: formatDateTime(selected.nextAttemptAt) },
                  { label: 'Processed At', value: formatDateTime(selected.processedAt) },
                  { label: 'Created At', value: formatDateTime(selected.createdAt) },
                  { label: 'Updated At', value: formatDateTime(selected.updatedAt) }
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
                    <div style={{ color: 'var(--muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: 0.4 }}>{item.label}</div>
                    <div style={{ fontWeight: 700 }}>{item.value || '—'}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ fontWeight: 700 }}>Last Error</div>
                <div style={{ whiteSpace: 'pre-wrap', color: selected.lastError ? '#b91c1c' : 'var(--muted)' }}>{selected.lastError || '—'}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700 }}>Payload</div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {selected.payloadTruncated ? <span style={{ color: '#b45309', fontSize: '12px' }}>Payload truncated by API response.</span> : null}
                  <button type="button" className="btn-neutral btn-sm" onClick={() => setShowRawPayload((prev) => !prev)}>
                    {showRawPayload ? 'View formatted' : 'View raw'}
                  </button>
                </div>
              </div>
              <pre
                style={{
                  margin: 0,
                  maxHeight: '380px',
                  overflow: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  fontSize: '12px',
                  background: 'rgba(148, 163, 184, 0.08)'
                }}
              >
                {detailPayload || '—'}
              </pre>
            </div>
          ) : (
            <div style={{ color: 'var(--muted)' }}>Select a row to view detail.</div>
          )}
        </Modal>
      )}

      {actionTarget && (
        <Modal title={`${actionMeta[actionTarget.action]?.label} ${outboxType} #${actionTarget.row?.id ?? ''}`} onClose={() => (actionLoading ? null : setActionTarget(null))}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)' }}>Provide a reason if needed. If empty, backend defaults are applied where supported.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="actionReason">Reason</label>
              <input id="actionReason" value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder="Optional reason" />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setActionTarget(null)} disabled={actionLoading}>
                Close
              </button>
              <button type="button" className={actionMeta[actionTarget.action]?.buttonClass || 'btn-neutral'} onClick={handleAction} disabled={actionLoading}>
                {actionLoading ? 'Submitting...' : actionMeta[actionTarget.action]?.label || 'Submit'}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
