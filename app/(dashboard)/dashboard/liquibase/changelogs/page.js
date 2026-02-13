'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={{ maxWidth: '860px' }}>
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
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700, wordBreak: 'break-word' }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

export default function LiquibaseChangelogsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [selected, setSelected] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      const res = await api.liquibase.listChangelogs(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err.message || 'Failed to load Liquibase changelogs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((row) =>
      [row.filename, row.id, row.author]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text))
    );
  }, [rows, query]);

  const columns = useMemo(
    () => [
      { key: 'dateExecuted', label: 'Date Executed', render: (row) => formatDateTime(row.dateExecuted) },
      { key: 'filename', label: 'Filename' },
      { key: 'id', label: 'ID' },
      { key: 'author', label: 'Author' },
      { key: 'execType', label: 'Exec Type' },
      { key: 'orderExecuted', label: 'Order' },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <button type="button" className="btn-neutral btn-sm" onClick={() => setSelected(row)}>
            View
          </button>
        )
      }
    ],
    []
  );

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? true : page + 1 < pageMeta.totalPages;

  const details = useMemo(() => {
    if (!selected) return [];
    return [
      { label: 'Date Executed', value: formatDateTime(selected.dateExecuted) },
      { label: 'Filename', value: selected.filename || '—' },
      { label: 'ID', value: selected.id || '—' },
      { label: 'Author', value: selected.author || '—' },
      { label: 'Exec Type', value: selected.execType || '—' },
      { label: 'Order Executed', value: selected.orderExecuted ?? '—' },
      { label: 'Description', value: selected.description || '—' },
      { label: 'Comments', value: selected.comments || '—' },
      { label: 'Tag', value: selected.tag || '—' },
      { label: 'Contexts', value: selected.contexts || '—' },
      { label: 'Labels', value: selected.labels || '—' },
      { label: 'MD5 Sum', value: selected.md5sum || '—' },
      { label: 'Deployment ID', value: selected.deploymentId || '—' },
      { label: 'Liquibase', value: selected.liquibase || '—' }
    ];
  }, [selected]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Liquibase Changelogs</div>
          <div style={{ color: 'var(--muted)' }}>Admin read-only history from `DATABASECHANGELOG`.</div>
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

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="quickFilter">Quick filter (filename, id, author)</label>
            <input id="quickFilter" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search current page..." />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="size">Page size</label>
            <select
              id="size"
              value={size}
              onChange={(e) => {
                setPage(0);
                setSize(Number(e.target.value));
              }}
            >
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral btn-sm" onClick={fetchRows} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Page {page + 1}
            {pageMeta.totalPages !== null ? ` of ${pageMeta.totalPages}` : ''}
            {pageMeta.totalElements !== null ? ` • ${pageMeta.totalElements} total rows` : ''}
          </div>
          {query.trim() && (
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Showing {filteredRows.length} of {rows.length} rows on current page
            </div>
          )}
        </div>
      </div>

      <DataTable columns={columns} rows={filteredRows} emptyLabel={loading ? 'Loading...' : 'No changelogs found'} showIndex={false} />

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
        <button type="button" className="btn-neutral btn-sm" disabled={!canPrev} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          Prev
        </button>
        <button type="button" className="btn-neutral btn-sm" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>

      {selected && (
        <Modal title={`ChangeSet ${selected.id || ''}`} onClose={() => setSelected(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <DetailGrid rows={details} />
          </div>
        </Modal>
      )}
    </div>
  );
}
