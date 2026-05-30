'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/contexts/LocaleContext';
import { SavingsPageHeader, SavingsSubnav, TypeBadge } from '@/components/SavingsAdmin';

export default function SavingsHubPage() {
  const { t } = useLocale();
  const router = useRouter();
  const sections = [
    {
      href: '/dashboard/savings/products',
      title: t('savings.hub.productsTitle'),
      blurb: t('savings.hub.productsBlurb')
    },
    {
      href: '/dashboard/savings/personal',
      title: t('savings.hub.personalTitle'),
      blurb: t('savings.hub.personalBlurb')
    },
    {
      href: '/dashboard/savings/groups',
      title: t('savings.hub.groupsTitle'),
      blurb: t('savings.hub.groupsBlurb')
    },
    {
      href: '/dashboard/savings/feature-flags',
      title: t('savings.hub.flagsTitle'),
      blurb: t('savings.hub.flagsBlurb')
    }
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SavingsSubnav />
      <SavingsPageHeader
        title={t('savings.hub.title')}
        description={t('savings.hub.description')}
        actions={
          <button type="button" className="btn-primary" onClick={() => router.refresh()}>
            {t('common.refresh')}
          </button>
        }
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
        <div style={{ fontWeight: 800 }}>{t('savings.hub.operationalShape')}</div>
        <div style={{ color: 'var(--muted)' }}>
          {t('savings.hub.operationalBlurb')}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <TypeBadge value="LIKELEMBA" />
          <TypeBadge value="AVEC" />
        </div>
      </div>
    </div>
  );
}
