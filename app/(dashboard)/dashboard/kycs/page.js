'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

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

export default function KycsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [status, setStatus] = useState('PENDING');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // {row, nextStatus}

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (status) params.set('status', status);
      const res = await api.kycs.list(params);
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
  }, [page, size, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'userEmail', label: 'User' },
      { key: 'status', label: 'Status' },
      { key: 'submittedAt', label: 'Submitted' },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openDetail(row)} className="btn-neutral">
              View
            </button>
            <button type="button" onClick={() => setConfirmAction({ row, nextStatus: 'APPROVED' })} className="btn-success">
              Approve
            </button>
            <button type="button" onClick={() => setConfirmAction({ row, nextStatus: 'REJECTED' })} className="btn-danger">
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
    const { row, nextStatus } = confirmAction;
    setError(null);
    setInfo(null);
    try {
      await api.kycs.update(row.id, { status: nextStatus });
      setInfo(`Updated KYC ${row.id} → ${nextStatus}`);
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
          <div style={{ fontWeight: 800, fontSize: '20px' }}>KYCs</div>
          <div style={{ color: 'var(--muted)' }}>Review and approve/reject KYC submissions.</div>
        </div>
        <Link href="/dashboard" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Dashboard
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="status">Status</label>
          <input id="status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="PENDING" />
        </div>
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
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel="No KYCs found" />

      {showDetail && (
        <Modal title={`Details ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'User', value: selected?.userEmail },
              { label: 'Status', value: selected?.status },
              { label: 'Submitted', value: selected?.submittedAt },
              { label: 'Doc type', value: selected?.docType },
              { label: 'Country', value: selected?.countryCode },
              { label: 'Created', value: selected?.createdAt },
              { label: 'Updated', value: selected?.updatedAt }
            ]}
          />
        </Modal>
      )}

      {confirmAction && (
        <Modal title={`${confirmAction.nextStatus === 'APPROVED' ? 'Approve' : 'Reject'} KYC`} onClose={() => setConfirmAction(null)}>
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
            {confirmAction.nextStatus === 'APPROVED' ? 'Approve' : 'Reject'} KYC <strong>{confirmAction.row.id}</strong> for{' '}
            <strong>{confirmAction.row.userEmail || 'this user'}</strong>?
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmAction(null)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleAction} className={confirmAction.nextStatus === 'APPROVED' ? 'btn-success' : 'btn-danger'}>
              {confirmAction.nextStatus === 'APPROVED' ? 'Approve' : 'Reject'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
