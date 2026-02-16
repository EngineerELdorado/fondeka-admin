'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  cryptoProductId: '',
  cryptoNetworkId: '',
  rank: '',
  displayName: '',
  dailyBuyLimitUsd: '',
  dailySellLimitUsd: '',
  dailySendLimitUsd: '',
  dailyReceiveLimitUsd: '',
  dailySwapLimitUsd: '',
  active: true
};

const toPayload = (state) => ({
  cryptoProductId: Number(state.cryptoProductId) || 0,
  cryptoNetworkId: Number(state.cryptoNetworkId) || 0,
  rank: state.rank === '' ? null : Number(state.rank),
  displayName: state.displayName || null,
  dailyBuyLimitUsd: Number(state.dailyBuyLimitUsd || 0),
  dailySellLimitUsd: Number(state.dailySellLimitUsd || 0),
  dailySendLimitUsd: Number(state.dailySendLimitUsd || 0),
  dailyReceiveLimitUsd: Number(state.dailyReceiveLimitUsd || 0),
  dailySwapLimitUsd: Number(state.dailySwapLimitUsd || 0),
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

export default function CryptoProductNetworksPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [products, setProducts] = useState([]);
  const [networks, setNetworks] = useState([]);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.cryptoProductCryptoNetworks.list(params);
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
        const params = new URLSearchParams();
        params.set('page', '0');
        params.set('size', '200');
        const [prodRes, netRes] = await Promise.all([api.cryptoProducts.list(params), api.cryptoNetworks.list(params)]);
        const prodList = Array.isArray(prodRes) ? prodRes : prodRes?.content || [];
        const netList = Array.isArray(netRes) ? netRes : netRes?.content || [];
        setProducts(prodList || []);
        setNetworks(netList || []);
      } catch (err) {
        setError(err.message);
      }
    };
    loadLookups();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    {
      key: 'cryptoProductName',
      label: 'Product',
      render: (row) => (
        <div>
          {row.cryptoProductName || '—'}
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>ID: {row.cryptoProductId ?? '—'}</div>
        </div>
      )
    },
    {
      key: 'cryptoNetworkName',
      label: 'Network',
      render: (row) => (
        <div>
          {row.cryptoNetworkName || '—'}
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>ID: {row.cryptoNetworkId ?? '—'}</div>
        </div>
      )
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

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      cryptoProductId: row.cryptoProductId ?? '',
      cryptoNetworkId: row.cryptoNetworkId ?? '',
      rank: row.rank ?? '',
      displayName: row.displayName ?? '',
      dailyBuyLimitUsd: row.dailyBuyLimitUsd ?? '',
      dailySellLimitUsd: row.dailySellLimitUsd ?? '',
      dailySendLimitUsd: row.dailySendLimitUsd ?? '',
      dailyReceiveLimitUsd: row.dailyReceiveLimitUsd ?? '',
      dailySwapLimitUsd: row.dailySwapLimitUsd ?? '',
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
      await api.cryptoProductCryptoNetworks.create(toPayload(draft));
      setInfo('Created product/network mapping.');
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
      await api.cryptoProductCryptoNetworks.update(selected.id, toPayload(draft));
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
      await api.cryptoProductCryptoNetworks.remove(id);
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
        <label htmlFor="cryptoProductId">Crypto product</label>
        <select id="cryptoProductId" value={draft.cryptoProductId} onChange={(e) => setDraft((p) => ({ ...p, cryptoProductId: e.target.value }))}>
          <option value="">Select product</option>
          {products.map((prod) => (
            <option key={prod.id} value={prod.id}>
              {prod.displayName || prod.currency || `Product ${prod.id}`}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="cryptoNetworkId">Crypto network</label>
        <select id="cryptoNetworkId" value={draft.cryptoNetworkId} onChange={(e) => setDraft((p) => ({ ...p, cryptoNetworkId: e.target.value }))}>
          <option value="">Select network</option>
          {networks.map((net) => (
            <option key={net.id} value={net.id}>
              {net.name || `Network ${net.id}`}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="displayName">Display name</label>
        <input id="displayName" value={draft.displayName} onChange={(e) => setDraft((p) => ({ ...p, displayName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rank">Rank</label>
        <input id="rank" type="number" min={0} value={draft.rank} onChange={(e) => setDraft((p) => ({ ...p, rank: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="dailyBuyLimitUsd">Daily buy limit (USD)</label>
        <input
          id="dailyBuyLimitUsd"
          type="number"
          min={0}
          step="any"
          value={draft.dailyBuyLimitUsd}
          onChange={(e) => setDraft((p) => ({ ...p, dailyBuyLimitUsd: e.target.value }))}
          placeholder="0 = uses default"
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="dailySellLimitUsd">Daily sell limit (USD)</label>
        <input
          id="dailySellLimitUsd"
          type="number"
          min={0}
          step="any"
          value={draft.dailySellLimitUsd}
          onChange={(e) => setDraft((p) => ({ ...p, dailySellLimitUsd: e.target.value }))}
          placeholder="0 = uses default"
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="dailySendLimitUsd">Daily send limit (USD)</label>
        <input
          id="dailySendLimitUsd"
          type="number"
          min={0}
          step="any"
          value={draft.dailySendLimitUsd}
          onChange={(e) => setDraft((p) => ({ ...p, dailySendLimitUsd: e.target.value }))}
          placeholder="0 = uses default"
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="dailyReceiveLimitUsd">Daily receive limit (USD)</label>
        <input
          id="dailyReceiveLimitUsd"
          type="number"
          min={0}
          step="any"
          value={draft.dailyReceiveLimitUsd}
          onChange={(e) => setDraft((p) => ({ ...p, dailyReceiveLimitUsd: e.target.value }))}
          placeholder="0 = uses default"
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="dailySwapLimitUsd">Daily swap limit (USD)</label>
        <input
          id="dailySwapLimitUsd"
          type="number"
          min={0}
          step="any"
          value={draft.dailySwapLimitUsd}
          onChange={(e) => setDraft((p) => ({ ...p, dailySwapLimitUsd: e.target.value }))}
          placeholder="0 = uses default"
        />
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
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Product ↔ Network</div>
          <div style={{ color: 'var(--muted)' }}>Map crypto products to networks with rank.</div>
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
          Add mapping
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No mappings found" />

      {showCreate && (
        <Modal title="Add product/network mapping" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit mapping ${selected?.id}`} onClose={() => setShowEdit(false)}>
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
              { label: 'Crypto product ID', value: selected?.cryptoProductId },
              { label: 'Crypto product', value: selected?.cryptoProductName },
              { label: 'Crypto network ID', value: selected?.cryptoNetworkId },
              { label: 'Crypto network', value: selected?.cryptoNetworkName },
              { label: 'Display name', value: selected?.displayName },
              { label: 'Rank', value: selected?.rank },
              { label: 'Daily buy limit (USD)', value: Number(selected?.dailyBuyLimitUsd) === 0 ? 'Uses default' : selected?.dailyBuyLimitUsd },
              { label: 'Daily sell limit (USD)', value: Number(selected?.dailySellLimitUsd) === 0 ? 'Uses default' : selected?.dailySellLimitUsd },
              { label: 'Daily send limit (USD)', value: Number(selected?.dailySendLimitUsd) === 0 ? 'Uses default' : selected?.dailySendLimitUsd },
              { label: 'Daily receive limit (USD)', value: Number(selected?.dailyReceiveLimitUsd) === 0 ? 'Uses default' : selected?.dailyReceiveLimitUsd },
              { label: 'Daily swap limit (USD)', value: Number(selected?.dailySwapLimitUsd) === 0 ? 'Uses default' : selected?.dailySwapLimitUsd },
              { label: 'Active', value: String(selected?.active) }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete mapping <strong>{confirmDelete.displayName || confirmDelete.id}</strong>? This cannot be undone.
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
