'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const DEFAULT_SUDO_READY_DELAY_SECONDS = 30;
const DEFAULT_BRIDGECARD_REGISTRATION_MODE = 'REGISTER_CARDHOLDER_SYNCHRONOUSLY';
const bridgecardRegistrationModeOptions = [
  {
    label: 'Async registration - allows Bridgecard manual review',
    value: 'REGISTER_CARDHOLDER'
  },
  {
    label: 'Synchronous registration - verifies immediately if successful',
    value: 'REGISTER_CARDHOLDER_SYNCHRONOUSLY'
  }
];

const normalizeDelay = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SUDO_READY_DELAY_SECONDS;
  return Math.max(0, Math.trunc(parsed));
};

const normalizeBridgecardRegistrationMode = (value) =>
  bridgecardRegistrationModeOptions.some((option) => option.value === value)
    ? value
    : DEFAULT_BRIDGECARD_REGISTRATION_MODE;

export default function CardPolicyConfigPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [sudoCustomerCardReadyDelaySeconds, setSudoCustomerCardReadyDelaySeconds] = useState(String(DEFAULT_SUDO_READY_DELAY_SECONDS));
  const [bridgecardCardholderRegistrationMode, setBridgecardCardholderRegistrationMode] = useState(DEFAULT_BRIDGECARD_REGISTRATION_MODE);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.cardPolicyConfig.get();
      setSudoCustomerCardReadyDelaySeconds(String(normalizeDelay(res?.sudoCustomerCardReadyDelaySeconds)));
      setBridgecardCardholderRegistrationMode(normalizeBridgecardRegistrationMode(res?.bridgecardCardholderRegistrationMode));
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
        sudoCustomerCardReadyDelaySeconds: delaySeconds,
        bridgecardCardholderRegistrationMode
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
          <div style={{ fontWeight: 700 }}>Bridgecard cardholder registration mode</div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Controls which Bridgecard endpoint Fondeka uses by default when registering users as cardholders. Account custom KYC caps can override this per user.
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.35rem', maxWidth: '520px' }}>
          <label htmlFor="bridgecardCardholderRegistrationMode">Default mode</label>
          <select
            id="bridgecardCardholderRegistrationMode"
            value={bridgecardCardholderRegistrationMode}
            onChange={(e) => setBridgecardCardholderRegistrationMode(e.target.value)}
            disabled={loading || saving}
          >
            {bridgecardRegistrationModeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Async registration waits for Bridgecard callback and supports manual review. Synchronous registration attempts immediate verification and continues card ordering if successful.
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

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
