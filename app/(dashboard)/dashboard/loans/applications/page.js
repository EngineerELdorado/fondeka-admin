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
        <button
          type="button"
          onClick={onClose}
          style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}
        >
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default function LoanApplicationsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [loanType, setLoanType] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { row, action }

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (loanType) params.set('loanType', loanType);
      if (status) params.set('applicationStatus', status);
      const res = await api.listLoans(params);
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
  }, [page, size, loanType, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'borrowerName', label: 'Borrower' },
      { key: 'loanType', label: 'Type' },
      { key: 'applicationStatus', label: 'Status' },
      { key: 'createdDate', label: 'Created' },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
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

  const handleAction = async () => {
    if (!confirmAction?.row?.id) return;
    const { row, action } = confirmAction;
    setError(null);
    setInfo(null);
    try {
      const payload = { note: 'Handled via admin dashboard' };
      if (action === 'approve') {
        await api.approveLoan(row.id, payload);
        setInfo(`Approved loan ${row.id}.`);
      } else {
        await api.rejectLoan(row.id, payload);
        setInfo(`Rejected loan ${row.id}.`);
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
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Loan Applications</div>
          <div style={{ color: 'var(--muted)' }}>Browse loan applications and take decisions.</div>
        </div>
        <Link href="/dashboard/loans" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Loans
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <div>
          <label htmlFor="loanType">Loan type</label>
          <input id="loanType" value={loanType} onChange={(e) => setLoanType(e.target.value)} placeholder="e.g. PERSONAL" />
        </div>
        <div>
          <label htmlFor="status">Status</label>
          <input id="status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="e.g. APPROVED" />
        </div>
        <div>
          <label htmlFor="loanPage">Page</label>
          <input id="loanPage" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="loanSize">Size</label>
          <input id="loanSize" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
          <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
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

      <DataTable columns={columns} rows={rows} emptyLabel="No loans found" />

      {confirmAction && (
        <Modal
          title={`${confirmAction.action === 'approve' ? 'Approve' : 'Reject'} loan ${confirmAction.row.id}`}
          onClose={() => setConfirmAction(null)}
        >
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
            Are you sure you want to {confirmAction.action} loan <strong>{confirmAction.row.id}</strong> for{' '}
            <strong>{confirmAction.row.borrowerName || 'this user'}</strong>?
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
