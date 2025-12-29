'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

const formatChannel = (value) => String(value || '').toUpperCase();

const PROVIDER_OPTIONS = {
  EMAIL: ['MAILJET', 'SENDGRID', 'POSTMARK'],
  SMS: ['TWILIO', 'VONAGE', 'AWS_SNS'],
  WHATSAPP: ['TWILIO', 'META', 'MESSAGEBIRD'],
  PUSH: ['EXPO', 'FCM', 'ONESIGNAL']
};
const CHANNEL_ORDER = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'];

export default function NotificationProvidersPage() {
  const { pushToast } = useToast();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newChannel, setNewChannel] = useState('EMAIL');
  const [newProviderName, setNewProviderName] = useState('EMAIL_MAILJET');
  const [newActive, setNewActive] = useState(false);
  const [creating, setCreating] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map();
    (providers || []).forEach((item) => {
      const channel = formatChannel(item.channel);
      const list = map.get(channel) || [];
      list.push(item);
      map.set(channel, list);
    });
    const allChannels = new Set([...CHANNEL_ORDER, ...Array.from(map.keys())]);
    return Array.from(allChannels)
      .sort((a, b) => CHANNEL_ORDER.indexOf(a) - CHANNEL_ORDER.indexOf(b))
      .map((channel) => {
        const items = map.get(channel) || [];
        return {
          channel,
          items: items.slice().sort((a, b) => String(a.providerName || '').localeCompare(String(b.providerName || '')))
        };
      });
  }, [providers]);

  const [groupedWithItems, groupedEmpty] = useMemo(() => {
    const withItems = grouped.filter((group) => group.items.length > 0);
    const empty = grouped.filter((group) => group.items.length === 0);
    return [withItems, empty];
  }, [grouped]);

  const loadProviders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.notificationProviders.list();
      setProviders(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err.message || 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const setActiveProvider = async ({ channel, providerName }) => {
    if (!channel || !providerName) return;
    const key = `${channel}:${providerName}`;
    if (savingKey) return;
    setSavingKey(key);
    setError(null);
    try {
      await api.notificationProviders.setActive({ channel, providerName });
      setProviders((prev) =>
        (prev || []).map((item) =>
          formatChannel(item.channel) === channel
            ? { ...item, active: item.providerName === providerName }
            : item
        )
      );
      pushToast({ tone: 'success', message: `${channel} provider set to ${providerName}` });
    } catch (err) {
      const message = err.message || 'Failed to update provider';
      setError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setSavingKey('');
    }
  };

  const resetCreateForm = () => {
    setNewChannel('EMAIL');
    setNewProviderName('EMAIL_MAILJET');
    setNewActive(false);
  };

  const submitCreate = async () => {
    const channel = formatChannel(newChannel);
    const providerName = String(newProviderName || '').trim();
    if (!channel || !providerName) {
      setError('Channel and provider are required');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await api.notificationProviders.create({ channel, providerName, active: Boolean(newActive) });
      pushToast({ tone: 'success', message: 'Provider added' });
      setShowAdd(false);
      resetCreateForm();
      await loadProviders();
    } catch (err) {
      const message = err.message || 'Failed to add provider';
      setError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Notification Providers</div>
          <div style={{ color: 'var(--muted)' }}>Select one active provider per channel. Changes take effect immediately.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard" className="btn-neutral">
            ← Dashboard
          </Link>
          <button type="button" className="btn-primary" onClick={() => setShowAdd((prev) => !prev)}>
            {showAdd ? 'Hide add form' : 'Add provider'}
          </button>
          <button type="button" className="btn-neutral" onClick={loadProviders} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}

      {showAdd && (
        <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ fontWeight: 800 }}>Add provider</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Only registry providers can be added.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="providerChannel">Channel</label>
              <select
                id="providerChannel"
                value={newChannel}
                onChange={(e) => {
                  const nextChannel = formatChannel(e.target.value);
                  setNewChannel(nextChannel);
                  const nextOptions = PROVIDER_OPTIONS[nextChannel] || [];
                  setNewProviderName(nextOptions[0] || '');
                }}
              >
                {Object.keys(PROVIDER_OPTIONS).map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="providerName">Provider</label>
              <select
                id="providerName"
                value={newProviderName}
                onChange={(e) => setNewProviderName(e.target.value)}
                disabled={(PROVIDER_OPTIONS[newChannel] || []).length === 0}
              >
                {(PROVIDER_OPTIONS[newChannel] || []).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {(PROVIDER_OPTIONS[newChannel] || []).length === 0 && (
                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>No registered providers for this channel.</div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label>Activation</label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} />
                Make active immediately
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral" onClick={resetCreateForm} disabled={creating}>
              Reset
            </button>
            <button type="button" className="btn-primary" onClick={submitCreate} disabled={creating}>
              {creating ? 'Saving…' : 'Add provider'}
            </button>
          </div>
        </div>
      )}

      {groupedWithItems.length === 0 && !loading && (
        <div className="card" style={{ color: 'var(--muted)' }}>
          No notification providers found.
        </div>
      )}

      {groupedWithItems.map((group) => (
        <div key={group.channel} className="card" style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <div style={{ fontWeight: 800 }}>{group.channel}</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                Active: {group.items.find((item) => item.active)?.providerName || 'None'}
              </div>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Pick one provider for this channel</div>
          </div>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {group.items.map((item) => {
              const channel = formatChannel(item.channel);
              const key = `${channel}:${item.providerName}`;
              const isSaving = savingKey === key;
              return (
                <label
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.55rem 0.75rem',
                    border: `1px solid var(--border)`,
                    borderRadius: '10px',
                    background: item.active ? 'color-mix(in srgb, var(--accent-soft) 65%, transparent)' : 'transparent'
                  }}
                >
                  <input
                    type="radio"
                    name={`provider-${channel}`}
                    checked={Boolean(item.active)}
                    onChange={() => setActiveProvider({ channel, providerName: item.providerName })}
                    disabled={loading || (savingKey !== '' && savingKey !== key)}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1 }}>
                    <span style={{ fontWeight: 700 }}>{item.providerName}</span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {item.active ? 'Currently active' : 'Inactive'}
                    </span>
                  </div>
                  {isSaving && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Saving…</span>}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {groupedEmpty.length > 0 && (
        <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontWeight: 800 }}>Channels with no providers</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Add a provider to enable these channels.</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {groupedEmpty.map((group) => (
              <span
                key={group.channel}
                style={{
                  padding: '0.35rem 0.6rem',
                  borderRadius: '999px',
                  border: '1px solid var(--border)',
                  color: 'var(--muted)',
                  fontSize: '12px'
                }}
              >
                {group.channel}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
