'use client';

import Link from 'next/link';

const sections = [
  { href: '/dashboard/bills/products', title: 'Bill Products', blurb: 'Catalog of billable products (code, name, rank, active).' },
  { href: '/dashboard/bills/providers', title: 'Bill Providers', blurb: 'Manage bill providers and ranking.' },
  { href: '/dashboard/bills/product-providers', title: 'Product ↔ Provider', blurb: 'Map bill products to providers with rank/active.' },
  { href: '/dashboard/bills/offers', title: 'Product/Provider Offers', blurb: 'Offers per product/provider mapping.' },
  { href: '/dashboard/bills/options', title: 'Product/Provider Options', blurb: 'Options tied to product/provider.' },
  { href: '/dashboard/bills/offer-options', title: 'Offer Options Join', blurb: 'Join offers to options.' },
  { href: '/dashboard/crud?domain=bills', title: 'Explorer', blurb: 'Access all bill endpoints if needed.' }
];

export default function BillsHubPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Bills</div>
        <div style={{ color: 'var(--muted)' }}>Friendly UIs for bill catalog and mappings.</div>
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
