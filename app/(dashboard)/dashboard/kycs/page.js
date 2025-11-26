'use client';

import { useEffect, useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

export default function KycsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [status, setStatus] = useState('PENDING');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), size: String(size), status });
    api.listKycs(params)
      .then((data) => setRows(data.content || []))
      .catch((err) => setError(err.message));
  }, [page, size, status]);

  const updateStatus = async (id, nextStatus) => {
    setError(null);
    setInfo(null);
    try {
      await api.updateKyc(id, { status: nextStatus });
      setInfo(`Updated KYC ${id} → ${nextStatus}`);
      const params = new URLSearchParams({ page: String(page), size: String(size), status });
      api.listKycs(params).then((data) => setRows(data.content || [])).catch(() => {});
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="status">Status</label>
          <input id="status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="PENDING" />
        </div>
        <div>
          <label htmlFor="kycPage">Page</label>
          <input id="kycPage" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="kycSize">Size</label>
          <input id="kycSize" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 600 }}>{info}</div>}

      <DataTable
        columns={[
          { key: 'id', label: 'ID' },
          { key: 'userEmail', label: 'User' },
          { key: 'status', label: 'Status' },
          { key: 'submittedAt', label: 'Submitted' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => updateStatus(row.id, 'APPROVED')}>Approve</button>
                <button type="button" onClick={() => updateStatus(row.id, 'REJECTED')} style={{ color: '#b91c1c' }}>Reject</button>
              </div>
            )
          }
        ]}
        rows={rows}
        emptyLabel="No KYCs found"
      />
    </div>
  );
}
