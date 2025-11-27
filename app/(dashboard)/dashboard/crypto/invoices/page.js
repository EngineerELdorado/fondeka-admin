'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  walletId: '',
  internalReference: '',
  externalReference: '',
  address: '',
  memoTag: '',
  expectedAmount: '',
  status: ''
};

const toPayload = (state) => ({
  walletId: Number(state.walletId) || 0,
  internalReference: state.internalReference || null,
  externalReference: state.externalReference || null,
  address: state.address || null,
  memoTag: state.memoTag || null,
  expectedAmount: state.expectedAmount === '' ? null : Number(state.expectedAmount),
  status: state.status || null
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

export default function CryptoInvoicesPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [loading, setLoading] = useState(false);
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
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.cryptoInvoices.list(params);
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
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'walletId', label: 'Wallet ID' },
      { key: 'internalReference', label: 'Internal ref' },
      { key: 'address', label: 'Address' },
      { key: 'expectedAmount', label: 'Expected amount' },
      { key: 'status', label: 'Status' },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openDetail(row)} className="btn-neutral">
              View
            </button>
            <button type="button" onClick={() => openEdit(row)} className="btn-neutral">
              Edit
            </button>
            <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger">
              Delete
            </button>
          </div>
        )
      }
    ],
    []
  );

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      walletId: row.walletId ?? '',
      internalReference: row.internalReference ?? '',
      externalReference: row.externalReference ?? '',
      address: row.address ?? '',
      memoTag: row.memoTag ?? '',
      expectedAmount: row.expectedAmount ?? '',
      status: row.status ?? ''
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
      await api.cryptoInvoices.create(toPayload(draft));
      setInfo('Created crypto invoice.');
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
      await api.cryptoInvoices.update(selected.id, toPayload(draft));
      setInfo(`Updated invoice ${selected.id}.`);
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
      await api.cryptoInvoices.remove(id);
      setInfo(`Deleted invoice ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="walletId">Wallet ID</label>
        <input id="walletId" type="number" value={draft.walletId} onChange={(e) => setDraft((p) => ({ ...p, walletId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="internalReference">Internal reference</label>
        <input id="internalReference" value={draft.internalReference} onChange={(e) => setDraft((p) => ({ ...p, internalReference: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="externalReference">External reference</label>
        <input id="externalReference" value={draft.externalReference} onChange={(e) => setDraft((p) => ({ ...p, externalReference: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="address">Address</label>
        <input id="address" value={draft.address} onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="memoTag">Memo/Tag</label>
        <input id="memoTag" value={draft.memoTag} onChange={(e) => setDraft((p) => ({ ...p, memoTag: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="expectedAmount">Expected amount</label>
        <input id="expectedAmount" type="number" value={draft.expectedAmount} onChange={(e) => setDraft((p) => ({ ...p, expectedAmount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="status">Status</label>
        <input id="status" value={draft.status} onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))} placeholder="NEW, PAID..." />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Crypto Invoices</div>
          <div style={{ color: 'var(--muted)' }}>Invoice addresses, expected amounts and status.</div>
        </div>
        <Link href="/dashboard/crypto" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Crypto hub
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
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button type="button" onClick={openCreate} className="btn-success">
          Add invoice
        </button>
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

      <DataTable columns={columns} rows={rows} emptyLabel="No crypto invoices found" />

      {showCreate && (
        <Modal title="Add crypto invoice" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleCreate} className="btn-success">
              Create
            </button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit invoice ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleUpdate} className="btn-primary">
              Save
            </button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Details ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Wallet ID', value: selected?.walletId },
              { label: 'Internal ref', value: selected?.internalReference },
              { label: 'External ref', value: selected?.externalReference },
              { label: 'Address', value: selected?.address },
              { label: 'Memo/Tag', value: selected?.memoTag },
              { label: 'Expected amount', value: selected?.expectedAmount },
              { label: 'Status', value: selected?.status }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete invoice <strong>{confirmDelete.internalReference || confirmDelete.id}</strong>? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleDelete} className="btn-danger">
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
