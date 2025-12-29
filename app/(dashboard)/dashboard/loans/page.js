'use client';

import Link from 'next/link';

const sections = [
  { href: '/dashboard/loans/applications', title: 'Loan Applications', blurb: 'List and act on loan applications.' },
  { href: '/dashboard/loans/products', title: 'Loan Products', blurb: 'Configure available loan products, amounts, rates and terms.' },
  { href: '/dashboard/loans/decisions', title: 'Loan Decisions', blurb: 'Review and manage admin decisions for applications.' },
  { href: '/dashboard/loans/installments', title: 'Loan Installments', blurb: 'Maintain installment schedules and repayment status.' },
  { href: '/dashboard/loans/installment-payments', title: 'Installment Payments', blurb: 'Track payments applied to loan installments.' },
  { href: '/dashboard/loans/archived-pending', title: 'Archived Pending Loans', blurb: 'Import and manage archived pending loans list.' }
];

export default function LoansHubPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Loans</div>
        <div style={{ color: 'var(--muted)' }}>Pick a loans area to manage with a focused UI.</div>
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
