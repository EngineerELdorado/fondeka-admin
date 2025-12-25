'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/accounts/accounts', label: 'Accounts / Users' },
  { href: '/dashboard/payments', label: 'Payment Methods' },
  // Products cluster
  { href: '/dashboard/loans', label: 'Loans & Products' },
  { href: '/dashboard/bills', label: 'Bills & Products' },
  { href: '/dashboard/cards', label: 'Cards & Products' },
  { href: '/dashboard/crypto', label: 'Cryptos & Products' },
  { href: '/dashboard/esim', label: 'eSIMs & Providers' },
  { href: '/dashboard/savings', label: 'Savings & Products' },
  { href: '/dashboard/payment-requests', label: 'Payment Requests' },
  // Other menus
  { href: '/dashboard/trusted-devices', label: 'Trusted Devices' },
  { href: '/dashboard/transactions', label: 'Transactions' },
  { href: '/dashboard/kycs', label: 'KYCs' },
  { href: '/dashboard/kyc-caps', label: 'KycCaps' },
  { href: '/dashboard/feature-flags', label: 'Feature Flags' },
  { href: '/dashboard/redis-caches', label: 'Redis Caches' },
  { href: '/dashboard/admins', label: 'Admins' },
  { href: '/dashboard/fees/fee-configs', label: 'Fee Configs' },
  { href: '/dashboard/geo', label: 'Geo' }
];

export default function DashboardLayout({ children }) {
  const { isAuthenticated, loading, initialized, logout, refreshSession } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('fondeka-theme') : null;
    const initial = stored || 'light';
    setTheme(initial);
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
        Loading session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="dashboard-shell" style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)', color: 'var(--text)' }}>
      <aside
        className="dashboard-nav"
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
          Fondeka Admin
        </div>
        <nav className="dashboard-nav-links" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                color: isActive(item.href) ? 'var(--accent)' : 'var(--text)',
                background: isActive(item.href) ? 'var(--accent-soft)' : 'transparent',
                fontWeight: isActive(item.href) ? 700 : 500
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
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
            Switch to {theme === 'light' ? 'Dark' : 'Light'} mode
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
            Sign out
          </button>
        </div>
      </aside>

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
          <div style={{ fontWeight: 700 }}>Dashboard</div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input placeholder="Search…" style={{ minWidth: '220px' }} />
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontWeight: 800 }}>
              FA
            </div>
          </div>
        </header>
        <main className="dashboard-main" style={{ padding: '1.25rem 1.5rem', flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
