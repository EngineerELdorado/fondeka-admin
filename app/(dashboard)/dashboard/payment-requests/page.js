'use client';

import Link from 'next/link';

const sections = [
  { href: '/dashboard/payment-requests/requests', title: 'Payment Requests', blurb: 'Search, create, and manage payment requests.' },
  { href: '/dashboard/payment-requests/items', title: 'Request Items', blurb: 'Line items linked to payment requests.' },
  { href: '/dashboard/payment-requests/payments', title: 'Request Payments', blurb: 'Payments made toward requests.' },
  { href: '/dashboard/payment-requests/settlement-options', title: 'Settlement Options', blurb: 'Control custom settlement rules per request type.' }
];

export default function PaymentRequestsHubPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Payment Requests</div>
        <div style={{ color: 'var(--muted)' }}>Choose a payment requests area to manage with focused UIs.</div>
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
