'use client';

import Link from 'next/link';

const sections = [
  { href: '/dashboard/esim/esims', title: 'eSIMs', blurb: 'Manage eSIMs (ICCID, status, country, data).' },
  { href: '/dashboard/esim/providers', title: 'eSIM Providers', blurb: 'Manage eSIM providers (name, display, rank, default).' }
];

export default function EsimHubPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>eSIM</div>
        <div style={{ color: 'var(--muted)' }}>Choose an eSIM area to manage with a focused UI.</div>
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
