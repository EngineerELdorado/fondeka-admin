'use client';

import { useEffect, useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

export default function TransactionsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [reference, setReference] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [finalizePayload, setFinalizePayload] = useState('{\n  "note": "Handled via admin UI"\n}');

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (reference) params.set('reference', reference);
    if (status) params.set('status', status);
    api.listTransactions(params)
      .then((data) => setRows(data.content || []))
      .catch((err) => setError(err.message));
  }, [page, size, reference, status]);

  const parsePayload = () => {
    try {
      return JSON.parse(finalizePayload || '{}');
    } catch {
      throw new Error('Invalid JSON payload for transaction action.');
    }
  };

  const handleAction = async (id, action) => {
    setError(null);
    setInfo(null);
    try {
      const payload = parsePayload();
      if (action === 'approve') {
        await api.approveTransaction(id, payload);
        setInfo(`Approved transaction ${id}.`);
      } else {
        await api.rejectTransaction(id, payload);
        setInfo(`Rejected transaction ${id}.`);
      }
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (reference) params.set('reference', reference);
      if (status) params.set('status', status);
      api.listTransactions(params).then((data) => setRows(data.content || [])).catch(() => {});
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 600 }}>{info}</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontWeight: 700 }}>Finalize payload (JSON)</div>
        <textarea rows={6} value={finalizePayload} onChange={(e) => setFinalizePayload(e.target.value)} />
        <div style={{ color: '#6b7280', fontSize: '13px' }}>Used for Approve/Reject actions on transactions.</div>
      </div>

      <DataTable
        columns={[
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
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => handleAction(row.id, 'approve')}>Approve</button>
                <button type="button" onClick={() => handleAction(row.id, 'reject')} style={{ color: '#b91c1c' }}>Reject</button>
              </div>
            )
          }
        ]}
        rows={rows}
        emptyLabel="No transactions found"
      />
    </div>
  );
}
