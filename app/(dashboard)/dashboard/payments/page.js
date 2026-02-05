'use client';

import Link from 'next/link';

const sections = [
  { href: '/dashboard/payments/payment-methods', title: 'Payment Methods', blurb: 'Catalog of payment methods (name, display, type, active).' },
  { href: '/dashboard/payments/payment-providers', title: 'Payment Providers', blurb: 'Manage payment providers and ranking.' },
  { href: '/dashboard/payments/method-providers', title: 'Method ↔ Provider', blurb: 'Map payment methods to providers with rank/active.' },
  { href: '/dashboard/payments/method-crypto-networks', title: 'Method ↔ Crypto Network', blurb: 'Map payment methods to crypto networks.' },
  { href: '/dashboard/payments/payment-method-action-configs', title: 'Method Action Configs', blurb: 'Rules that include/exclude payment methods per action/country.' },
  { href: '/dashboard/fees/fee-configs', title: 'Fee Configs', blurb: 'Configure fees per action, service, country, PMPP.' }
];

export default function PaymentsHubPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Payments</div>
        <div style={{ color: 'var(--muted)' }}>Friendly UIs for payment methods, providers and mappings.</div>
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
