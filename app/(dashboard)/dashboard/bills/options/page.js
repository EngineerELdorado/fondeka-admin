'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  billProductBillProviderId: '',
  name: '',
  externalReference: '',
  displayName: '',
  price: '',
  currency: '',
  ourPriceInUsd: ''
};

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

const toPayload = (state) => ({
  billProductBillProviderId: Number(state.billProductBillProviderId) || 0,
  name: state.name,
  externalReference: state.externalReference,
  displayName: state.displayName,
  price: state.price === '' ? null : Number(state.price),
  currency: state.currency,
  ourPriceInUsd: state.ourPriceInUsd === '' ? null : Number(state.ourPriceInUsd)
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

export default function BillOptionsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [mappings, setMappings] = useState([]);
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
      const res = await api.billProductBillProviderOptions.list(params);
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

  useEffect(() => {
    const loadMappings = async () => {
      try {
        const res = await api.billProductBillProviders.list(new URLSearchParams({ page: '0', size: '200' }));
        const list = Array.isArray(res) ? res : res?.content || [];
        setMappings(list || []);
      } catch {
        // ignore option loading errors
      }
    };
    loadMappings();
  }, []);

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'displayName', label: 'Display' },
    { key: 'price', label: 'Price', render: (row) => `${row.price ?? ''} ${row.currency ?? ''}`.trim() },
    { key: 'ourPriceInUsd', label: 'Our price (USD)', render: (row) => (row.ourPriceInUsd ? `${row.ourPriceInUsd} $` : '—') },
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
      billProductBillProviderId: row.billProductBillProviderId ?? '',
      name: row.name ?? '',
      externalReference: row.externalReference ?? '',
      displayName: row.displayName ?? '',
      price: row.price ?? '',
      currency: row.currency ?? '',
      ourPriceInUsd: row.ourPriceInUsd ?? ''
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
      await api.billProductBillProviderOptions.create(toPayload(draft));
      setInfo('Created option.');
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
      await api.billProductBillProviderOptions.update(selected.id, toPayload(draft));
      setInfo(`Updated option ${selected.id}.`);
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
      await api.billProductBillProviderOptions.remove(id);
      setInfo(`Deleted option ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="billProductBillProviderId">Product/Provider</label>
        <select
          id="billProductBillProviderId"
          value={draft.billProductBillProviderId}
          onChange={(e) => setDraft((p) => ({ ...p, billProductBillProviderId: e.target.value }))}
        >
          <option value="">Select mapping</option>
          {mappings.map((m) => (
            <option key={m.id} value={m.id}>
              {(m.billProductName || 'Product')} / {(m.billProviderName || 'Provider')} {m.id ? `(#${m.id})` : ''}
            </option>
          ))}
        </select>
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
        <label htmlFor="displayName">Display name</label>
        <input id="displayName" value={draft.displayName} onChange={(e) => setDraft((p) => ({ ...p, displayName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="price">Price</label>
        <input id="price" type="number" value={draft.price} onChange={(e) => setDraft((p) => ({ ...p, price: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="currency">Currency</label>
        <input id="currency" value={draft.currency} onChange={(e) => setDraft((p) => ({ ...p, currency: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="ourPriceInUsd">Our price (USD)</label>
        <input id="ourPriceInUsd" type="number" value={draft.ourPriceInUsd} onChange={(e) => setDraft((p) => ({ ...p, ourPriceInUsd: e.target.value }))} />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Product/Provider Options</div>
          <div style={{ color: 'var(--muted)' }}>Manage options linked to product-provider mapping.</div>
        </div>
        <Link href="/dashboard/bills" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Bills hub
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
          Add option
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No options found" />

      {showCreate && (
        <Modal title="Add option" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
              Cancel
            </button>
            <button type="button" onClick={handleCreate} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#22c55e', color: '#fff' }}>
              Create
            </button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit option ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
              Cancel
            </button>
            <button type="button" onClick={handleUpdate} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#f97316', color: '#fff' }}>
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
              { label: 'Name', value: selected?.name },
              { label: 'Display', value: selected?.displayName },
              { label: 'Prod/Prov ID', value: selected?.billProductBillProviderId },
              { label: 'Price', value: `${selected?.price ?? ''} ${selected?.currency ?? ''}`.trim() },
              { label: 'Our price (USD)', value: selected?.ourPriceInUsd ? `${selected.ourPriceInUsd} $` : '—' },
              { label: 'External ref', value: selected?.externalReference },
              { label: 'Created', value: selected?.createdAt },
              { label: 'Updated', value: selected?.updatedAt }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete option <strong>{confirmDelete.displayName || confirmDelete.name || confirmDelete.id}</strong>? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
              Cancel
            </button>
            <button type="button" onClick={handleDelete} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#b91c1c', color: '#fff' }}>
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
