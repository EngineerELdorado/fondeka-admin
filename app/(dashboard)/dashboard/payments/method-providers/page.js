'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = { paymentMethodId: '', paymentProviderId: '', rank: '', active: true };

const toPayload = (state) => ({
  paymentMethodId: Number(state.paymentMethodId) || 0,
  paymentProviderId: Number(state.paymentProviderId) || 0,
  rank: state.rank === '' ? null : Number(state.rank),
  active: Boolean(state.active)
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

export default function MethodProvidersPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [methods, setMethods] = useState([]);
  const [providers, setProviders] = useState([]);
  const [arrangeBy, setArrangeBy] = useState('id');
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
      const res = await api.paymentMethodPaymentProviders.list(params);
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
    const fetchOptions = async () => {
      try {
        const [pmRes, provRes] = await Promise.all([
          api.paymentMethods.list(new URLSearchParams({ page: '0', size: '100' })),
          api.paymentProviders.list(new URLSearchParams({ page: '0', size: '100' }))
        ]);
        const pmList = Array.isArray(pmRes) ? pmRes : pmRes?.content || [];
        const provList = Array.isArray(provRes) ? provRes : provRes?.content || [];
        setMethods(pmList);
        setProviders(provList);
      } catch {
        // ignore silently for options
      }
    };
    fetchOptions();
  }, []);

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'paymentMethodName', label: 'Method' },
    { key: 'paymentProviderName', label: 'Provider' },
    {
      key: 'countryName',
      label: 'Country',
      render: (row) => row.countryName || 'GLOBAL'
    },
    { key: 'rank', label: 'Rank' },
    { key: 'active', label: 'Active' },
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

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    if (arrangeBy === 'method') {
      arr.sort((a, b) => (a.paymentMethodName || '').localeCompare(b.paymentMethodName || ''));
    } else if (arrangeBy === 'provider') {
      arr.sort((a, b) => (a.paymentProviderName || '').localeCompare(b.paymentProviderName || ''));
    } else if (arrangeBy === 'country') {
      arr.sort((a, b) => (a.countryName || 'GLOBAL').localeCompare(b.countryName || 'GLOBAL'));
    }
    return arr;
  }, [rows, arrangeBy]);

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      paymentMethodId: row.paymentMethodId ?? '',
      paymentProviderId: row.paymentProviderId ?? '',
      rank: row.rank ?? '',
      active: Boolean(row.active)
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
      await api.paymentMethodPaymentProviders.create(toPayload(draft));
      setInfo('Created method/provider link.');
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
      await api.paymentMethodPaymentProviders.update(selected.id, toPayload(draft));
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
      await api.paymentMethodPaymentProviders.remove(id);
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
        <label htmlFor="paymentMethodId">Payment Method</label>
        <select
          id="paymentMethodId"
          value={draft.paymentMethodId}
          onChange={(e) => setDraft((p) => ({ ...p, paymentMethodId: e.target.value }))}
        >
          <option value="">Select method</option>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name || m.displayName || m.id}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="paymentProviderId">Payment Provider</label>
        <select
          id="paymentProviderId"
          value={draft.paymentProviderId}
          onChange={(e) => setDraft((p) => ({ ...p, paymentProviderId: e.target.value }))}
        >
          <option value="">Select provider</option>
          {providers.map((prov) => (
            <option key={prov.id} value={prov.id}>
              {prov.name || prov.displayName || prov.id}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rank">Rank</label>
        <input id="rank" type="number" value={draft.rank} onChange={(e) => setDraft((p) => ({ ...p, rank: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="active" type="checkbox" checked={draft.active} onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))} />
        <label htmlFor="active">Active</label>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Payment Method ↔ Provider</div>
          <div style={{ color: 'var(--muted)' }}>Map methods to providers with rank/active.</div>
        </div>
        <Link href="/dashboard/payments" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Payments hub
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
          <label htmlFor="arrangeBy">Arrange by</label>
          <select id="arrangeBy" value={arrangeBy} onChange={(e) => setArrangeBy(e.target.value)}>
            <option value="id">Default</option>
            <option value="method">Payment Method</option>
            <option value="provider">Payment Provider</option>
            <option value="country">Country</option>
          </select>
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

      <DataTable columns={columns} rows={sortedRows} emptyLabel="No links found" />

      {showCreate && (
        <Modal title="Add method/provider link" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit link ${selected?.id}`} onClose={() => setShowEdit(false)}>
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
              { label: 'Method', value: selected?.paymentMethodName || selected?.paymentMethodId },
              { label: 'Provider', value: selected?.paymentProviderName || selected?.paymentProviderId },
              { label: 'Country', value: selected?.countryName || 'GLOBAL' },
              { label: 'Rank', value: selected?.rank },
              { label: 'Active', value: selected?.active ? 'Yes' : 'No' },
              { label: 'Created', value: selected?.createdAt },
              { label: 'Updated', value: selected?.updatedAt }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete link <strong>{confirmDelete.paymentMethodName || confirmDelete.paymentMethodId}</strong> ↔ <strong>{confirmDelete.paymentProviderName || confirmDelete.paymentProviderId}</strong>? This cannot be undone.
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
