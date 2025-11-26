'use client';

import { useEffect, useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

export default function AccountsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [accountNumber, setAccountNumber] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (accountNumber) params.set('accountNumber', accountNumber);
    api.listAccounts(params)
      .then((data) => setRows(data.content || []))
      .catch((err) => setError(err.message));
  }, [page, size, accountNumber]);

  const handleAml = async (id) => {
    setError(null);
    setInfo(null);
    try {
      const res = await api.checkAccountAml(id);
      setInfo(`AML check for account ${id}: ${JSON.stringify(res)}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="accountNumber">Account number</label>
          <input id="accountNumber" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
        </div>
        <div>
          <label htmlFor="page">Page</label>
          <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="size">Size</label>
          <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 600 }}>{info}</div>}

      <DataTable
        columns={[
          { key: 'id', label: 'ID' },
          { key: 'accountNumber', label: 'Account' },
          { key: 'status', label: 'Status' },
          { key: 'createdDate', label: 'Created' },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => handleAml(row.id)}>Check AML</button>
              </div>
            )
          }
        ]}
        rows={rows}
        emptyLabel="No accounts found"
      />
    </div>
  );
}
