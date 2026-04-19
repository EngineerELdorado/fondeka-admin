'use client';

import Link from 'next/link';
import { SavingsPageHeader, SavingsSubnav, TypeBadge } from '@/components/SavingsAdmin';

const sections = [
  {
    href: '/dashboard/savings/products',
    title: 'Savings Products',
    blurb: 'Create, edit, inspect, activate, and fully manage personal savings product definitions and backend product fields.'
  },
  {
    href: '/dashboard/savings/personal',
    title: 'Personal Savings',
    blurb: 'Search and inspect individual savings with visibility into principal, withdrawable value, estimated interest, payable interest, forfeitable interest, and activity history.'
  },
  {
    href: '/dashboard/savings/groups',
    title: 'Group Savings',
    blurb: 'Operate LIKELEMBA and AVEC groups with separate workflows for cycles, treasury, members, policy, and audit review.'
  },
  {
    href: '/dashboard/savings/feature-flags',
    title: 'Feature Flags',
    blurb: 'Manage savings-specific feature flags for open-savings exceptions and locked-savings maturity payout behavior.'
  }
];

export default function SavingsHubPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SavingsSubnav />
      <SavingsPageHeader
        title="Savings"
        description="Admin visibility for personal savings and group savings. Open savings is normally flexible and non-interest-bearing, while locked savings is maturity-based and interest-bearing by default. Group products are split intentionally: LIKELEMBA is cycle-first, while AVEC is treasury and policy-first."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {sections.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card"
            style={{
              display: 'grid',
              gap: '0.45rem',
              color: 'var(--text)',
              textDecoration: 'none'
            }}
          >
            <div style={{ fontWeight: 800 }}>{item.title}</div>
            <div style={{ color: 'var(--muted)' }}>{item.blurb}</div>
          </Link>
        ))}
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.7rem' }}>
        <div style={{ fontWeight: 800 }}>Operational Shape</div>
        <div style={{ color: 'var(--muted)' }}>
          Support work is visibility first and control second. Admin inspects, pauses or resumes groups when needed, removes members only when policy allows, and updates AVEC policy without bypassing customer flows.
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <TypeBadge value="LIKELEMBA" />
          <TypeBadge value="AVEC" />
        </div>
      </div>
    </div>
  );
}
