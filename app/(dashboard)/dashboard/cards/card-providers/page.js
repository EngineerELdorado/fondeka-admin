'use client';

import { NonRegulatorContent, PresentationLink as Link } from '@/components/RegulatorPresentation';

import { regulatorVisibleFields } from '@/lib/regulator-presentation';

import { useAuth } from '@/contexts/AuthContext';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = { name: '', active: true, rank: '', maxActiveCardsPerCardHolder: '' };

const toPayload = (state) => {
  const maxActiveCardsPerCardHolder =
    state.maxActiveCardsPerCardHolder === '' || state.maxActiveCardsPerCardHolder === null || state.maxActiveCardsPerCardHolder === undefined
      ? null
      : Number(state.maxActiveCardsPerCardHolder);
  if (
    maxActiveCardsPerCardHolder !== null &&
    (!Number.isInteger(maxActiveCardsPerCardHolder) || maxActiveCardsPerCardHolder < 0)
  ) {
    throw new Error('Max active cards per cardholder must be empty, 0, or a positive integer.');
  }

  return {
    name: state.name,
    active: Boolean(state.active),
    rank: state.rank === '' ? null : Number(state.rank),
    maxActiveCardsPerCardHolder
  };
};

const formatMaxActiveCardsPerCardHolder = (value) =>
  value === null || value === undefined || Number(value) === 0 ? 'Unlimited' : value;

const formatMoney = (value, currency = 'USD') => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value ?? '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ''}`.trim();
  }
};

const formatFetchedAt = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

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

const DetailGrid = ({ rows }) => { const { enableRegulatorMode } = useAuth(); return (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {regulatorVisibleFields(rows, enableRegulatorMode).map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700 }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>); };

export default function CardProvidersPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [bridgecardBalance, setBridgecardBalance] = useState(null);
  const [bridgecardBalanceLoading, setBridgecardBalanceLoading] = useState(false);
  const [bridgecardBalanceError, setBridgecardBalanceError] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.cardProviders.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBridgecardBalance = async () => {
    setBridgecardBalanceLoading(true);
    setBridgecardBalanceError(null);
    try {
      const res = await api.cardProviders.bridgecardIssuingWalletBalance();
      setBridgecardBalance(res || null);
    } catch (err) {
      setBridgecardBalanceError(err?.message || 'Failed to fetch Bridgecard issuing balance.');
    } finally {
      setBridgecardBalanceLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchBridgecardBalance();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'rank', label: 'Rank' },
    {
      key: 'maxActiveCardsPerCardHolder',
      label: 'Max active cards/cardholder',
      render: (row) => formatMaxActiveCardsPerCardHolder(row.maxActiveCardsPerCardHolder)
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
      name: row.name ?? '',
      active: Boolean(row.active),
      rank: row.rank ?? '',
      maxActiveCardsPerCardHolder: row.maxActiveCardsPerCardHolder ?? ''
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
      await api.cardProviders.create(toPayload(draft));
      setInfo('Created card provider.');
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
      await api.cardProviders.update(selected.id, toPayload(draft));
      setInfo(`Updated card provider ${selected.id}.`);
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
      await api.cardProviders.remove(id);
      setInfo(`Deleted card provider ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="name">Name</label>
        <input id="name" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rank">Rank</label>
        <input id="rank" type="number" value={draft.rank} onChange={(e) => setDraft((p) => ({ ...p, rank: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="maxActiveCardsPerCardHolder">Max active cards per cardholder</label>
        <input
          id="maxActiveCardsPerCardHolder"
          type="number"
          min={0}
          step={1}
          value={draft.maxActiveCardsPerCardHolder}
          onChange={(e) => setDraft((p) => ({ ...p, maxActiveCardsPerCardHolder: e.target.value }))}
          placeholder="Unlimited"
        />
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Applies across all card products for this provider. Leave empty or set 0 for no limit.
        </div>
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
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Card Providers</div>
          <div style={{ color: 'var(--muted)' }}>Issuing providers and active state.</div>
        </div>
        <Link href="/dashboard/cards" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Cards hub
        </Link>
      </div>

      <NonRegulatorContent><div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ color: 'var(--muted)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Bridgecard issuing wallet
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800 }}>
            {bridgecardBalanceLoading && !bridgecardBalance
              ? 'Loading…'
              : formatMoney(bridgecardBalance?.balance, bridgecardBalance?.currency)}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {bridgecardBalanceError
              ? <span style={{ color: '#b91c1c', fontWeight: 700 }}>{bridgecardBalanceError}</span>
              : bridgecardBalance
                ? `Live provider balance · Fetched ${formatFetchedAt(bridgecardBalance.fetchedAt)}`
                : 'Live balance has not been fetched yet.'}
          </div>
        </div>
        <button type="button" onClick={fetchBridgecardBalance} disabled={bridgecardBalanceLoading} className="btn-primary">
          {bridgecardBalanceLoading ? 'Refreshing…' : 'Refresh balance'}
        </button>
      </div></NonRegulatorContent>

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
          Add card provider
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No card providers found" />

      {showCreate && (
        <Modal title="Add card provider" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit card provider ${selected?.id}`} onClose={() => setShowEdit(false)}>
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
              { label: 'Name', value: selected?.name },
              { label: 'Rank', value: selected?.rank },
              { label: 'Max active cards per cardholder', value: formatMaxActiveCardsPerCardHolder(selected?.maxActiveCardsPerCardHolder) },
              { label: 'Active', value: String(selected?.active) }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete card provider <strong>{confirmDelete.name || confirmDelete.id}</strong>? This cannot be undone.
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
