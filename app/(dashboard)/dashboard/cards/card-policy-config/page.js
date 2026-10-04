'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const DEFAULT_SUDO_READY_DELAY_SECONDS = 30;
const DEFAULT_BRIDGECARD_REGISTRATION_MODE = 'REGISTER_CARDHOLDER_SYNCHRONOUSLY';
const DEFAULT_BRIDGECARD_INFRASTRUCTURE_MODE = 'LEGACY';
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
const bridgecardInfrastructureModeOptions = [
  {
    label: 'Legacy BridgeCard',
    value: 'LEGACY'
  },
  {
    label: 'Anchor',
    value: 'ANCHOR'
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

const normalizeBridgecardInfrastructureMode = (value) =>
  bridgecardInfrastructureModeOptions.some((option) => option.value === value)
    ? value
    : DEFAULT_BRIDGECARD_INFRASTRUCTURE_MODE;

const normalizeAccountOverrides = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value)
    .map(([accountId, mode]) => ({
      accountId: String(accountId || '').trim(),
      mode: normalizeBridgecardInfrastructureMode(mode)
    }))
    .filter((entry) => entry.accountId)
    .sort((left, right) => Number(left.accountId) - Number(right.accountId));
};

const accountOverrideMapFromRows = (rows) =>
  rows.reduce((acc, row) => {
    const accountId = String(row.accountId || '').trim();
    if (!accountId) return acc;
    acc[accountId] = normalizeBridgecardInfrastructureMode(row.mode);
    return acc;
  }, {});

export default function CardPolicyConfigPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [sudoCustomerCardReadyDelaySeconds, setSudoCustomerCardReadyDelaySeconds] = useState(String(DEFAULT_SUDO_READY_DELAY_SECONDS));
  const [bridgecardCardholderRegistrationMode, setBridgecardCardholderRegistrationMode] = useState(DEFAULT_BRIDGECARD_REGISTRATION_MODE);
  const [bridgecardInfrastructureMode, setBridgecardInfrastructureMode] = useState(DEFAULT_BRIDGECARD_INFRASTRUCTURE_MODE);
  const [bridgecardInfrastructureModeAccountOverrides, setBridgecardInfrastructureModeAccountOverrides] = useState([]);
  const [overrideAccountId, setOverrideAccountId] = useState('');
  const [overrideMode, setOverrideMode] = useState('ANCHOR');

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.cardPolicyConfig.get();
      setSudoCustomerCardReadyDelaySeconds(String(normalizeDelay(res?.sudoCustomerCardReadyDelaySeconds)));
      setBridgecardCardholderRegistrationMode(normalizeBridgecardRegistrationMode(res?.bridgecardCardholderRegistrationMode));
      setBridgecardInfrastructureMode(normalizeBridgecardInfrastructureMode(res?.bridgecardInfrastructureMode));
      setBridgecardInfrastructureModeAccountOverrides(normalizeAccountOverrides(res?.bridgecardInfrastructureModeAccountOverrides));
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
    const infrastructureMode = normalizeBridgecardInfrastructureMode(bridgecardInfrastructureMode);
    const accountOverrides = accountOverrideMapFromRows(bridgecardInfrastructureModeAccountOverrides);
    const hasAnchorOverride = Object.values(accountOverrides).some((mode) => normalizeBridgecardInfrastructureMode(mode) === 'ANCHOR');
    if (infrastructureMode === 'ANCHOR' || hasAnchorOverride) {
      const confirmed = window.confirm('Anchor mode requires Anchor API credentials and webhook readiness.');
      if (!confirmed) return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.cardPolicyConfig.update({
        sudoCustomerCardReadyDelaySeconds: delaySeconds,
        bridgecardCardholderRegistrationMode,
        bridgecardInfrastructureMode: infrastructureMode,
        bridgecardInfrastructureModeAccountOverrides: accountOverrides
      });
      setSudoCustomerCardReadyDelaySeconds(String(delaySeconds));
      setBridgecardInfrastructureMode(infrastructureMode);
      setInfo('Card policy config updated.');
      await loadConfig();
    } catch (err) {
      setError(err?.message || 'Failed to save card policy config');
    } finally {
      setSaving(false);
    }
  };

  const addAccountOverride = () => {
    const accountId = overrideAccountId.trim();
    if (!accountId) {
      setError('Account ID is required for an infrastructure override.');
      return;
    }
    if (!Number.isInteger(Number(accountId)) || Number(accountId) <= 0) {
      setError('Account ID must be a positive integer.');
      return;
    }
    const mode = normalizeBridgecardInfrastructureMode(overrideMode);
    setError(null);
    setBridgecardInfrastructureModeAccountOverrides((prev) => {
      const withoutExisting = prev.filter((entry) => entry.accountId !== accountId);
      return [...withoutExisting, { accountId, mode }].sort((left, right) => Number(left.accountId) - Number(right.accountId));
    });
    setOverrideAccountId('');
    setOverrideMode('ANCHOR');
  };

  const removeAccountOverride = (accountId) => {
    setBridgecardInfrastructureModeAccountOverrides((prev) => prev.filter((entry) => entry.accountId !== accountId));
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
          <div style={{ fontWeight: 700 }}>BridgeCard infrastructure</div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Controls which backend implementation handles BridgeCard operations. Keep Legacy selected unless Anchor credentials and webhook handling are ready.
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.35rem', maxWidth: '520px' }}>
          <label htmlFor="bridgecardInfrastructureMode">Infrastructure</label>
          <select
            id="bridgecardInfrastructureMode"
            value={bridgecardInfrastructureMode}
            onChange={(e) => setBridgecardInfrastructureMode(e.target.value)}
            disabled={loading || saving}
          >
            {bridgecardInfrastructureModeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {bridgecardInfrastructureMode === 'ANCHOR' && (
            <div style={{ color: '#b45309', fontSize: '12px', fontWeight: 700 }}>
              Anchor mode requires Anchor API credentials and webhook readiness.
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: '0.65rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>Per-account infrastructure overrides</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Route specific accounts to Anchor or Legacy while everyone else uses the global mode above.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) minmax(180px, 1fr) auto', gap: '0.5rem', alignItems: 'end', maxWidth: '680px' }}>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor="bridgecardOverrideAccountId">Account ID</label>
              <input
                id="bridgecardOverrideAccountId"
                type="number"
                min="1"
                step="1"
                value={overrideAccountId}
                onChange={(e) => setOverrideAccountId(e.target.value)}
                placeholder="42"
                disabled={loading || saving}
              />
            </div>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor="bridgecardOverrideMode">Mode</label>
              <select
                id="bridgecardOverrideMode"
                value={overrideMode}
                onChange={(e) => setOverrideMode(e.target.value)}
                disabled={loading || saving}
              >
                {bridgecardInfrastructureModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn-neutral" onClick={addAccountOverride} disabled={loading || saving || !overrideAccountId.trim()}>
              Add override
            </button>
          </div>

          {bridgecardInfrastructureModeAccountOverrides.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>No account overrides. All accounts use the global infrastructure mode.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              {bridgecardInfrastructureModeAccountOverrides.map((entry) => (
                <div
                  key={entry.accountId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(120px, 1fr) minmax(160px, 1fr) auto',
                    gap: '0.5rem',
                    alignItems: 'center',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.6rem'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>Account {entry.accountId}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Overrides global mode</div>
                  </div>
                  <select
                    value={entry.mode}
                    onChange={(e) =>
                      setBridgecardInfrastructureModeAccountOverrides((prev) =>
                        prev.map((item) => (item.accountId === entry.accountId ? { ...item, mode: e.target.value } : item))
                      )
                    }
                    disabled={loading || saving}
                  >
                    {bridgecardInfrastructureModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn-danger" onClick={() => removeAccountOverride(entry.accountId)} disabled={loading || saving}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
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
