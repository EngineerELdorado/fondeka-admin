'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const statusOptions = ['IN_PREPARATION', 'ACTIVE', 'FAILED', 'BLOCKED_BY_USER', 'BLOCKED_BY_ADMIN', 'DELETED_BY_PROVIDER'];

const emptyState = {
  internalReference: '',
  name: '',
  externalReference: '',
  status: 'IN_PREPARATION',
  last4: '',
  cardHolderId: '',
  accountId: '',
  issued: false,
  cardProductCardProviderId: ''
};

const emptyFilters = {
  status: '',
  issued: '',
  accountId: '',
  cardHolderId: '',
  internalReference: '',
  externalReference: '',
  name: ''
};

const toPayload = (state) => ({
  internalReference: state.internalReference,
  name: state.name,
  externalReference: state.externalReference || null,
  status: state.status,
  last4: state.last4 || null,
  cardHolderId: Number(state.cardHolderId) || 0,
  accountId: Number(state.accountId) || 0,
  issued: Boolean(state.issued),
  cardProductCardProviderId: Number(state.cardProductCardProviderId) || 0
});

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

const StatusBadge = ({ value }) => {
  if (!value) return '—';
  const val = String(value).toUpperCase();
  const tone =
    val === 'ACTIVE'
      ? { bg: '#ECFDF3', fg: '#15803D' }
      : val === 'IN_PREPARATION'
        ? { bg: '#EFF6FF', fg: '#1D4ED8' }
        : val === 'FAILED'
          ? { bg: '#FEF2F2', fg: '#B91C1C' }
          : val === 'BLOCKED_BY_ADMIN' || val === 'BLOCKED_BY_USER'
            ? { bg: '#FFF7ED', fg: '#9A3412' }
            : val === 'DELETED_BY_PROVIDER'
              ? { bg: '#E5E7EB', fg: '#374151' }
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

export default function CardsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmBlock, setConfirmBlock] = useState(null);
  const [confirmUnblock, setConfirmUnblock] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        if (key === 'issued') {
          params.set('issued', String(value));
        } else {
          params.set(key, String(value));
        }
      });
      const res = await api.cards.list(params);
    const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
    { key: 'last4', label: 'Last 4', render: (row) => row.last4 || '—' },
    { key: 'issued', label: 'Issued', render: (row) => (row.issued ? 'Yes' : 'No') },
    { key: 'internalReference', label: 'Internal ref' },
    { key: 'externalReference', label: 'External ref', render: (row) => row.externalReference || '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral">View</button>
          <button type="button" onClick={() => openEdit(row)} className="btn-neutral">Edit</button>
          {row.status === 'BLOCKED_BY_ADMIN' ? (
            <button type="button" onClick={() => setConfirmUnblock(row)} className="btn-success">Unblock</button>
          ) : (
            <button type="button" onClick={() => setConfirmBlock(row)} className="btn-danger">Block</button>
          )}
          <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger">Delete</button>
        </div>
      )
    }
  ], []);

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      internalReference: row.internalReference ?? '',
      name: row.name ?? '',
      externalReference: row.externalReference ?? '',
      status: row.status ?? '',
      last4: row.last4 ?? '',
      cardHolderId: row.cardHolderId ?? '',
      accountId: row.accountId ?? '',
      issued: Boolean(row.issued),
      cardProductCardProviderId: row.cardProductCardProviderId ?? ''
    });
    setShowEdit(true);
    setInfo(null);
    setError(null);
  };

  const openDetail = (row) => {
    setSelected(row);
    setShowDetail(true);
    setInfo(null);
    setError(null);
  };

  const handleCreate = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.cards.create(toPayload(draft));
      setInfo('Created card.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    setError(null);
    setInfo(null);
    try {
      await api.cards.update(selected.id, toPayload(draft));
      setInfo(`Updated card ${selected.id}.`);
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete?.id) return;
    const id = confirmDelete.id;
    setError(null);
    setInfo(null);
    try {
      await api.cards.remove(id);
      setInfo(`Deleted card ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBlock = async () => {
    if (!confirmBlock?.id) return;
    setError(null);
    setInfo(null);
    try {
      await api.cards.block(confirmBlock.id);
      setInfo(`Blocked card ${confirmBlock.id}.`);
      setConfirmBlock(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUnblock = async () => {
    if (!confirmUnblock?.id) return;
    setError(null);
    setInfo(null);
    try {
      await api.cards.unblock(confirmUnblock.id);
      setInfo(`Unblocked card ${confirmUnblock.id}.`);
      setConfirmUnblock(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="internalReference">Internal reference</label>
        <input id="internalReference" value={draft.internalReference} onChange={(e) => setDraft((p) => ({ ...p, internalReference: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="name">Name</label>
        <input id="name" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="externalReference">External reference</label>
        <input id="externalReference" value={draft.externalReference} onChange={(e) => setDraft((p) => ({ ...p, externalReference: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="status">Status</label>
        <select id="status" value={draft.status} onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))}>
          {statusOptions.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="last4">Last 4</label>
        <input id="last4" value={draft.last4} onChange={(e) => setDraft((p) => ({ ...p, last4: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="cardHolderId">Card holder ID</label>
        <input id="cardHolderId" type="number" value={draft.cardHolderId} onChange={(e) => setDraft((p) => ({ ...p, cardHolderId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="accountId">Account ID</label>
        <input id="accountId" type="number" value={draft.accountId} onChange={(e) => setDraft((p) => ({ ...p, accountId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="cardProductCardProviderId">Card product/provider ID</label>
        <input
          id="cardProductCardProviderId"
          type="number"
          value={draft.cardProductCardProviderId}
          onChange={(e) => setDraft((p) => ({ ...p, cardProductCardProviderId: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="issued" type="checkbox" checked={draft.issued} onChange={(e) => setDraft((p) => ({ ...p, issued: e.target.checked }))} />
        <label htmlFor="issued">Issued</label>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Cards</div>
          <div style={{ color: 'var(--muted)' }}>Issue and manage individual cards.</div>
        </div>
        <Link href="/dashboard/cards" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Cards hub
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="statusFilter">Status</label>
            <select
              id="statusFilter"
              value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
            >
              <option value="">All</option>
              {statusOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="issuedFilter">Issued</label>
            <select
              id="issuedFilter"
              value={filters.issued}
              onChange={(e) => setFilters((p) => ({ ...p, issued: e.target.value }))}
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="internalReference">Internal reference</label>
            <input id="internalReference" value={filters.internalReference} onChange={(e) => setFilters((p) => ({ ...p, internalReference: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="externalReference">External reference</label>
            <input id="externalReference" value={filters.externalReference} onChange={(e) => setFilters((p) => ({ ...p, externalReference: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="nameFilter">Name</label>
            <input id="nameFilter" value={filters.name} onChange={(e) => setFilters((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="accountId">Account ID</label>
            <input id="accountId" type="number" value={filters.accountId} onChange={(e) => setFilters((p) => ({ ...p, accountId: e.target.value }))} />
          </div>
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
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => {
              setPage(0);
              setAppliedFilters(filters);
            }}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Applying…' : 'Apply filters'}
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(emptyFilters);
              setAppliedFilters(emptyFilters);
              setPage(0);
            }}
            disabled={loading}
            className="btn-neutral"
          >
            Reset
          </button>
          <button type="button" onClick={fetchRows} disabled={loading} className="btn-neutral">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" onClick={openCreate} className="btn-success">
            Add card
          </button>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel="No cards found" />

      {showCreate && (
        <Modal title="Add card" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit card ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleUpdate} className="btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Details ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Internal ref', value: selected?.internalReference },
              { label: 'Name', value: selected?.name },
              { label: 'External ref', value: selected?.externalReference },
              { label: 'Status', value: <StatusBadge value={selected?.status} /> },
              { label: 'Last 4', value: selected?.last4 },
              { label: 'Issued', value: String(selected?.issued) },
              { label: 'Product/provider ID', value: selected?.cardProductCardProviderId }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete card <strong>{confirmDelete.name || confirmDelete.id}</strong>? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </Modal>
      )}

      {confirmBlock && (
        <Modal title="Block card" onClose={() => setConfirmBlock(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Block card <strong>{confirmBlock.name || confirmBlock.id}</strong>? Users will not be able to use it.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmBlock(null)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleBlock} className="btn-danger">Block</button>
          </div>
        </Modal>
      )}

      {confirmUnblock && (
        <Modal title="Unblock card" onClose={() => setConfirmUnblock(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Unblock card <strong>{confirmUnblock.name || confirmUnblock.id}</strong>? Status will move to ACTIVE.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmUnblock(null)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleUnblock} className="btn-success">Unblock</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
