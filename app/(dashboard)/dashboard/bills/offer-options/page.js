'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  billProductBillProviderOfferId: '',
  billProductBillProviderOptionId: ''
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
  billProductBillProviderOfferId: Number(state.billProductBillProviderOfferId) || 0,
  billProductBillProviderOptionId: Number(state.billProductBillProviderOptionId) || 0
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

export default function OfferOptionsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [offers, setOffers] = useState([]);
  const [options, setOptions] = useState([]);
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
      const res = await api.billProductBillProviderOfferOptions.list(params);
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
    const loadLookups = async () => {
      try {
        const [offerRes, optionRes] = await Promise.all([
          api.billProductBillProviderOffers.list(new URLSearchParams({ page: '0', size: '200' })),
          api.billProductBillProviderOptions.list(new URLSearchParams({ page: '0', size: '200' }))
        ]);
        const offerList = Array.isArray(offerRes) ? offerRes : offerRes?.content || [];
        const optionList = Array.isArray(optionRes) ? optionRes : optionRes?.content || [];
        setOffers(offerList || []);
        setOptions(optionList || []);
      } catch {
        // ignore option loading failures
      }
    };
    loadLookups();
  }, []);

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'billProductBillProviderOfferName', label: 'Offer Name' },
    { key: 'billProductBillProviderOptionName', label: 'Option Name' },
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
      billProductBillProviderOfferId: row.billProductBillProviderOfferId ?? '',
      billProductBillProviderOptionId: row.billProductBillProviderOptionId ?? ''
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
      await api.billProductBillProviderOfferOptions.create(toPayload(draft));
      setInfo('Created offer option link.');
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
      await api.billProductBillProviderOfferOptions.update(selected.id, toPayload(draft));
      setInfo(`Updated link ${selected.id}.`);
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
      await api.billProductBillProviderOfferOptions.remove(id);
      setInfo(`Deleted link ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="offerId">Offer</label>
        <select
          id="offerId"
          value={draft.billProductBillProviderOfferId}
          onChange={(e) => setDraft((p) => ({ ...p, billProductBillProviderOfferId: e.target.value }))}
        >
          <option value="">Select offer</option>
          {offers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.displayName || o.name || `Offer #${o.id}`}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="optionId">Option</label>
        <select
          id="optionId"
          value={draft.billProductBillProviderOptionId}
          onChange={(e) => setDraft((p) => ({ ...p, billProductBillProviderOptionId: e.target.value }))}
        >
          <option value="">Select option</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.displayName || opt.name || `Option #${opt.id}`}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Offer ↔ Option</div>
          <div style={{ color: 'var(--muted)' }}>Link offers to provider options.</div>
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
          Add link
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No links found" />

      {showCreate && (
        <Modal title="Add offer option link" onClose={() => setShowCreate(false)}>
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
        <Modal title={`Edit link ${selected?.id}`} onClose={() => setShowEdit(false)}>
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
              { label: 'Offer', value: selected?.billProductBillProviderOfferName || selected?.billProductBillProviderOfferId },
              { label: 'Option', value: selected?.billProductBillProviderOptionName || selected?.billProductBillProviderOptionId },
              { label: 'Created', value: selected?.createdAt },
              { label: 'Updated', value: selected?.updatedAt }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete link Offer {confirmDelete.billProductBillProviderOfferId} ↔ Option {confirmDelete.billProductBillProviderOptionId}? This cannot be undone.
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
