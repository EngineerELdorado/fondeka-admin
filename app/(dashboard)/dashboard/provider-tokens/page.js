'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = { token: '', providerName: '', profileKey: '' };

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={{ gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{row.value ?? '-'}</div>
      </div>
    ))}
  </div>
);

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const maskToken = (value) => {
  const token = String(value || '');
  if (!token) return '-';
  if (token.length <= 8) return '********';
  return `${token.slice(0, 4)}******${token.slice(-4)}`;
};

export default function ProviderTokensPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      const res = await api.providerTokens.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err.message || 'Failed to load provider tokens.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateDraft = () => {
    if (!draft.providerName.trim()) return 'Provider name is required.';
    if (!draft.profileKey.trim()) return 'Profile key is required.';
    if (!draft.token.trim()) return 'Token is required.';
    return null;
  };

  const buildPayload = () => ({
    providerName: draft.providerName.trim(),
    profileKey: draft.profileKey.trim(),
    token: draft.token.trim()
  });

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setError(null);
    setInfo(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      providerName: row.providerName ?? '',
      profileKey: row.profileKey ?? '',
      token: row.token ?? ''
    });
    setShowEdit(true);
    setError(null);
    setInfo(null);
  };

  const openDetail = async (row) => {
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      const data = await api.providerTokens.get(row.id);
      setSelected(data || row);
      setShowDetail(true);
    } catch (err) {
      setError(err.message || `Failed to load token ${row.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async () => {
    const message = validateDraft();
    if (message) {
      setError(message);
      return;
    }
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.providerTokens.create(buildPayload());
      setInfo('Created provider token.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to create provider token.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    const message = validateDraft();
    if (message) {
      setError(message);
      return;
    }
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.providerTokens.update(selected.id, buildPayload());
      setInfo(`Updated provider token ${selected.id}.`);
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to update token ${selected.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete?.id) return;
    const id = confirmDelete.id;
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.providerTokens.remove(id);
      setInfo(`Deleted provider token ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to delete token ${id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size : page + 1 < pageMeta.totalPages;

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'providerName', label: 'Provider name' },
      { key: 'profileKey', label: 'Profile key' },
      { key: 'token', label: 'Token', render: (row) => maskToken(row.token) },
      { key: 'updatedAt', label: 'Updated at', render: (row) => formatDateTime(row.updatedAt) },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openDetail(row)} className="btn-neutral" disabled={actionLoading}>
              View
            </button>
            <button type="button" onClick={() => openEdit(row)} className="btn-neutral" disabled={actionLoading}>
              Edit
            </button>
            <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger" disabled={actionLoading}>
              Delete
            </button>
          </div>
        )
      }
    ],
    [actionLoading]
  );

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="providerName">Provider name</label>
        <input id="providerName" value={draft.providerName} onChange={(e) => setDraft((p) => ({ ...p, providerName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="profileKey">Profile key</label>
        <input id="profileKey" value={draft.profileKey} onChange={(e) => setDraft((p) => ({ ...p, profileKey: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="token">Token</label>
        <input
          id="token"
          type="text"
          value={draft.token}
          onChange={(e) => setDraft((p) => ({ ...p, token: e.target.value }))}
          placeholder="Paste provider token"
        />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Provider Tokens</div>
          <div style={{ color: 'var(--muted)' }}>Manage provider API tokens used by backend integrations.</div>
        </div>
        <Link href="/dashboard" className="btn-neutral">
          {'<- Dashboard'}
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="page">Page</label>
          <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Math.max(0, Number(e.target.value) || 0))} />
        </div>
        <div>
          <label htmlFor="size">Size</label>
          <input
            id="size"
            type="number"
            min={1}
            max={200}
            value={size}
            onChange={(e) => {
              const nextSize = Math.max(1, Number(e.target.value) || 1);
              setSize(nextSize);
              setPage(0);
            }}
          />
        </div>
        <button type="button" onClick={fetchRows} disabled={loading || actionLoading} className="btn-primary">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <button type="button" onClick={openCreate} disabled={actionLoading} className="btn-success">
          Create token
        </button>
        {pageMeta.totalElements !== null && (
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {pageMeta.totalElements} tokens total
            {pageMeta.totalPages !== null && pageMeta.totalPages > 0 ? ` | page ${page + 1}/${pageMeta.totalPages}` : ''}
          </span>
        )}
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}
      {info && (
        <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>
          {info}
        </div>
      )}

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
        emptyLabel="No provider tokens found"
      />

      {showCreate && (
        <Modal title="Create provider token" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral" disabled={actionLoading}>
              Cancel
            </button>
            <button type="button" onClick={handleCreate} className="btn-success" disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Create'}
            </button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit token ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral" disabled={actionLoading}>
              Cancel
            </button>
            <button type="button" onClick={handleUpdate} className="btn-primary" disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Provider token ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Provider name', value: selected?.providerName },
              { label: 'Profile key', value: selected?.profileKey },
              { label: 'Token', value: selected?.token },
              { label: 'Created at', value: formatDateTime(selected?.createdAt) },
              { label: 'Updated at', value: formatDateTime(selected?.updatedAt) }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete provider token <strong>{confirmDelete.id}</strong> ({confirmDelete.providerName || 'Unknown provider'})? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral" disabled={actionLoading}>
              Cancel
            </button>
            <button type="button" onClick={handleDelete} className="btn-danger" disabled={actionLoading}>
              {actionLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
