'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { useAuth } from '@/contexts/AuthContext';

const emptyState = { internalReference: '', externalReference: '', accountId: '', verified: false, metaData: '' };
const emptyFilters = { accountReference: '', email: '', phoneNumber: '' };

const toPayload = (state) => ({
  internalReference: state.internalReference,
  externalReference: state.externalReference || null,
  accountId: Number(state.accountId) || 0,
  verified: Boolean(state.verified),
  metaData: state.metaData || null
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

export default function CardHoldersPage() {
  const { session } = useAuth();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmReset, setConfirmReset] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);

  const isSuperAdmin = useMemo(() => {
    const payload = session?.tokens?.idToken?.payload || session?.tokens?.accessToken?.payload;
    const role = payload?.role || payload?.['custom:role'];
    if (role && String(role).toUpperCase() === 'SUPER_ADMIN') return true;
    const groups = payload?.['cognito:groups'] || payload?.groups;
    if (Array.isArray(groups)) {
      return groups.some((group) => String(group).toUpperCase() === 'SUPER_ADMIN');
    }
    if (typeof groups === 'string') {
      return groups.split(',').some((group) => String(group).trim().toUpperCase() === 'SUPER_ADMIN');
    }
    return false;
  }, [session]);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      Object.entries(filters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        params.set(key, String(value));
      });
      const res = await api.cardHolders.list(params);
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
  }, [page, size, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'internalReference', label: 'Internal ref' },
    { key: 'userName', label: 'User name' },
    { key: 'userEmail', label: 'User email' },
    { key: 'accountId', label: 'Account ID' },
    { key: 'verified', label: 'Verified' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral">View</button>
          <button type="button" onClick={() => openEdit(row)} className="btn-neutral">Edit</button>
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
      externalReference: row.externalReference ?? '',
      accountId: row.accountId ?? '',
      verified: Boolean(row.verified),
      metaData: row.metaData ?? ''
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
      await api.cardHolders.create(toPayload(draft));
      setInfo('Created card holder.');
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
      await api.cardHolders.update(selected.id, toPayload(draft));
      setInfo(`Updated card holder ${selected.id}.`);
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
      await api.cardHolders.remove(id);
      setInfo(`Deleted card holder ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReset = async () => {
    if (!confirmReset?.id) return;
    const id = confirmReset.id;
    setError(null);
    setInfo(null);
    setResetLoading(true);
    try {
      const res = await api.cardHolders.reset(id);
      setSelected(res || null);
      setRows((prev) => prev.map((row) => (row.id === id ? res : row)));
      setInfo(`Reset card holder ${id}.`);
      setConfirmReset(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="internalReference">Internal reference</label>
        <input id="internalReference" value={draft.internalReference} onChange={(e) => setDraft((p) => ({ ...p, internalReference: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="externalReference">External reference</label>
        <input id="externalReference" value={draft.externalReference} onChange={(e) => setDraft((p) => ({ ...p, externalReference: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="accountId">Account ID</label>
        <input id="accountId" type="number" value={draft.accountId} onChange={(e) => setDraft((p) => ({ ...p, accountId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="metaData">Metadata</label>
        <input id="metaData" value={draft.metaData} onChange={(e) => setDraft((p) => ({ ...p, metaData: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="verified" type="checkbox" checked={draft.verified} onChange={(e) => setDraft((p) => ({ ...p, verified: e.target.checked }))} />
        <label htmlFor="verified">Verified</label>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Card Holders</div>
          <div style={{ color: 'var(--muted)' }}>Manage card holders tied to accounts.</div>
        </div>
        <Link href="/dashboard/cards" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Cards hub
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="page">Page</label>
          <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="size">Size</label>
          <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="accountReference">Account reference</label>
          <input
            id="accountReference"
            value={filters.accountReference}
            onChange={(e) => setFilters((p) => ({ ...p, accountReference: e.target.value }))}
            placeholder="ACC-123"
          />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            value={filters.email}
            onChange={(e) => setFilters((p) => ({ ...p, email: e.target.value }))}
            placeholder="john@example.com"
          />
        </div>
        <div>
          <label htmlFor="phoneNumber">Phone number</label>
          <input
            id="phoneNumber"
            value={filters.phoneNumber}
            onChange={(e) => setFilters((p) => ({ ...p, phoneNumber: e.target.value }))}
            placeholder="+243"
          />
        </div>
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button
          type="button"
          onClick={() => {
            setFilters(emptyFilters);
            setPage(0);
          }}
          disabled={loading}
          className="btn-neutral"
        >
          Clear filters
        </button>
        <button type="button" onClick={openCreate} className="btn-success">
          Add card holder
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No card holders found" />

      {showCreate && (
        <Modal title="Add card holder" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit card holder ${selected?.id}`} onClose={() => setShowEdit(false)}>
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
              { label: 'External ref', value: selected?.externalReference },
              { label: 'Account ID', value: selected?.accountId },
              { label: 'User name', value: selected?.userName },
              { label: 'User email', value: selected?.userEmail },
              { label: 'Verified', value: String(selected?.verified) },
              { label: 'Metadata', value: selected?.metaData }
            ]}
          />
          {isSuperAdmin && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button type="button" onClick={() => setConfirmReset(selected)} className="btn-danger">
                Reset card holder
              </button>
            </div>
          )}
        </Modal>
      )}

      {confirmReset && (
        <Modal title="Reset card holder" onClose={() => setConfirmReset(null)}>
          <div style={{ color: 'var(--muted)' }}>
            This will unset verification and external reference. Continue?
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmReset(null)} className="btn-neutral" disabled={resetLoading}>
              Cancel
            </button>
            <button type="button" onClick={handleReset} className="btn-danger" disabled={resetLoading}>
              {resetLoading ? 'Resetting…' : 'Reset card holder'}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete card holder <strong>{confirmDelete.internalReference || confirmDelete.id}</strong>? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
