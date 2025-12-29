'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'];

export default function NotificationDefaultChannelsPage() {
  const { pushToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState(null);

  const orderedRows = useMemo(() => {
    const map = new Map((rows || []).map((row) => [String(row.channel || '').toUpperCase(), row]));
    return CHANNELS.map((channel) => ({
      channel,
      enabled: channel === 'PUSH' ? true : Boolean(map.get(channel)?.enabled),
      locked: channel === 'PUSH'
    }));
  }, [rows]);

  const loadDefaults = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.notificationDefaultChannels.list();
      setRows(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err.message || 'Failed to load default channels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDefaults();
  }, []);

  const toggleChannel = async ({ channel, enabled, locked }) => {
    if (!channel) return;
    if (locked) return;
    setSavingKey(channel);
    setError(null);
    try {
      await api.notificationDefaultChannels.update({ channel, enabled });
      setRows((prev) => {
        const next = (prev || []).filter((row) => String(row.channel || '').toUpperCase() !== channel);
        return [...next, { channel, enabled }];
      });
      pushToast({ tone: 'success', message: `${channel} default ${enabled ? 'enabled' : 'disabled'}` });
    } catch (err) {
      const message = err.message || 'Failed to update default channel';
      setError(message);
      pushToast({ tone: 'error', message });
    } finally {
      setSavingKey('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Default Notification Channels</div>
          <div style={{ color: 'var(--muted)' }}>Enable channels sent to all users by default.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard" className="btn-neutral">
            ← Dashboard
          </Link>
          <button type="button" className="btn-neutral" onClick={loadDefaults} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: '0.6rem' }}>
        {orderedRows.map((row) => (
          <div
            key={row.channel}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              padding: '0.6rem 0.75rem',
              border: `1px solid var(--border)`,
              borderRadius: '10px'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <div style={{ fontWeight: 700 }}>{row.channel}</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                {row.enabled ? 'Default for all users' : 'Default off'}
                {row.locked ? ' (always on)' : ''}
              </div>
            </div>
            <button
              type="button"
              className={row.enabled ? 'btn-danger btn-sm' : 'btn-primary btn-sm'}
              onClick={() => toggleChannel({ channel: row.channel, enabled: !row.enabled, locked: row.locked })}
              disabled={savingKey === row.channel || row.locked}
            >
              {savingKey === row.channel ? 'Saving…' : row.locked ? 'Enabled' : row.enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
