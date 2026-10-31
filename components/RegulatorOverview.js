'use client';

import Link from 'next/link';
import { StatCard } from '@/components/StatCard';

export function RegulatorOverview({ metrics, loading, error, onRefresh }) {
  const links = [
    ['Accounts', '/dashboard/accounts/accounts'], ['KYC reviews', '/dashboard/kycs'],
    ['Commerce stores', '/dashboard/commerce/stores'], ['Businesses', '/dashboard/businesses'],
    ['Cards', '/dashboard/cards'], ['Bill payments', '/dashboard/bills']
  ];
  return <div style={{ display: 'grid', gap: '1rem' }}>
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}><h1 style={{ margin: 0, fontSize: '1.4rem' }}>Dashboard</h1><button type="button" className="btn-neutral" disabled={loading} onClick={onRefresh}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    {error ? <div className="card" role="alert">{error}</div> : null}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
      {[['New accounts', 'newAccounts'], ['Active accounts', 'activeAccounts'], ['KYC approved', 'kycApproved'], ['Cards issued', 'cardsIssued'], ['Card transactions', 'cardTransactions']].map(([title, key]) => <StatCard key={key} title={title} value={metrics?.[key] ?? '—'} />)}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>{links.map(([title, href]) => <Link key={href} href={href} className="card" style={{ textDecoration: 'none', color: 'var(--text)', fontWeight: 700 }}>{title}</Link>)}</div>
  </div>;
}
