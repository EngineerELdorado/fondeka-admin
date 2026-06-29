'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const DEFAULT_SUDO_READY_DELAY_SECONDS = 30;

const normalizeDelay = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SUDO_READY_DELAY_SECONDS;
  return Math.max(0, Math.trunc(parsed));
};

export default function CardPolicyConfigPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [sudoCustomerCardReadyDelaySeconds, setSudoCustomerCardReadyDelaySeconds] = useState(String(DEFAULT_SUDO_READY_DELAY_SECONDS));

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.cardPolicyConfig.get();
      setSudoCustomerCardReadyDelaySeconds(String(normalizeDelay(res?.sudoCustomerCardReadyDelaySeconds)));
    } catch (err) {
      setError(err?.message || 'Failed to load card policy config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const delaySeconds = normalizeDelay(sudoCustomerCardReadyDelaySeconds);
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.cardPolicyConfig.update({
        sudoCustomerCardReadyDelaySeconds: delaySeconds
      });
      setSudoCustomerCardReadyDelaySeconds(String(delaySeconds));
      setInfo('Card policy config updated.');
      await loadConfig();
    } catch (err) {
      setError(err?.message || 'Failed to save card policy config');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '760px' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.3rem' }}>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>Card Policy Config</div>
          <div style={{ color: 'var(--muted)' }}>Operational card settings for provider-side ordering behavior.</div>
        </div>
        <Link href="/dashboard/cards" className="btn-neutral" style={{ textDecoration: 'none' }}>
          Cards
        </Link>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <div style={{ fontWeight: 700 }}>SUDO customer readiness delay</div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Time to wait after creating a SUDO customer before retrying the card order.
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.35rem', maxWidth: '320px' }}>
          <label htmlFor="sudoCustomerCardReadyDelaySeconds">Delay</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              id="sudoCustomerCardReadyDelaySeconds"
              type="number"
              min="0"
              step="1"
              value={sudoCustomerCardReadyDelaySeconds}
              onChange={(e) => setSudoCustomerCardReadyDelaySeconds(e.target.value)}
              onBlur={(e) => setSudoCustomerCardReadyDelaySeconds(String(normalizeDelay(e.target.value)))}
              disabled={loading || saving}
            />
            <span style={{ color: 'var(--muted)' }}>seconds</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={loadConfig} disabled={loading || saving}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={loading || saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
