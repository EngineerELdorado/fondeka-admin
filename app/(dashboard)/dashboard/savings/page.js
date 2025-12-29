'use client';

import Link from 'next/link';

const sections = [
  { href: '/dashboard/savings/products', title: 'Saving Products', blurb: 'Configure saving products (rates, terms).' },
  { href: '/dashboard/savings/savings', title: 'Savings', blurb: 'Manage individual savings accounts.' },
  { href: '/dashboard/savings/activities', title: 'Saving Activities', blurb: 'Track deposits and withdrawals.' }
];

export default function SavingsHubPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Savings</div>
        <div style={{ color: 'var(--muted)' }}>Pick a savings area to manage with focused UIs.</div>
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
