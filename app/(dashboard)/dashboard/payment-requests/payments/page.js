'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  paymentRequestId: '',
  paymentMethodId: '',
  status: '',
  providerTxnId: '',
  amount: '',
  currency: '',
  payerReference: '',
  payerDisplayName: '',
  payerAnonymous: false,
  failureCode: '',
  failureReason: '',
  idempotencyKey: '',
  transactionId: ''
};

const toPayload = (state) => ({
  paymentRequestId: Number(state.paymentRequestId) || 0,
  paymentMethodId: Number(state.paymentMethodId) || 0,
  status: state.status,
  providerTxnId: state.providerTxnId || null,
  amount: state.amount === '' ? null : Number(state.amount),
  currency: state.currency,
  payerReference: state.payerReference || null,
  payerDisplayName: state.payerDisplayName || null,
  payerAnonymous: Boolean(state.payerAnonymous),
  failureCode: state.failureCode || null,
  failureReason: state.failureReason || null,
  idempotencyKey: state.idempotencyKey,
  transactionId: state.transactionId === '' ? null : Number(state.transactionId)
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

export default function PaymentRequestPaymentsPage() {
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

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.paymentRequestPayments.list(params);
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
      { key: 'paymentRequestId', label: 'Request ID' },
      { key: 'paymentMethodId', label: 'Method ID' },
      { key: 'amount', label: 'Amount' },
      { key: 'currency', label: 'Currency' },
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
      paymentRequestId: row.paymentRequestId ?? '',
      paymentMethodId: row.paymentMethodId ?? '',
      status: row.status ?? '',
      providerTxnId: row.providerTxnId ?? '',
      amount: row.amount ?? '',
      currency: row.currency ?? '',
      payerReference: row.payerReference ?? '',
      payerDisplayName: row.payerDisplayName ?? '',
      payerAnonymous: Boolean(row.payerAnonymous),
      failureCode: row.failureCode ?? '',
      failureReason: row.failureReason ?? '',
      idempotencyKey: row.idempotencyKey ?? '',
      transactionId: row.transactionId ?? ''
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
      await api.paymentRequestPayments.create(toPayload(draft));
      setInfo('Created payment request payment.');
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
      await api.paymentRequestPayments.update(selected.id, toPayload(draft));
      setInfo(`Updated payment ${selected.id}.`);
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
      await api.paymentRequestPayments.remove(id);
      setInfo(`Deleted payment ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="paymentRequestId">Payment request ID</label>
        <input id="paymentRequestId" type="number" value={draft.paymentRequestId} onChange={(e) => setDraft((p) => ({ ...p, paymentRequestId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="paymentMethodId">Payment method ID</label>
        <input id="paymentMethodId" type="number" value={draft.paymentMethodId} onChange={(e) => setDraft((p) => ({ ...p, paymentMethodId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="status">Status</label>
        <input id="status" value={draft.status} onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))} placeholder="INITIATED / SUCCEEDED / ..." />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="providerTxnId">Provider Txn ID</label>
        <input id="providerTxnId" value={draft.providerTxnId} onChange={(e) => setDraft((p) => ({ ...p, providerTxnId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="amount">Amount</label>
        <input id="amount" type="number" value={draft.amount} onChange={(e) => setDraft((p) => ({ ...p, amount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="currency">Currency</label>
        <input id="currency" value={draft.currency} onChange={(e) => setDraft((p) => ({ ...p, currency: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="payerReference">Payer reference</label>
        <input id="payerReference" value={draft.payerReference} onChange={(e) => setDraft((p) => ({ ...p, payerReference: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="payerDisplayName">Payer display name</label>
        <input id="payerDisplayName" value={draft.payerDisplayName} onChange={(e) => setDraft((p) => ({ ...p, payerDisplayName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="payerAnonymous" type="checkbox" checked={draft.payerAnonymous} onChange={(e) => setDraft((p) => ({ ...p, payerAnonymous: e.target.checked }))} />
        <label htmlFor="payerAnonymous">Payer anonymous</label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="failureCode">Failure code</label>
        <input id="failureCode" value={draft.failureCode} onChange={(e) => setDraft((p) => ({ ...p, failureCode: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="failureReason">Failure reason</label>
        <input id="failureReason" value={draft.failureReason} onChange={(e) => setDraft((p) => ({ ...p, failureReason: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="idempotencyKey">Idempotency key</label>
        <input id="idempotencyKey" value={draft.idempotencyKey} onChange={(e) => setDraft((p) => ({ ...p, idempotencyKey: e.target.value }))} />
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
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Payment Request Payments</div>
          <div style={{ color: 'var(--muted)' }}>Payments made toward payment requests.</div>
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
          Add payment
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

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No payment request payments found" />

      {showCreate && (
        <Modal title="Add payment request payment" onClose={() => setShowCreate(false)}>
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
        <Modal title={`Edit payment ${selected?.id}`} onClose={() => setShowEdit(false)}>
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
              { label: 'Payment request ID', value: selected?.paymentRequestId },
              { label: 'Payment method ID', value: selected?.paymentMethodId },
              { label: 'Status', value: selected?.status },
              { label: 'Provider Txn ID', value: selected?.providerTxnId },
              { label: 'Amount', value: selected?.amount },
              { label: 'Currency', value: selected?.currency },
              { label: 'Payer reference', value: selected?.payerReference },
              { label: 'Payer name', value: selected?.payerDisplayName },
              { label: 'Payer anonymous', value: String(selected?.payerAnonymous) },
              { label: 'Failure code', value: selected?.failureCode },
              { label: 'Failure reason', value: selected?.failureReason },
              { label: 'Idempotency key', value: selected?.idempotencyKey },
              { label: 'Transaction ID', value: selected?.transactionId }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete payment <strong>{confirmDelete.id}</strong>? This cannot be undone.
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
