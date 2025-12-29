'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

const LABELS = {
  trusted_device_enforcement: 'Enforce Trusted Device',
  auto_refund: 'Auto Refunds'
};

const WARNINGS = {
  trusted_device_enforcement: 'Warning: Disabling trusted device enforcement reduces security for customer endpoints.',
  auto_refund: 'Warning: Disabling auto refunds will route failed refunds to manual review.'
};

const SUPPORTED_KEYS = [
  'wallet',
  'bill_payments',
  'lending',
  'card',
  'crypto',
  'payment_request',
  'e_sim',
  'airtime',
  'beneficiary',
  'kyc',
  'device',
  'fees',
  'geo',
  'transactions',
  'payment_methods',
  'support',
  'storage',
  'gift_cards'
];

const formatKeyPart = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatLabel = (key) => {
  if (LABELS[key]) return LABELS[key];
  const raw = String(key || '');
  if (!raw.includes('.')) return formatKeyPart(raw);
  return raw
    .split('.')
    .map((part) => formatKeyPart(part))
    .join(' · ');
};

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [draftKey, setDraftKey] = useState('');
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const groupedFlags = useMemo(() => {
    const groups = new Map();
    flags.forEach((flag) => {
      const rawKey = String(flag.key || '');
      const groupKey = rawKey.includes('.') ? rawKey.split('.')[0] : 'modules';
      const list = groups.get(groupKey) || [];
      list.push(flag);
      groups.set(groupKey, list);
    });
    const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'modules') return -1;
      if (b === 'modules') return 1;
      return a.localeCompare(b);
    });
    return sortedGroups.map(([groupKey, list]) => ({
      key: groupKey,
      label: groupKey === 'modules' ? 'Module flags' : formatKeyPart(groupKey),
      flags: list.sort((a, b) => String(a.key || '').localeCompare(String(b.key || '')))
    }));
  }, [flags]);

  const loadFlags = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.featureFlags.list();
      setFlags(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  useEffect(() => {
    if (!info && !error) return;
    const t = setTimeout(() => {
      setInfo(null);
      setError(null);
    }, 3000);
    return () => clearTimeout(t);
  }, [info, error]);

  const handleToggle = async (key) => {
    if (!key || savingKey === key) return;
    const current = flags.find((flag) => flag.key === key);
    const nextEnabled = !current?.enabled;
    if (!nextEnabled) {
      setConfirm({ key });
      return;
    }
    setSavingKey(key);
    setError(null);
    setInfo(null);
    try {
      const res = await api.featureFlags.update(key, { enabled: nextEnabled });
      setFlags((prev) => prev.map((flag) => (flag.key === key ? { ...flag, enabled: Boolean(res?.enabled) } : flag)));
      setInfo(`${formatLabel(key)} ${res?.enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey('');
    }
  };

  const handleConfirmDisable = async () => {
    if (!confirm?.key) return;
    const key = confirm.key;
    const current = flags.find((flag) => flag.key === key);
    if (!current?.enabled) {
      setConfirm(null);
      return;
    }
    setSavingKey(key);
    setError(null);
    setInfo(null);
    try {
      const res = await api.featureFlags.update(key, { enabled: false });
      setFlags((prev) => prev.map((flag) => (flag.key === key ? { ...flag, enabled: Boolean(res?.enabled) } : flag)));
      setInfo(`${formatLabel(key)} disabled.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey('');
      setConfirm(null);
    }
  };

  const handleDeleteFlag = async () => {
    if (!deleteConfirm?.key) return;
    const key = deleteConfirm.key;
    setSavingKey(key);
    setError(null);
    setInfo(null);
    try {
      await api.featureFlags.remove(key);
      setFlags((prev) => prev.filter((flag) => flag.key !== key));
      setInfo(`${formatLabel(key)} deleted.`);
    } catch (err) {
      setError(err.message || 'Failed to delete feature flag');
    } finally {
      setSavingKey('');
      setDeleteConfirm(null);
    }
  };

  const handleCreateFlag = async () => {
    const key = draftKey.trim();
    if (!key) {
      setError('Enter a feature flag key.');
      return;
    }
    if (savingKey) return;
    setSavingKey(key);
    setError(null);
    setInfo(null);
    try {
      const res = await api.featureFlags.update(key, { enabled: draftEnabled });
      setFlags((prev) => {
        const exists = prev.some((flag) => flag.key === key);
        if (exists) {
          return prev.map((flag) => (flag.key === key ? { ...flag, enabled: Boolean(res?.enabled) } : flag));
        }
        return [{ key, enabled: Boolean(res?.enabled) }, ...prev];
      });
      setInfo(`${formatLabel(key)} ${res?.enabled ? 'enabled' : 'disabled'}.`);
      setDraftKey('');
      setDraftEnabled(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 800 }}>Feature Flags</div>
        <div style={{ color: 'var(--muted)' }}>Toggle admin-controlled runtime features.</div>
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}
      {info && (
        <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>
          {info}
        </div>
      )}

      <div className="card" style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontWeight: 700 }}>Create / Update Flag</div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.65rem', alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="flagKey">Key</label>
            <input id="flagKey" placeholder="trusted_device_enforcement" value={draftKey} onChange={(e) => setDraftKey(e.target.value)} />
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <input type="checkbox" checked={draftEnabled} onChange={(e) => setDraftEnabled(e.target.checked)} />
            {draftEnabled ? 'Enabled' : 'Disabled'}
          </label>
          <button
            type="button"
            onClick={handleCreateFlag}
            disabled={loading || savingKey === draftKey.trim()}
            style={{
              border: `1px solid var(--border)`,
              background: 'var(--surface)',
              padding: '0.65rem 0.85rem',
              borderRadius: '10px',
              cursor: 'pointer',
              color: 'var(--text)',
              fontWeight: 600
            }}
          >
            Save
          </button>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Supported keys: {SUPPORTED_KEYS.join(', ')}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.85rem', maxWidth: '720px' }}>
        {loading && <div className="card">Loading feature flags…</div>}
        {!loading && flags.length === 0 && <div className="card">No feature flags available.</div>}
        {groupedFlags.map((group) => (
          <div key={group.key} className="card" style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800 }}>{group.label}</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{group.flags.length} flags</div>
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {group.flags.map((flag) => {
                const label = formatLabel(flag.key);
                const warning = WARNINGS[flag.key];
                return (
                  <div key={flag.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{label}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{flag.key}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                          <input type="checkbox" checked={Boolean(flag.enabled)} onChange={() => handleToggle(flag.key)} disabled={loading || savingKey === flag.key} />
                          {flag.enabled ? 'Enabled' : 'Disabled'}
                        </label>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm({ key: flag.key })}
                          disabled={savingKey === flag.key}
                          style={{
                            border: `1px solid var(--border)`,
                            background: 'var(--surface)',
                            padding: '0.45rem 0.7rem',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            color: 'var(--text)'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {!flag.enabled && warning && <div style={{ color: '#b45309', fontWeight: 600 }}>{warning}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {confirm && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ width: 'min(520px, 92vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800 }}>Disable feature flag?</div>
              <button type="button" onClick={() => setConfirm(null)} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
                ×
              </button>
            </div>
            <div style={{ color: 'var(--muted)' }}>
              This will disable <strong>{formatLabel(confirm.key)}</strong> and may reduce security or change system behavior.
            </div>
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                style={{ border: `1px solid var(--border)`, background: 'var(--surface)', padding: '0.6rem 0.85rem', borderRadius: '10px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDisable}
                style={{ border: `1px solid #b91c1c`, background: '#b91c1c', color: '#fff', padding: '0.6rem 0.85rem', borderRadius: '10px', cursor: 'pointer' }}
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-surface" style={{ width: 'min(520px, 92vw)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800 }}>Delete feature flag?</div>
              <button type="button" onClick={() => setDeleteConfirm(null)} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
                ×
              </button>
            </div>
            <div style={{ color: 'var(--muted)' }}>
              Deleting <strong>{formatLabel(deleteConfirm.key)}</strong> resets it to the default behavior.
            </div>
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                style={{ border: `1px solid var(--border)`, background: 'var(--surface)', padding: '0.6rem 0.85rem', borderRadius: '10px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFlag}
                style={{ border: `1px solid #b91c1c`, background: '#b91c1c', color: '#fff', padding: '0.6rem 0.85rem', borderRadius: '10px', cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
