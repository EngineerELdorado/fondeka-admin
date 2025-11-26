'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { StatCard } from '@/components/StatCard';

export default function ReportPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const fetchReport = () => {
    const start = startDate ? Number(new Date(startDate)) : undefined;
    const end = endDate ? Number(new Date(endDate)) : undefined;
    api.getReport(start, end)
      .then(setReport)
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div>
          <label htmlFor="start">Start date</label>
          <input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="end">End date</label>
          <input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div style={{ alignSelf: 'end' }}>
          <button
            type="button"
            onClick={fetchReport}
            style={{
              width: '100%',
              padding: '0.8rem 1rem',
              border: 'none',
              borderRadius: '10px',
              background: 'var(--fondeka-green)',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 600 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <StatCard title="Accounts" value={report?.totalAccounts ?? '—'} />
        <StatCard title="Loans" value={report?.totalLoans ?? '—'} />
        <StatCard title="Approved loans" value={report?.totalApprovedLoans ?? '—'} />
        <StatCard title="Rejected loans" value={report?.totalRejectedLoans ?? '—'} />
        <StatCard title="Transactions" value={report?.totalTransactions ?? '—'} />
        <StatCard title="Pending KYC" value={report?.totalPendingKyc ?? '—'} />
      </div>
    </div>
  );
}
