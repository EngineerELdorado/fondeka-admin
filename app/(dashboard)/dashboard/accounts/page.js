'use client';

import Link from 'next/link';

const sections = [
  { href: '/dashboard/accounts/accounts', title: 'Accounts', blurb: 'Search and review accounts, run AML check.' },
  { href: '/dashboard/accounts/balances', title: 'Account Balances', blurb: 'Manage balances per account.' },
  { href: '/dashboard/accounts/balance-activities', title: 'Balance Activities', blurb: 'Track balance changes (deposit/withdrawal).' },
  { href: '/dashboard/accounts/transfers', title: 'Account Transfers', blurb: 'Transfers between accounts with transaction IDs.' }
];

export default function AccountsHubPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Accounts</div>
        <div style={{ color: 'var(--muted)' }}>Pick an accounts area to manage with focused UIs.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        {sections.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              textDecoration: 'none',
              color: 'var(--text)'
            }}
          >
            <div style={{ fontWeight: 800 }}>{item.title}</div>
            <div style={{ color: 'var(--muted)' }}>{item.blurb}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
