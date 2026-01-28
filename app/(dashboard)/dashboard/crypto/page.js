'use client';

import Link from 'next/link';

const sections = [
  { href: '/dashboard/crypto/networks', title: 'Crypto Networks', blurb: 'Manage supported blockchains and status.' },
  { href: '/dashboard/crypto/products', title: 'Crypto Products', blurb: 'Currencies, display names and rates.' },
  { href: '/dashboard/crypto/product-networks', title: 'Product ↔ Network', blurb: 'Map products to networks with rank.' },
  { href: '/dashboard/crypto/quotes', title: 'Crypto Quotes', blurb: 'Get live quotes for crypto transfers.' },
  { href: '/dashboard/crypto/wallets', title: 'Crypto Wallets', blurb: 'Wallets by account and product/network.' },
  { href: '/dashboard/crypto/invoices', title: 'Crypto Invoices', blurb: 'Invoice addresses, expected amounts and status.' },
  { href: '/dashboard/crypto/payment-method-networks', title: 'Payment Method ↔ Crypto Network', blurb: 'Map payment methods to crypto networks.' },
  { href: '/dashboard/crypto/price-history', title: 'Price History', blurb: 'Browse captured crypto prices.' }
];

export default function CryptoHubPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Crypto</div>
        <div style={{ color: 'var(--muted)' }}>Pick a crypto area to manage with focused UIs.</div>
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
