'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const savingsNavItems = [
  { href: '/dashboard/savings', label: 'Savings' },
  { href: '/dashboard/savings/products', label: 'Savings Products' },
  { href: '/dashboard/savings/personal', label: 'Personal Savings' },
  { href: '/dashboard/savings/groups', label: 'Group Savings' },
  { href: '/dashboard/savings/feature-flags', label: 'Feature Flags' }
];

export const humanizeEnum = (value) =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const formatMoney = (value, currency = 'USD') => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(parsed);
  } catch {
    return `${parsed.toFixed(2)} ${currency}`;
  }
};

export const formatCount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : '—';
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
};

export const pickFirst = (...values) => values.find((value) => value !== null && value !== undefined && value !== '');

export function SavingsSubnav() {
  const pathname = usePathname();

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        gap: '0.6rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}
    >
      {savingsNavItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              textDecoration: 'none',
              padding: '0.5rem 0.85rem',
              borderRadius: '999px',
              fontWeight: 700,
              color: active ? 'var(--accent)' : 'var(--text)',
              background: active ? 'var(--accent-soft)' : 'transparent',
              border: active ? '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' : '1px solid var(--border)'
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function SavingsPageHeader({ title, description, actions }) {
  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontSize: '22px', fontWeight: 800 }}>{title}</div>
        <div style={{ color: 'var(--muted)', maxWidth: '760px' }}>{description}</div>
      </div>
      {actions ? <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  );
}

export function MetricStrip({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
      {items.map((item) => (
        <div
          key={item.label}
          className="card"
          style={{
            display: 'grid',
            gap: '0.3rem',
            borderColor: item.tone || 'var(--border)',
            background: item.soft ? item.soft : undefined
          }}
        >
          <div style={{ color: 'var(--muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
          <div style={{ fontWeight: 800, fontSize: '20px', color: item.valueTone || 'var(--text)' }}>{item.value}</div>
          {item.hint ? <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{item.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function DetailGrid({ rows }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
      {rows.map((row) => (
        <div key={row.label} className="card" style={{ display: 'grid', gap: '0.2rem', padding: '0.8rem' }}>
          <div style={{ color: 'var(--muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{row.label}</div>
          <div style={{ fontWeight: 700 }}>{row.value ?? '—'}</div>
          {row.hint ? <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{row.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function SectionCard({ title, description, actions, children }) {
  return (
    <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.2rem' }}>
          <div style={{ fontWeight: 800 }}>{title}</div>
          {description ? <div style={{ color: 'var(--muted)', fontSize: '13px', maxWidth: '820px' }}>{description}</div> : null}
        </div>
        {actions ? <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function TypeBadge({ value }) {
  const normalized = String(value || '').toUpperCase();
  const styles =
    normalized === 'AVEC'
      ? { background: 'rgba(3, 105, 161, 0.12)', color: '#0369a1', borderColor: 'rgba(3, 105, 161, 0.25)' }
      : { background: 'rgba(22, 163, 74, 0.12)', color: '#15803d', borderColor: 'rgba(22, 163, 74, 0.25)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '999px',
        padding: '0.2rem 0.55rem',
        fontWeight: 800,
        fontSize: '12px',
        border: `1px solid ${styles.borderColor}`,
        background: styles.background,
        color: styles.color
      }}
    >
      {normalized || '—'}
    </span>
  );
}

export function StatusBadge({ value }) {
  const normalized = String(value || 'UNKNOWN').toUpperCase();
  let color = '#475569';
  let background = 'rgba(100, 116, 139, 0.12)';
  let borderColor = 'rgba(100, 116, 139, 0.2)';
  if (['ACTIVE', 'PAID', 'COMPLETED', 'APPROVED', 'OPEN'].includes(normalized)) {
    color = '#15803d';
    background = 'rgba(22, 163, 74, 0.12)';
    borderColor = 'rgba(22, 163, 74, 0.2)';
  } else if (['PAUSED', 'PENDING', 'PENDING_APPROVAL', 'IN_PROGRESS'].includes(normalized)) {
    color = '#b45309';
    background = 'rgba(245, 158, 11, 0.14)';
    borderColor = 'rgba(245, 158, 11, 0.22)';
  } else if (['OVERDUE', 'BLOCKED', 'FAILED', 'REJECTED', 'DEFAULTED', 'CANCELED', 'REMOVED'].includes(normalized)) {
    color = '#b91c1c';
    background = 'rgba(239, 68, 68, 0.12)';
    borderColor = 'rgba(239, 68, 68, 0.2)';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '999px',
        padding: '0.2rem 0.55rem',
        fontWeight: 800,
        fontSize: '12px',
        border: `1px solid ${borderColor}`,
        background,
        color
      }}
    >
      {humanizeEnum(normalized)}
    </span>
  );
}

export function AdminModal({ title, onClose, children, width = 980 }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-surface" style={{ maxWidth: `${width}px`, width: 'min(100%, 98vw)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontWeight: 800 }}>{title}</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text)', fontSize: '20px', cursor: 'pointer' }}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
