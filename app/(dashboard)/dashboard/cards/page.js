'use client';

import Link from 'next/link';

const sections = [
  { href: '/dashboard/cards/card-products', title: 'Card Products', blurb: 'Brands, logo, rank and activation.' },
  { href: '/dashboard/cards/card-providers', title: 'Card Providers', blurb: 'Issuing providers and active state.' },
  { href: '/dashboard/cards/product-providers', title: 'Product ↔ Provider', blurb: 'Map products to providers with pricing.' },
  { href: '/dashboard/cards/card-holders', title: 'Card Holders', blurb: 'Manage holders tied to accounts.' },
  { href: '/dashboard/cards/cards', title: 'Cards', blurb: 'Issue and control individual cards.' },
  { href: '/dashboard/cards/card-activities', title: 'Card Activities', blurb: 'Track deposits/withdrawals on cards.' },
  { href: '/dashboard/cards/card-purchase-intents', title: 'Card Purchase Intents', blurb: 'Purchase intents linked to transactions.' },
  { href: '/dashboard/card-order-retries', title: 'Card Order Retries', blurb: 'Monitor and manage card order retry attempts.' }
];

export default function CardsHubPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Cards</div>
        <div style={{ color: 'var(--muted)' }}>Choose a cards area to manage with focused UIs.</div>
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
