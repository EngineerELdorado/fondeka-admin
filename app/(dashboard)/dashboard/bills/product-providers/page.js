'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = { billProductId: '', billProviderId: '', rank: '', active: true, commissionPercentage: '', cegawebProfileKey: '' };

const toPayload = (state) => ({
  billProductId: Number(state.billProductId) || 0,
  billProviderId: Number(state.billProviderId) || 0,
  rank: state.rank === '' ? null : Number(state.rank),
  commissionPercentage: state.commissionPercentage === '' ? null : Number(state.commissionPercentage),
  active: Boolean(state.active),
  cegawebProfileKey: state.cegawebProfileKey ? String(state.cegawebProfileKey) : null
});

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

export default function BillProductProvidersPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [products, setProducts] = useState([]);
  const [providers, setProviders] = useState([]);
  const [cegawebProfiles, setCegawebProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.billProductBillProviders.list(params);
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
    const loadOptions = async () => {
      try {
        const [prodRes, provRes, profilesRes] = await Promise.all([
          api.billProducts.list(new URLSearchParams({ page: '0', size: '200' })),
          api.billProviders.list(new URLSearchParams({ page: '0', size: '200' })),
          api.cegawebProfiles.list(new URLSearchParams({ page: '0', size: '200' }))
        ]);
        const prodList = Array.isArray(prodRes) ? prodRes : prodRes?.content || [];
        const provList = Array.isArray(provRes) ? provRes : provRes?.content || [];
        const profileList = Array.isArray(profilesRes) ? profilesRes : profilesRes?.content || [];
        setProducts(prodList);
        setProviders(provList);
        setCegawebProfiles(profileList);
      } catch {
        // silent fail for option loading
      }
    };
    loadOptions();
  }, []);

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'billProductName', label: 'Product' },
    { key: 'billProviderName', label: 'Provider' },
    { key: 'cegawebProfileKey', label: 'CegaWeb profile' },
    { key: 'rank', label: 'Rank' },
    {
      key: 'commissionPercentage',
      label: 'Commission (%)',
      render: (row) => (row.commissionPercentage === null || row.commissionPercentage === undefined ? '—' : row.commissionPercentage)
    },
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

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      billProductId: row.billProductId ?? '',
      billProviderId: row.billProviderId ?? '',
      rank: row.rank ?? '',
      commissionPercentage: row.commissionPercentage ?? '',
      active: Boolean(row.active),
      cegawebProfileKey: row.cegawebProfileKey ?? ''
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
      await api.billProductBillProviders.create(toPayload(draft));
      setInfo('Created mapping.');
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
      await api.billProductBillProviders.update(selected.id, toPayload(draft));
      setInfo(`Updated mapping ${selected.id}.`);
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
      await api.billProductBillProviders.remove(id);
      setInfo(`Deleted mapping ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="billProductId">Bill Product</label>
        <select
          id="billProductId"
          value={draft.billProductId}
          onChange={(e) => setDraft((prev) => ({ ...prev, billProductId: e.target.value }))}
        >
          <option value="">Select product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName || p.name || p.id}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="billProviderId">Bill Provider</label>
        <select
          id="billProviderId"
          value={draft.billProviderId}
          onChange={(e) => setDraft((prev) => ({ ...prev, billProviderId: e.target.value }))}
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
        <label htmlFor="cegawebProfileKey">CegaWeb profile</label>
        <select
          id="cegawebProfileKey"
          value={draft.cegawebProfileKey}
          onChange={(e) => setDraft((prev) => ({ ...prev, cegawebProfileKey: e.target.value }))}
        >
          <option value="">Inherit provider</option>
          {cegawebProfiles.map((profile) => (
            <option key={profile.id ?? profile.profileKey} value={profile.profileKey}>
              {profile.profileKey}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rank">Rank</label>
        <input
          id="rank"
          type="number"
          value={draft.rank}
          onChange={(e) => setDraft((prev) => ({ ...prev, rank: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="commissionPercentage">Commission (%)</label>
        <input
          id="commissionPercentage"
          type="number"
          step="0.01"
          value={draft.commissionPercentage}
          onChange={(e) => setDraft((prev) => ({ ...prev, commissionPercentage: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          id="active"
          type="checkbox"
          checked={draft.active}
          onChange={(e) => setDraft((prev) => ({ ...prev, active: e.target.checked }))}
        />
        <label htmlFor="active">Active</label>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Bill Product ↔ Provider</div>
          <div style={{ color: '#6b7280' }}>Manage mapping with rank and active flag.</div>
        </div>
        <Link
          href="/dashboard/bills"
          style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid #e5e7eb', textDecoration: 'none', color: '#0f172a' }}
        >
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
          Add mapping
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No mappings found" />

      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Add mapping</div>
              <button type="button" onClick={() => setShowCreate(false)} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>×</button>
            </div>
            {renderForm()}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCreate(false)} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
                Cancel
              </button>
              <button type="button" onClick={handleCreate} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#22c55e', color: '#fff' }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Edit mapping {selected?.id}</div>
              <button type="button" onClick={() => setShowEdit(false)} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>×</button>
            </div>
            {renderForm()}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowEdit(false)} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
                Cancel
              </button>
              <button type="button" onClick={handleUpdate} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#f97316', color: '#fff' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetail && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700 }}>Details {selected?.id}</div>
              <button type="button" onClick={() => setShowDetail(false)} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>×</button>
            </div>
            <DetailGrid
              rows={[
                { label: 'ID', value: selected?.id },
                { label: 'Product', value: selected?.billProductName || selected?.billProductId },
                { label: 'Provider', value: selected?.billProviderName || selected?.billProviderId },
                { label: 'CegaWeb profile', value: selected?.cegawebProfileKey || '—' },
                { label: 'Rank', value: selected?.rank },
                { label: 'Commission (%)', value: selected?.commissionPercentage ?? '—' },
                { label: 'Active', value: selected?.active ? 'Yes' : 'No' },
                { label: 'Created at', value: selected?.createdAt },
                { label: 'Updated at', value: selected?.updatedAt }
              ]}
            />
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ gap: '0.6rem' }}>
            <div style={{ fontWeight: 800 }}>Confirm delete</div>
            <div style={{ color: 'var(--muted)' }}>
              Delete mapping for <strong>{confirmDelete.billProductName || confirmDelete.billProductId}</strong> → <strong>{confirmDelete.billProviderName || confirmDelete.billProviderId}</strong>? This cannot be undone.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => setConfirmDelete(null)} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
                Cancel
              </button>
              <button type="button" onClick={handleDelete} style={{ padding: '0.65rem 0.95rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#b91c1c', color: '#fff' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
