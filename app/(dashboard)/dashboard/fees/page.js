'use client';

import { PresentationLink as Link } from '@/components/RegulatorPresentation';

const sections = [
  { href: '/dashboard/fees/fee-configs', title: 'Rail pricing', blurb: 'COLLECTION and PAYOUT tariffs by payment method, route, provider and country.' },
  { href: '/dashboard/fees/service-fee-configs', title: 'Business fees', blurb: 'Service, action and product charges configured independently of payment providers.' }
];

export default function FeesHubPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Fees</div>
        <div style={{ color: 'var(--muted)' }}>Manage fee configurations from a dedicated hub.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
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
