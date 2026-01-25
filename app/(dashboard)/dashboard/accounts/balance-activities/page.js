'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = { accountBalanceId: '', transactionId: '', previousBalance: '', newBalance: '', delta: '', activityType: '' };
const emptyFilters = { transactionReference: '', userEmail: '' };

const toPayload = (state) => ({
  accountBalanceId: Number(state.accountBalanceId) || 0,
  transactionId: state.transactionId === '' ? null : Number(state.transactionId),
  previousBalance: state.previousBalance === '' ? null : Number(state.previousBalance),
  newBalance: state.newBalance === '' ? null : Number(state.newBalance),
  delta: state.delta === '' ? null : Number(state.delta),
  activityType: state.activityType
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

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function AccountBalanceActivitiesPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
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
      if (appliedFilters.transactionReference) params.set('transactionReference', appliedFilters.transactionReference);
      if (appliedFilters.userEmail) params.set('userEmail', appliedFilters.userEmail);
      const res = await api.accountBalanceActivities.list(params);
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
    { key: 'userFullName', label: 'User' },
    { key: 'activityType', label: 'Type' },
    { key: 'delta', label: 'Delta', render: (row) => formatCurrency(row.delta) },
    { key: 'previousBalance', label: 'Previous balance', render: (row) => formatCurrency(row.previousBalance) },
    { key: 'newBalance', label: 'New balance', render: (row) => formatCurrency(row.newBalance) },
    { key: 'transactionReference', label: 'Transaction ref' },
    { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
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
      accountBalanceId: row.accountBalanceId ?? '',
      transactionId: row.transactionId ?? '',
      previousBalance: row.previousBalance ?? '',
      newBalance: row.newBalance ?? '',
      delta: row.delta ?? '',
      activityType: row.activityType ?? ''
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
      await api.accountBalanceActivities.create(toPayload(draft));
      setInfo('Created balance activity.');
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
      await api.accountBalanceActivities.update(selected.id, toPayload(draft));
      setInfo(`Updated activity ${selected.id}.`);
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
      await api.accountBalanceActivities.remove(id);
      setInfo(`Deleted activity ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
    setPage(0);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(0);
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="accountBalanceId">Balance ID</label>
        <input id="accountBalanceId" type="number" value={draft.accountBalanceId} onChange={(e) => setDraft((p) => ({ ...p, accountBalanceId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="activityType">Activity type</label>
        <input id="activityType" value={draft.activityType} onChange={(e) => setDraft((p) => ({ ...p, activityType: e.target.value }))} placeholder="DEPOSIT / WITHDRAWAL" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="delta">Delta</label>
        <input id="delta" type="number" value={draft.delta} onChange={(e) => setDraft((p) => ({ ...p, delta: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="previousBalance">Previous balance</label>
        <input id="previousBalance" type="number" value={draft.previousBalance} onChange={(e) => setDraft((p) => ({ ...p, previousBalance: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="newBalance">New balance</label>
        <input id="newBalance" type="number" value={draft.newBalance} onChange={(e) => setDraft((p) => ({ ...p, newBalance: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="transactionId">Transaction ID</label>
        <input id="transactionId" type="number" value={draft.transactionId} onChange={(e) => setDraft((p) => ({ ...p, transactionId: e.target.value }))} />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Balance Activities</div>
          <div style={{ color: 'var(--muted)' }}>Track balance changes (deposit/withdrawal).</div>
        </div>
        <Link href="/dashboard/accounts" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Accounts hub
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
        <button type="button" onClick={openCreate} className="btn-success">
          Add activity
        </button>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Filters</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
            <button type="button" onClick={fetchRows} disabled={loading} className="btn-neutral btn-sm">
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
        {showFilters && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterTransactionRef">Transaction ref</label>
                <input
                  id="filterTransactionRef"
                  value={filters.transactionReference}
                  onChange={(e) => setFilters((p) => ({ ...p, transactionReference: e.target.value }))}
                  placeholder="TX123"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterUserEmail">User email</label>
                <input
                  id="filterUserEmail"
                  value={filters.userEmail}
                  onChange={(e) => setFilters((p) => ({ ...p, userEmail: e.target.value }))}
                  placeholder="user@domain.com"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={applyFilters} disabled={loading} className="btn-primary">
                {loading ? 'Applying…' : 'Apply filters'}
              </button>
              <button type="button" onClick={clearFilters} disabled={loading} className="btn-neutral">
                Clear
              </button>
              <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Filters apply to transaction reference and user email.</span>
            </div>
          </>
        )}
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel="No balance activities found" />

      {showCreate && (
        <Modal title="Add balance activity" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit activity ${selected?.id}`} onClose={() => setShowEdit(false)}>
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
              { label: 'Balance ID', value: selected?.accountBalanceId },
              { label: 'Activity type', value: selected?.activityType },
              { label: 'User', value: selected?.userFullName },
              { label: 'Delta', value: formatCurrency(selected?.delta) },
              { label: 'Previous balance', value: formatCurrency(selected?.previousBalance) },
              { label: 'New balance', value: formatCurrency(selected?.newBalance) },
              { label: 'Transaction ID', value: selected?.transactionId },
              { label: 'Transaction ref', value: selected?.transactionReference },
              { label: 'Created', value: formatDateTime(selected?.createdAt) }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete activity <strong>{confirmDelete.id}</strong>? This cannot be undone.
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
