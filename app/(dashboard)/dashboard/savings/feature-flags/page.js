'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { SavingsPageHeader, SavingsSubnav, SectionCard } from '@/components/SavingsAdmin';

const FLAG_DEFINITIONS = [
  {
    key: 'personal_saving.interest_payout.open.enabled',
    label: 'Open Savings Interest Payout Enabled',
    description: 'When enabled, withdrawals for this personal savings type include estimated interest payout.',
    disabledDescription: 'When disabled, interest remains informational only.'
  },
  {
    key: 'personal_saving.interest_payout.locked.enabled',
    label: 'Locked Savings Interest Payout Enabled',
    description: 'When enabled, withdrawals for this personal savings type include estimated interest payout.',
    disabledDescription: 'When disabled, interest remains informational only.'
  }
];

export default function SavingsFeatureFlagsPage() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const resolvedFlags = useMemo(
    () =>
      FLAG_DEFINITIONS.map((definition) => {
        const existing = flags.find((flag) => String(flag?.key) === definition.key);
        return { ...definition, enabled: Boolean(existing?.enabled), isDefault: !existing };
      }),
    [flags]
  );

  const loadFlags = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.featureFlags.list();
      setFlags(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err?.message || 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  useEffect(() => {
    if (!error && !info) return;
    const timer = setTimeout(() => {
      setError(null);
      setInfo(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [error, info]);

  const toggleFlag = async (flag) => {
    setSavingKey(flag.key);
    setError(null);
    setInfo(null);
    try {
      const res = await api.featureFlags.update(flag.key, { enabled: !flag.enabled });
      setFlags((prev) => {
        const next = Array.isArray(prev) ? [...prev] : [];
        const existingIndex = next.findIndex((item) => String(item?.key) === flag.key);
        if (existingIndex >= 0) {
          next[existingIndex] = { ...next[existingIndex], enabled: Boolean(res?.enabled) };
        } else {
          next.unshift({ key: flag.key, enabled: Boolean(res?.enabled) });
        }
        return next;
      });
      setInfo(`${flag.label} ${res?.enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      setError(err?.message || 'Failed to update feature flag');
    } finally {
      setSavingKey('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <SavingsSubnav />
      <SavingsPageHeader
        title="Savings Feature Flags"
        description="Focused controls for savings behavior. These flags affect whether estimated interest is merely shown to the user or actually included when money is withdrawn."
        actions={
          <Link href="/dashboard/feature-flags" className="btn-neutral" style={{ textDecoration: 'none' }}>
            Open Global Flags
          </Link>
        }
      />

      {error ? <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div> : null}
      {info ? <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div> : null}

      {resolvedFlags.map((flag) => (
        <SectionCard
          key={flag.key}
          title={flag.label}
          description={flag.enabled ? flag.description : flag.disabledDescription}
          actions={
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={flag.enabled}
                onChange={() => toggleFlag(flag)}
                disabled={loading || savingKey === flag.key}
              />
              {flag.enabled ? 'Enabled' : 'Disabled'}
            </label>
          }
        >
          <div style={{ display: 'grid', gap: '0.3rem', color: 'var(--muted)', fontSize: '13px' }}>
            <div>{flag.key}</div>
            <div>{flag.isDefault ? 'Using default value until explicitly set in feature flags.' : 'Managed directly through the feature flags store.'}</div>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
