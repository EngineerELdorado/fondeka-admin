'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { activeAudit, auditMoney, canReadRefundAudit } from '@/lib/payout-refund-audit';

export default function PayoutRefundAuditCard() {
  const { session, enableRegulatorMode } = useAuth();
  const visible = canReadRefundAudit(session) && enableRegulatorMode === false;
  const [report, setReport] = useState(null), [loaded, setLoaded] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!visible) return undefined;
    let active = true, timer;
    const load = async () => {
      try {
        const response = await api.payoutRefundAudits.list({ page: 0, size: 1 });
        if (active) { setReport(response.content?.[0] || null); setError(''); }
      } catch (err) { if (active) { setReport(null); setError('The latest saved refund audit is unavailable.'); } }
      finally { if (active) { setLoaded(true); timer = setTimeout(load, 60000); } }
    };
    void load();
    return () => { active = false; clearTimeout(timer); };
  }, [visible]);
  if (!visible) return null;
  return <section className="card" aria-label="Payout refund audit" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderColor: 'color-mix(in srgb, #c1543d 28%, var(--border))' }}>
    <div style={{ display: 'grid', gap: '0.45rem' }}><strong>Payout refund audit <span className="pill" style={{ fontSize: '11px', marginLeft: '0.4rem' }}>ArakaPay</span></strong>
      {!loaded ? <span role="status" style={{ color: 'var(--muted)', fontSize: '13px' }}>Loading the latest saved report…</span> : error ? <span style={{ color: 'var(--muted)', fontSize: '13px' }}>{error}</span> : report ? <>
        <span style={{ fontSize: '14px' }}><strong style={{ color: '#c1543d' }}>{report.confirmedCount || 0}</strong> refunded + approved payouts across <strong>{report.confirmedAccounts || 0}</strong> accounts</span>
        <small style={{ color: 'var(--muted)' }}>{Object.entries(report.confirmedRefundTotals || {}).map(([currency, amount]) => auditMoney(amount, currency)).join(' · ') || 'No confirmed refund credits'} · {activeAudit(report) ? `${report.checkedCount} / ${report.candidateCount} checked · audit in progress` : `${report.status.toLowerCase()} · ${new Date(report.snapshotAt).toLocaleDateString()}`} · Historical credits before recoveries</small>
      </> : <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Run an audit to compare payout approvals with wallet refund credits.</span>}
    </div>
    <Link className="btn-neutral" style={{ alignSelf: 'center', textDecoration: 'none' }} href={`/dashboard/payout-refund-audits${report ? `?run=${encodeURIComponent(report.id)}` : ''}`}>View refund audits →</Link>
  </section>;
}
