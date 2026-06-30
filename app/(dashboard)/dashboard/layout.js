'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';

const navItems = [
  { href: '/dashboard', labelKey: 'layout.nav.overview' },
  { href: '/dashboard/accounts/accounts', labelKey: 'layout.nav.accounts' },
  { href: '/dashboard/blacklist', labelKey: 'layout.nav.blacklist' },
  { href: '/dashboard/payments', labelKey: 'layout.nav.paymentMethods' },
  // Products cluster
  { href: '/dashboard/loans', labelKey: 'layout.nav.loansProducts' },
  { href: '/dashboard/savings', labelKey: 'layout.nav.savingsProducts' },
  { href: '/dashboard/loans/direct-credit', labelKey: 'layout.nav.directLoanCredit' },
  { href: '/dashboard/loans/loan-policy-config', labelKey: 'layout.nav.loanPolicyConfig' },
  { href: '/dashboard/loans/untrusted-borrowers', labelKey: 'layout.nav.untrustedBorrowers' },
  { href: '/dashboard/bills', labelKey: 'layout.nav.billsProducts' },
  { href: '/dashboard/bills/cegaweb-profiles', labelKey: 'layout.nav.cegawebProfiles' },
  { href: '/dashboard/cards', labelKey: 'layout.nav.cardsProducts' },
  { href: '/dashboard/cards/card-policy-config', labelKey: 'layout.nav.cardPolicyConfig' },
  { href: '/dashboard/crypto', labelKey: 'layout.nav.cryptosProducts' },
  { href: '/dashboard/esim', labelKey: 'layout.nav.esimsProviders' },
  { href: '/dashboard/esim-products', labelKey: 'layout.nav.esimProducts' },
  { href: '/dashboard/payment-requests', labelKey: 'layout.nav.paymentRequests' },
  { href: '/dashboard/recharge-catalog', labelKey: 'layout.nav.rechargeCatalog' },
  { href: '/dashboard/bills/utility-catalog', labelKey: 'layout.nav.utilityBillCatalog' },
  { href: '/dashboard/recharge-operator-availability-policies', labelKey: 'layout.nav.rechargeOperatorAvailability' },
  { href: '/dashboard/recharge-provider-routing', labelKey: 'layout.nav.rechargeProviderRouting' },
  { href: '/dashboard/recharge-catalog-sync', labelKey: 'layout.nav.rechargeCatalogSync' },
  { href: '/dashboard/bills/utility-catalog-sync', labelKey: 'layout.nav.utilityBillCatalogSync' },
  // Other menus
  { href: '/dashboard/trusted-devices', labelKey: 'layout.nav.trustedDevices' },
  { href: '/dashboard/transactions', labelKey: 'layout.nav.transactions' },
  { href: '/dashboard/bank-deposit-proofs', labelKey: 'layout.nav.bankDepositProofs' },
  { href: '/dashboard/estimated-processing-times', labelKey: 'layout.nav.estimatedProcessingTimes' },
  { href: '/dashboard/webhook-events', labelKey: 'layout.nav.webhookEvents' },
  { href: '/dashboard/outbox', labelKey: 'layout.nav.outbox' },
  { href: '/dashboard/liquibase/changelogs', labelKey: 'layout.nav.liquibaseChangelogs' },
  { href: '/dashboard/kycs', labelKey: 'layout.nav.kycs' },
  { href: '/dashboard/kyc-caps', labelKey: 'layout.nav.kycCaps' },
  { href: '/dashboard/kyc-default-levels', labelKey: 'layout.nav.kycDefaults' },
  { href: '/dashboard/feature-flags', labelKey: 'layout.nav.featureFlags' },
  { href: '/dashboard/wallet-policy-config', labelKey: 'layout.nav.walletPolicyConfig' },
  { href: '/dashboard/guide-videos', labelKey: 'layout.nav.guideVideos' },
  { href: '/dashboard/registration-policy-config', labelKey: 'layout.nav.registrationPolicyConfig' },
  { href: '/dashboard/app-version', labelKey: 'layout.nav.appVersion' },
  { href: '/dashboard/announcements', labelKey: 'layout.nav.announcements' },
  { href: '/dashboard/notification-providers', labelKey: 'layout.nav.notificationProviders' },
  { href: '/dashboard/notification-default-channels', labelKey: 'layout.nav.notificationDefaults' },
  { href: '/dashboard/notification-delivery-policy', labelKey: 'layout.nav.notificationDeliveryPolicy' },
  { href: '/dashboard/whatsapp-template-catalog', labelKey: 'layout.nav.whatsappTemplateCatalog' },
  { href: '/dashboard/notification-announcement-event-policy', labelKey: 'layout.nav.announcementEventPolicy' },
  { href: '/dashboard/notification-push-campaigns', labelKey: 'layout.nav.pushCampaigns' },
  { href: '/dashboard/notification-anonymous-installs', labelKey: 'layout.nav.anonymousInstalls' },
  { href: '/dashboard/notification-push-campaign-history', labelKey: 'layout.nav.pushCampaignHistory' },
  { href: '/dashboard/referral-campaigns', labelKey: 'layout.nav.referralCampaigns' },
  { href: '/dashboard/notification-email-test', labelKey: 'layout.nav.emailTests' },
  { href: '/dashboard/provider-tokens', labelKey: 'layout.nav.providerTokens' },
  { href: '/dashboard/cron-jobs', labelKey: 'layout.nav.cronJobs' },
  { href: '/dashboard/redis-caches', labelKey: 'layout.nav.redisCaches' },
  { href: '/dashboard/admins', labelKey: 'layout.nav.admins' },
  { href: '/dashboard/fees/fee-configs', labelKey: 'layout.nav.feeConfigs' },
  { href: '/dashboard/geo', labelKey: 'layout.nav.geo' }
];

export default function DashboardLayout({ children }) {
  const { isAuthenticated, loading, initialized, logout, refreshSession, session } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useState('light');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showQaStubFailureModes, setShowQaStubFailureModes] = useState(false);
  const accessTokenPayload = session?.tokens?.accessToken?.payload || null;
  const idTokenPayload = session?.tokens?.idToken?.payload || null;
  const adminGroups = useMemo(() => {
    const rawGroups = accessTokenPayload?.['cognito:groups'] || accessTokenPayload?.groups || idTokenPayload?.['cognito:groups'] || idTokenPayload?.groups;
    return Array.isArray(rawGroups) ? rawGroups.map((group) => String(group).toUpperCase()) : [];
  }, [accessTokenPayload, idTokenPayload]);
  const canSeeAdminsMenu = useMemo(
    () => adminGroups.includes('ADMIN') || adminGroups.includes('SUPER_ADMIN'),
    [adminGroups]
  );
  const renderedNavItems = useMemo(() => {
    const baseItems = navItems.filter((item) => item.href !== '/dashboard/admins' || canSeeAdminsMenu);
    if (!showQaStubFailureModes) return baseItems;
    return [...baseItems, { href: '/dashboard/admin/stub-failure-modes', labelKey: 'layout.nav.stubFailureModes' }];
  }, [canSeeAdminsMenu, showQaStubFailureModes]);
  const userLabel = useMemo(() => {
    const payload = idTokenPayload || accessTokenPayload;
    return (
      payload?.name ||
      payload?.preferred_username ||
      payload?.email ||
      payload?.['cognito:username'] ||
      payload?.username ||
      'Admin'
    );
  }, [idTokenPayload, accessTokenPayload]);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('fondeka-theme') : null;
    const initial = stored || 'light';
    setTheme(initial);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setShowQaStubFailureModes(['localhost', '127.0.0.1', '::1'].includes(window.location.hostname));
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('fondeka-theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (loading || !initialized) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, loading, initialized, router]);

  const isActive = (href) => {
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  if (!initialized) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)' }}>
        {t('common.loadingSession')}
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="dashboard-shell" style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)', color: 'var(--text)' }}>
      <aside
        className={`dashboard-nav${menuOpen ? ' is-open' : ''}`}
        id="dashboard-nav"
        style={{
          width: '260px',
          minWidth: '240px',
          borderRight: `1px solid var(--border)`,
          background: 'var(--surface)',
          padding: '1rem 1.1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div style={{ fontWeight: 900, letterSpacing: 0.6, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src="/icon.svg" alt="Fondeka" width={34} height={34} style={{ borderRadius: '10px' }} />
          {t('layout.appName')}
        </div>
        <nav className="dashboard-nav-links" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {renderedNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                color: isActive(item.href) ? 'var(--accent)' : 'var(--text)',
                background: isActive(item.href) ? 'var(--accent-soft)' : 'transparent',
                fontWeight: isActive(item.href) ? 700 : 500
              }}
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{t('common.language')}</span>
            <select value={locale} onChange={(e) => setLocale(e.target.value)}>
              <option value="en">{t('common.english')}</option>
              <option value="fr">{t('common.french')}</option>
            </select>
          </label>
          <button
            onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
            style={{
              border: `1px solid var(--border)`,
              background: 'var(--surface)',
              padding: '0.65rem 0.85rem',
              borderRadius: '10px',
              cursor: 'pointer',
              color: 'var(--text)'
            }}
          >
            {theme === 'light' ? t('layout.switchToDark') : t('layout.switchToLight')}
          </button>
          <button
            onClick={logout}
            style={{
              border: `1px solid var(--border)`,
              background: 'var(--surface)',
              padding: '0.65rem 0.85rem',
              borderRadius: '10px',
              cursor: 'pointer',
              color: 'var(--text)'
            }}
          >
            {t('layout.signOut')}
          </button>
        </div>
      </aside>
      {menuOpen && <div className="dashboard-menu-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header
          className="dashboard-header"
          style={{
            height: '72px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.5rem',
            borderBottom: `1px solid var(--border)`,
            background: 'var(--surface)',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}
        >
          <div className="dashboard-header-left" style={{ fontWeight: 700, gap: '0.6rem' }}>
            <button
              type="button"
              className="dashboard-menu-toggle"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-controls="dashboard-nav"
            >
              <span className="sr-only">{t('layout.toggleMenu')}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <Link href="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', color: 'inherit', textDecoration: 'none' }}>
              <img src="/icon.svg" alt="Fondeka" width={26} height={26} style={{ borderRadius: '8px' }} />
              <span>{t('layout.appName')}</span>
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: 'var(--muted)', display: 'inline-flex' }} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-9 12a7 7 0 0 1 10 0"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span style={{ fontWeight: 600 }}>{userLabel}</span>
          </div>
        </header>
        <main className="dashboard-main" style={{ padding: '1.25rem 1.5rem', flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
