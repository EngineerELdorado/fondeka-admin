'use client';

import { useEffect, useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

export default function LoansPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [loanType, setLoanType] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [decisionPayload, setDecisionPayload] = useState('{\n  "note": "Processed via admin UI"\n}');

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (loanType) params.set('loanType', loanType);
    if (status) params.set('applicationStatus', status);
    api.listLoans(params)
      .then((data) => setRows(data.content || []))
      .catch((err) => setError(err.message));
  }, [page, size, loanType, status]);

  const parsePayload = () => {
    try {
      return JSON.parse(decisionPayload || '{}');
    } catch {
      throw new Error('Invalid JSON payload for decision.');
    }
  };

  const handleDecision = async (id, action) => {
    setError(null);
    setInfo(null);
    try {
      const payload = parsePayload();
      if (action === 'approve') {
        await api.approveLoan(id, payload);
        setInfo(`Approved loan ${id}.`);
      } else {
        await api.rejectLoan(id, payload);
        setInfo(`Rejected loan ${id}.`);
      }
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (loanType) params.set('loanType', loanType);
      if (status) params.set('applicationStatus', status);
      api.listLoans(params).then((data) => setRows(data.content || [])).catch(() => {});
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 600 }}>{info}</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontWeight: 700 }}>Decision payload (JSON)</div>
        <textarea rows={6} value={decisionPayload} onChange={(e) => setDecisionPayload(e.target.value)} />
        <div style={{ color: '#6b7280', fontSize: '13px' }}>Used for Approve/Reject actions on loans.</div>
      </div>

      <DataTable
        columns={[
          { key: 'id', label: 'ID' },
          { key: 'borrowerName', label: 'Borrower' },
          { key: 'loanType', label: 'Type' },
          { key: 'applicationStatus', label: 'Status' },
          { key: 'createdDate', label: 'Created' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => handleDecision(row.id, 'approve')}>Approve</button>
                <button type="button" onClick={() => handleDecision(row.id, 'reject')} style={{ color: '#b91c1c' }}>Reject</button>
              </div>
            )
          }
        ]}
        rows={rows}
        emptyLabel="No loans found"
      />
    </div>
  );
}
