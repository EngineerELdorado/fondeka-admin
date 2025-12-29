'use client';

import Link from 'next/link';

const sections = [
  { href: '/dashboard/geo/countries', title: 'Countries', blurb: 'Manage country codes and names.' },
  { href: '/dashboard/geo/provinces', title: 'Provinces', blurb: 'Provinces by country.' },
  { href: '/dashboard/geo/territories', title: 'Territories', blurb: 'Territories by province.' },
  { href: '/dashboard/geo/municipalities', title: 'Municipalities', blurb: 'Municipalities by territory.' }
];

export default function GeoHubPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Geo</div>
        <div style={{ color: 'var(--muted)' }}>Manage geographic hierarchy for countries, provinces, territories, and municipalities.</div>
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
