'use client';

import Link from 'next/link';

export default function RetiredCommerceStoreCreationFeePage() {
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>Store creation fee retired</h1>
        <div style={{ color: 'var(--muted)' }}>
          New stores no longer have a separately editable creation charge. Business Tools access and pricing are configured at the owner-account level.
        </div>
        <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--accent-soft)', fontSize: '13px' }}>
          Historical <code>CREATE_COMMERCE_STORE</code> payments remain available for reporting and can qualify the paying account for lifetime Business Tools access. This page does not call the retired update endpoint.
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/businesses/plans" className="btn-primary" style={{ textDecoration: 'none' }}>Business Tools plans</Link>
          <Link href="/dashboard/businesses/migration" className="btn-neutral" style={{ textDecoration: 'none' }}>Migration console</Link>
          <Link href="/dashboard/commerce/stores" className="btn-neutral" style={{ textDecoration: 'none' }}>Commerce stores</Link>
        </div>
      </div>
    </div>
  );
}
