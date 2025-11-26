'use client';

'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

const kpiConfig = [
  { key: 'totalAccounts', label: 'Accounts', accent: 'var(--accent)' },
  { key: 'totalLoans', label: 'Loans', accent: 'var(--warning)' },
  { key: 'totalApprovedLoans', label: 'Approved', accent: 'var(--success)' },
  { key: 'totalRejectedLoans', label: 'Rejected', accent: 'var(--danger)' },
  { key: 'totalTransactions', label: 'Transactions', accent: 'var(--accent)' },
  { key: 'totalPendingKyc', label: 'Pending KYC', accent: 'var(--warning)' }
];

const mockCourses = [
  { id: 1, name: 'Collections Ops', category: 'Ops', duration: '6h', price: '$0', status: 'Active' },
  { id: 2, name: 'Risk Playbook', category: 'Risk', duration: '4h', price: '$0', status: 'Active' },
  { id: 3, name: 'Compliance 101', category: 'Compliance', duration: '3h', price: '$0', status: 'Draft' }
];

export default function DashboardPage() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getReport().then(setReport).catch((err) => setError(err.message));
  }, []);

  const kpis = useMemo(() => kpiConfig.map((kpi) => ({
    ...kpi,
    value: report?.[kpi.key] ?? '—'
  })), [report]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        {kpis.map((kpi) => (
          <div key={kpi.key} className="card" style={{ gap: '0.4rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{kpi.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: kpi.accent }}>{kpi.value}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Since last week</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div className="card" style={{ minHeight: '260px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 700 }}>Performance</div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <span className="pill" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>This Week</span>
              <span className="pill" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>Last Week</span>
            </div>
          </div>
          <div style={{
            height: '200px',
            background: 'linear-gradient(180deg, rgba(37,99,235,0.15), rgba(37,99,235,0))',
            borderRadius: '12px',
            border: `1px dashed var(--border)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--muted)'
          }}>
            Area chart placeholder
          </div>
        </div>
        <div className="card" style={{ display: 'grid', gap: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>Upcoming Session</div>
            <span className="pill" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--danger)' }}>Live</span>
          </div>
          <div style={{ display: 'grid', gap: '0.35rem', color: 'var(--muted)', fontSize: '14px' }}>
            <div>🗓️ Today, 3:00 PM</div>
            <div>⏱️ 45 minutes</div>
            <div>👤 Host: Ops Team</div>
          </div>
          <button
            type="button"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Join session
          </button>
          <div style={{
            height: '120px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--accent-soft), rgba(37,99,235,0.05))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--muted)'
          }}
          >
            Illustration
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <div style={{ fontWeight: 700 }}>All Courses</div>
            <button type="button" style={{ padding: '0.55rem 0.85rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
              Add course
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ color: 'var(--muted)' }}>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.35rem' }}>#</th>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.35rem' }}>Name</th>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.35rem' }}>Category</th>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.35rem' }}>Duration</th>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.35rem' }}>Price</th>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.35rem' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '0.55rem 0.35rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {mockCourses.map((course) => (
                <tr key={course.id} style={{ borderBottom: `1px solid var(--border)` }}>
                  <td style={{ padding: '0.55rem 0.35rem' }}>{course.id}</td>
                  <td style={{ padding: '0.55rem 0.35rem' }}>{course.name}</td>
                  <td style={{ padding: '0.55rem 0.35rem' }}>{course.category}</td>
                  <td style={{ padding: '0.55rem 0.35rem' }}>{course.duration}</td>
                  <td style={{ padding: '0.55rem 0.35rem' }}>{course.price}</td>
                  <td style={{ padding: '0.55rem 0.35rem' }}>
                    <span className="pill" style={{ background: course.status === 'Active' ? 'rgba(22,163,74,0.1)' : 'rgba(249,115,22,0.12)', color: course.status === 'Active' ? 'var(--success)' : 'var(--warning)' }}>
                      {course.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.55rem 0.35rem' }}>
                    <button type="button" style={{ padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card" style={{ minHeight: '260px' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.6rem' }}>Course Schedule</div>
          <div style={{
            height: '200px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(22,163,74,0.12), rgba(37,99,235,0.12))',
            border: `1px dashed var(--border)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--muted)'
          }}>
            Stacked bars placeholder
          </div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ color: 'var(--danger)', fontWeight: 600 }}>
          {error}
        </div>
      )}
    </div>
  );
}
