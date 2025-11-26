'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

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

export default function TransactionsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [reference, setReference] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [finalizePayload, setFinalizePayload] = useState('{\n  "note": "Handled via admin UI"\n}');
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // {row, action}

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (reference) params.set('reference', reference);
      if (status) params.set('status', status);
      const res = await api.transactions.list(params);
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
  }, [page, size, reference, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const parsePayload = () => {
    try {
      return finalizePayload ? JSON.parse(finalizePayload) : {};
    } catch {
      throw new Error('Invalid JSON payload for transaction action.');
    }
  };

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'reference', label: 'Reference' },
      { key: 'service', label: 'Service' },
      { key: 'balanceEffect', label: 'Effect' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Created' },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openDetail(row)} className="btn-neutral">
              View
            </button>
            <button type="button" onClick={() => setConfirmAction({ row, action: 'approve' })} className="btn-success">
              Approve
            </button>
            <button type="button" onClick={() => setConfirmAction({ row, action: 'reject' })} className="btn-danger">
              Reject
            </button>
          </div>
        )
      }
    ],
    []
  );

  const openDetail = (row) => {
    setSelected(row);
    setShowDetail(true);
    setInfo(null);
    setError(null);
  };

  const handleAction = async () => {
    if (!confirmAction?.row?.id) return;
    const { row, action } = confirmAction;
    setError(null);
    setInfo(null);
    try {
      const payload = parsePayload();
      if (action === 'approve') {
        await api.transactions.approve(row.id, payload);
        setInfo(`Approved transaction ${row.id}.`);
      } else {
        await api.transactions.reject(row.id, payload);
        setInfo(`Rejected transaction ${row.id}.`);
      }
      setConfirmAction(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Transactions</div>
          <div style={{ color: 'var(--muted)' }}>Review, approve or reject transactions.</div>
        </div>
        <Link href="/dashboard" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Dashboard
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="reference">Reference</label>
          <input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div>
          <label htmlFor="txnStatus">Status</label>
          <input id="txnStatus" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="SUCCESS" />
        </div>
        <div>
          <label htmlFor="txnPage">Page</label>
          <input id="txnPage" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="txnSize">Size</label>
          <input id="txnSize" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontWeight: 700 }}>Action payload (JSON)</div>
        <textarea rows={6} value={finalizePayload} onChange={(e) => setFinalizePayload(e.target.value)} />
        <div style={{ color: '#6b7280', fontSize: '13px' }}>Used for Approve/Reject actions on transactions.</div>
      </div>

      <DataTable columns={columns} rows={rows} emptyLabel="No transactions found" />

      {showDetail && (
        <Modal title={`Details ${selected?.reference || selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Reference', value: selected?.reference },
              { label: 'Service', value: selected?.service },
              { label: 'Effect', value: selected?.balanceEffect },
              { label: 'Status', value: selected?.status },
              { label: 'Amount', value: selected?.amount },
              { label: 'Currency', value: selected?.currency },
              { label: 'Created', value: selected?.createdAt },
              { label: 'Updated', value: selected?.updatedAt }
            ]}
          />
        </Modal>
      )}

      {confirmAction && (
        <Modal title={`${confirmAction.action === 'approve' ? 'Approve' : 'Reject'} transaction`} onClose={() => setConfirmAction(null)}>
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
            {confirmAction.action === 'approve' ? 'Approve' : 'Reject'} transaction <strong>{confirmAction.row.reference || confirmAction.row.id}</strong>?
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmAction(null)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleAction} className={confirmAction.action === 'approve' ? 'btn-success' : 'btn-danger'}>
              {confirmAction.action === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
