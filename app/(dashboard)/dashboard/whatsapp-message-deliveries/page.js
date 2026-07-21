'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const statusOptions = ['', 'SENT', 'DELIVERED', 'READ', 'FAILED'];
const hasErrorOptions = [
  { value: '', label: 'All' },
  { value: 'true', label: 'With error' },
  { value: 'false', label: 'No error' }
];

const emptyFilters = {
  status: '',
  hasError: '',
  metaMessageId: '',
  recipientLast4: '',
  recipientWaId: '',
  conversationId: '',
  pricingCategory: '',
  errorCode: '',
  providerTimestampAfter: '',
  providerTimestampBefore: '',
  createdAfter: '',
  createdBefore: ''
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={{ gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
          x
        </button>
      </div>
      {children}
    </div>
  </div>
);

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'grid', gap: '0.15rem', padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{row.value ?? '-'}</div>
      </div>
    ))}
  </div>
);

const normalizeList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.content)) return response.content;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.results)) return response.results;
  return [];
};

const formatDateTime = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  const raw = typeof value === 'number' || /^\d+$/.test(String(value)) ? Number(value) : value;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const toEpochMillis = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
};

const truncate = (value, max = 32) => {
  const text = String(value || '');
  if (!text) return '-';
  return text.length <= max ? text : `${text.slice(0, max - 1)}...`;
};

const statusTone = (value) => {
  const status = String(value || '').toUpperCase();
  if (status === 'READ' || status === 'DELIVERED') return { bg: '#ecfdf3', fg: '#15803d' };
  if (status === 'SENT') return { bg: '#eff6ff', fg: '#1d4ed8' };
  if (status === 'FAILED') return { bg: '#fef2f2', fg: '#b91c1c' };
  return { bg: '#f3f4f6', fg: '#374151' };
};

const StatusBadge = ({ value }) => {
  if (!value) return '-';
  const tone = statusTone(value);
  return (
    <span style={{ display: 'inline-flex', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '12px', fontWeight: 800, background: tone.bg, color: tone.fg }}>
      {String(value).toUpperCase()}
    </span>
  );
};

export default function WhatsappMessageDeliveriesPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(true);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', String(Math.max(0, Number(page) || 0)));
    params.set('size', String(Math.min(MAX_PAGE_SIZE, Math.max(1, Number(size) || DEFAULT_PAGE_SIZE))));
    Object.entries(appliedFilters).forEach(([key, value]) => {
      const trimmed = String(value ?? '').trim();
      if (!trimmed) return;
      if (['providerTimestampAfter', 'providerTimestampBefore', 'createdAfter', 'createdBefore'].includes(key)) {
        const millis = toEpochMillis(trimmed);
        if (millis !== null) params.set(key, String(millis));
        return;
      }
      params.set(key, trimmed);
    });
    return params;
  }, [appliedFilters, page, size]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.whatsappMessageDeliveries.list(buildQuery());
      const list = normalizeList(res);
      setRows(list);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setRows([]);
      setPageMeta({ totalElements: null, totalPages: null });
      setError(err?.message || 'Failed to load WhatsApp message deliveries.');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const openDetail = async (row) => {
    if (!row?.id) return;
    setDetailLoading(true);
    setError(null);
    try {
      const data = await api.whatsappMessageDeliveries.get(row.id);
      setSelected(data || row);
      setShowDetail(true);
    } catch (err) {
      setError(err?.message || `Failed to load WhatsApp delivery ${row.id}.`);
    } finally {
      setDetailLoading(false);
    }
  };

  const applyFilters = () => {
    setPage(0);
    setAppliedFilters(filters);
  };

  const applyFailedFilter = () => {
    const next = { ...emptyFilters, status: 'FAILED', hasError: 'true' };
    setFilters(next);
    setAppliedFilters(next);
    setPage(0);
    setShowFilters(true);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(0);
  };

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === Number(size) : page + 1 < pageMeta.totalPages;

  const columns = useMemo(() => [
    { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
    { key: 'recipientLast4', label: 'Recipient last 4', render: (row) => row.recipientLast4 || '-' },
    { key: 'metaMessageId', label: 'Meta message ID', render: (row) => <span title={row.metaMessageId || ''}>{truncate(row.metaMessageId, 28)}</span> },
    { key: 'conversationId', label: 'Conversation', render: (row) => <span title={row.conversationId || ''}>{truncate(row.conversationId, 24)}</span> },
    { key: 'pricingCategory', label: 'Pricing' },
    { key: 'errorCode', label: 'Error', render: (row) => row.errorCode || '-' },
    { key: 'providerTimestamp', label: 'Meta event time', render: (row) => formatDateTime(row.providerTimestamp) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <button type="button" className="btn-neutral btn-sm" onClick={() => openDetail(row)} disabled={detailLoading}>
          View
        </button>
      )
    }
  ], [detailLoading]);

  const renderTextFilter = (id, label, placeholder) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label htmlFor={id}>{label}</label>
      <input id={id} value={filters[id]} onChange={(e) => setFilters((prev) => ({ ...prev, [id]: e.target.value }))} placeholder={placeholder} />
    </div>
  );

  const renderDateFilter = (id, label) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="datetime-local" value={filters[id]} onChange={(e) => setFilters((prev) => ({ ...prev, [id]: e.target.value }))} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.2rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>WhatsApp Deliveries</div>
          <div style={{ color: 'var(--muted)' }}>Meta WhatsApp delivery, read, and failure callbacks received by the backend.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/whatsapp-template-catalog" className="btn-neutral">
            Template catalog
          </Link>
          <button type="button" className="btn-neutral btn-sm" onClick={fetchRows} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '0.2rem' }}>
            <div style={{ fontWeight: 700 }}>Filters</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Use recipient last 4 for safer searches when possible.</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-danger btn-sm" onClick={applyFailedFilter} disabled={loading}>
              Failed with errors
            </button>
            <button type="button" className="btn-neutral btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
          </div>
        </div>

        {showFilters && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="status">Status</label>
                <select id="status" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                  {statusOptions.map((status) => (
                    <option key={status || 'ALL'} value={status}>
                      {status || 'All'}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="hasError">Error state</label>
                <select id="hasError" value={filters.hasError} onChange={(e) => setFilters((prev) => ({ ...prev, hasError: e.target.value }))}>
                  {hasErrorOptions.map((option) => (
                    <option key={option.value || 'ALL'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {renderTextFilter('recipientLast4', 'Recipient last 4', '1234')}
              {renderTextFilter('metaMessageId', 'Meta message ID', 'wamid...')}
              {renderTextFilter('conversationId', 'Conversation ID', 'conversation id')}
              {renderTextFilter('pricingCategory', 'Pricing category', 'utility')}
              {renderTextFilter('errorCode', 'Error code', '131000')}
              {renderTextFilter('recipientWaId', 'Recipient WA ID', 'full wa id')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {renderDateFilter('providerTimestampAfter', 'Meta event after')}
              {renderDateFilter('providerTimestampBefore', 'Meta event before')}
              {renderDateFilter('createdAfter', 'Created after')}
              {renderDateFilter('createdBefore', 'Created before')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="page">Page</label>
                <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Math.max(0, Number(e.target.value) || 0))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="size">Size</label>
                <input id="size" type="number" min={1} max={MAX_PAGE_SIZE} value={size} onChange={(e) => { setSize(Math.min(MAX_PAGE_SIZE, Math.max(1, Number(e.target.value) || DEFAULT_PAGE_SIZE))); setPage(0); }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" className="btn-primary" onClick={applyFilters} disabled={loading}>
                Apply filters
              </button>
              <button type="button" className="btn-neutral" onClick={resetFilters} disabled={loading}>
                Reset
              </button>
              <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
                Date filters are sent as epoch milliseconds.
              </span>
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ color: 'var(--muted)', fontSize: '13px' }}>
        This report only shows delivery records after Meta webhook delivery tracking is deployed and Meta calls the webhook.
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}

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
        emptyLabel="No WhatsApp deliveries found"
        showAccountQuickNav={false}
      />

      {showDetail && (
        <Modal title={`WhatsApp delivery ${selected?.id}`} onClose={() => { setShowDetail(false); setSelected(null); }}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Status', value: <StatusBadge value={selected?.status} /> },
              { label: 'Meta message ID', value: selected?.metaMessageId },
              { label: 'Recipient WA ID', value: selected?.recipientWaId },
              { label: 'Recipient last 4', value: selected?.recipientLast4 },
              { label: 'Conversation ID', value: selected?.conversationId },
              { label: 'Pricing category', value: selected?.pricingCategory },
              { label: 'Error code', value: selected?.errorCode },
              { label: 'Error title', value: selected?.errorTitle },
              { label: 'Error message', value: selected?.errorMessage },
              { label: 'Meta event time', value: formatDateTime(selected?.providerTimestamp) },
              { label: 'Sent at', value: formatDateTime(selected?.sentAt) },
              { label: 'Delivered at', value: formatDateTime(selected?.deliveredAt) },
              { label: 'Read at', value: formatDateTime(selected?.readAt) },
              { label: 'Failed at', value: formatDateTime(selected?.failedAt) },
              { label: 'Created at', value: formatDateTime(selected?.createdAt) },
              { label: 'Updated at', value: formatDateTime(selected?.updatedAt) }
            ]}
          />
        </Modal>
      )}
    </div>
  );
}
