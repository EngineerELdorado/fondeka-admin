'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  accountId: '',
  type: '',
  title: '',
  description: '',
  amount: '',
  minAmount: '',
  maxAmount: '',
  goalAmount: '',
  currency: '',
  allowPartial: false,
  feeInclusion: '',
  approvalStatus: '',
  lifecycle: '',
  activationAt: '',
  expiresAt: ''
};

const toPayload = (state) => ({
  accountId: Number(state.accountId) || 0,
  type: state.type,
  title: state.title || null,
  description: state.description || null,
  amount: state.amount === '' ? null : Number(state.amount),
  minAmount: state.minAmount === '' ? null : Number(state.minAmount),
  maxAmount: state.maxAmount === '' ? null : Number(state.maxAmount),
  goalAmount: state.goalAmount === '' ? null : Number(state.goalAmount),
  currency: state.currency,
  allowPartial: Boolean(state.allowPartial),
  feeInclusion: state.feeInclusion || null,
  approvalStatus: state.approvalStatus || null,
  lifecycle: state.lifecycle || null,
  activationAt: state.activationAt || null,
  expiresAt: state.expiresAt || null
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

export default function PaymentRequestsPage() {
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
      const res = await api.paymentRequests.list(params);
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

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'accountId', label: 'Account ID' },
    { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Amount' },
    { key: 'currency', label: 'Currency' },
    { key: 'lifecycle', label: 'Lifecycle' },
    { key: 'approvalStatus', label: 'Approval' },
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
      accountId: row.accountId ?? '',
      type: row.type ?? '',
      title: row.title ?? '',
      description: row.description ?? '',
      amount: row.amount ?? '',
      minAmount: row.minAmount ?? '',
      maxAmount: row.maxAmount ?? '',
      goalAmount: row.goalAmount ?? '',
      currency: row.currency ?? '',
      allowPartial: Boolean(row.allowPartial),
      feeInclusion: row.feeInclusion ?? '',
      approvalStatus: row.approvalStatus ?? '',
      lifecycle: row.lifecycle ?? '',
      activationAt: row.activationAt ?? '',
      expiresAt: row.expiresAt ?? ''
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
      await api.paymentRequests.create(toPayload(draft));
      setInfo('Created payment request.');
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
      await api.paymentRequests.update(selected.id, toPayload(draft));
      setInfo(`Updated payment request ${selected.id}.`);
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
      await api.paymentRequests.remove(id);
      setInfo(`Deleted payment request ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="accountId">Account ID</label>
        <input id="accountId" type="number" value={draft.accountId} onChange={(e) => setDraft((p) => ({ ...p, accountId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="type">Type</label>
        <input id="type" value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))} placeholder="QUICK_CHARGE / INVOICE / DONATION" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="title">Title</label>
        <input id="title" value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="description">Description</label>
        <input id="description" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="amount">Amount</label>
        <input id="amount" type="number" value={draft.amount} onChange={(e) => setDraft((p) => ({ ...p, amount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="minAmount">Min amount</label>
        <input id="minAmount" type="number" value={draft.minAmount} onChange={(e) => setDraft((p) => ({ ...p, minAmount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="maxAmount">Max amount</label>
        <input id="maxAmount" type="number" value={draft.maxAmount} onChange={(e) => setDraft((p) => ({ ...p, maxAmount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="goalAmount">Goal amount</label>
        <input id="goalAmount" type="number" value={draft.goalAmount} onChange={(e) => setDraft((p) => ({ ...p, goalAmount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="currency">Currency</label>
        <input id="currency" value={draft.currency} onChange={(e) => setDraft((p) => ({ ...p, currency: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="allowPartial" type="checkbox" checked={draft.allowPartial} onChange={(e) => setDraft((p) => ({ ...p, allowPartial: e.target.checked }))} />
        <label htmlFor="allowPartial">Allow partial</label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="feeInclusion">Fee inclusion</label>
        <input id="feeInclusion" value={draft.feeInclusion} onChange={(e) => setDraft((p) => ({ ...p, feeInclusion: e.target.value }))} placeholder="ON_TOP / ABSORBED" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="approvalStatus">Approval</label>
        <input id="approvalStatus" value={draft.approvalStatus} onChange={(e) => setDraft((p) => ({ ...p, approvalStatus: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="lifecycle">Lifecycle</label>
        <input id="lifecycle" value={draft.lifecycle} onChange={(e) => setDraft((p) => ({ ...p, lifecycle: e.target.value }))} placeholder="DRAFT / ACTIVE / ..." />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="activationAt">Activation at</label>
        <input id="activationAt" value={draft.activationAt} onChange={(e) => setDraft((p) => ({ ...p, activationAt: e.target.value }))} placeholder="Timestamp" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="expiresAt">Expires at</label>
        <input id="expiresAt" value={draft.expiresAt} onChange={(e) => setDraft((p) => ({ ...p, expiresAt: e.target.value }))} placeholder="Timestamp" />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Payment Requests</div>
          <div style={{ color: 'var(--muted)' }}>Create and manage payment requests.</div>
        </div>
        <Link href="/dashboard/payment-requests" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Payment Requests hub
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
          Add payment request
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel="No payment requests found" />

      {showCreate && (
        <Modal title="Add payment request" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit payment request ${selected?.id}`} onClose={() => setShowEdit(false)}>
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
              { label: 'Account ID', value: selected?.accountId },
              { label: 'Type', value: selected?.type },
              { label: 'Title', value: selected?.title },
              { label: 'Description', value: selected?.description },
              { label: 'Amount', value: selected?.amount },
              { label: 'Min amount', value: selected?.minAmount },
              { label: 'Max amount', value: selected?.maxAmount },
              { label: 'Goal amount', value: selected?.goalAmount },
              { label: 'Currency', value: selected?.currency },
              { label: 'Allow partial', value: String(selected?.allowPartial) },
              { label: 'Fee inclusion', value: selected?.feeInclusion },
              { label: 'Approval status', value: selected?.approvalStatus },
              { label: 'Lifecycle', value: selected?.lifecycle },
              { label: 'Activation at', value: selected?.activationAt },
              { label: 'Expires at', value: selected?.expiresAt }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete payment request <strong>{confirmDelete.title || confirmDelete.id}</strong>? This cannot be undone.
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
