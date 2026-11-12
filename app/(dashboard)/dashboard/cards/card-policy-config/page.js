'use client';

import { useEffect, useRef, useState } from 'react';
import { PresentationLink as Link } from '@/components/RegulatorPresentation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

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

const deliveryModeOptions = [
  { value: 'AUTO', label: 'Automatic (recommended)' },
  { value: 'BACKEND', label: 'Existing backend flow' },
  { value: 'PROVIDER_TOKEN', label: 'Provider-token handoff' }
];
const isDeliveryMode = (value) => deliveryModeOptions.some((option) => option.value === value);
const deliveryAccountId = (value) => {
  const raw = String(value || '').trim();
  if (!/^\d+$/.test(raw) || raw.length > 19) return null;
  const id = BigInt(raw);
  return id > 0n && id <= 9223372036854775807n ? String(id) : null;
};
const sortDeliveryRows = (rows) => rows.sort((left, right) => BigInt(left.accountId) < BigInt(right.accountId) ? -1 : BigInt(left.accountId) > BigInt(right.accountId) ? 1 : 0);
const deliveryModeRows = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.some(([id, mode]) => !deliveryAccountId(id) || !isDeliveryMode(mode))) return null;
  if (new Set(entries.map(([id]) => deliveryAccountId(id))).size !== entries.length) return null;
  return sortDeliveryRows(entries.map(([id, mode]) => ({ accountId: deliveryAccountId(id), mode })));
};
const deliveryOverrideMap = (rows) => Object.fromEntries(rows.map((entry) => [entry.accountId, entry.mode]));

export default function CardPolicyConfigPage() {
  const { session } = useAuth();
  const canWrite = [session?.tokens?.accessToken?.payload, session?.tokens?.idToken?.payload]
    .flatMap((payload) => [payload?.['cognito:groups'], payload?.groups])
    .flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [])
    .some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(String(role).trim().toUpperCase()));
  const saveLock = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const busy = loading || Boolean(saving);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [sudoCustomerCardReadyDelaySeconds, setSudoCustomerCardReadyDelaySeconds] = useState(String(DEFAULT_SUDO_READY_DELAY_SECONDS));
  const [bridgecardCardholderRegistrationMode, setBridgecardCardholderRegistrationMode] = useState(DEFAULT_BRIDGECARD_REGISTRATION_MODE);
  const [bridgecardInfrastructureMode, setBridgecardInfrastructureMode] = useState(DEFAULT_BRIDGECARD_INFRASTRUCTURE_MODE);
  const [bridgecardInfrastructureModeAccountOverrides, setBridgecardInfrastructureModeAccountOverrides] = useState([]);
  const [overrideAccountId, setOverrideAccountId] = useState('');
  const [overrideMode, setOverrideMode] = useState('ANCHOR');
  const [cardDetailsDeliveryMode, setCardDetailsDeliveryMode] = useState('AUTO');
  const [cardDetailsDeliveryModeAccountOverrides, setCardDetailsDeliveryModeAccountOverrides] = useState([]);
  const [cardDetailsDeliverySupported, setCardDetailsDeliverySupported] = useState(false);
  const [deliveryPolicyDirty, setDeliveryPolicyDirty] = useState(false);
  const [deliveryOverrideAccountId, setDeliveryOverrideAccountId] = useState('');
  const [deliveryOverrideMode, setDeliveryOverrideMode] = useState('BACKEND');

  const loadConfig = async (options = {}) => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.cardPolicyConfig.get();
      setSudoCustomerCardReadyDelaySeconds(String(normalizeDelay(res?.sudoCustomerCardReadyDelaySeconds)));
      setBridgecardCardholderRegistrationMode(normalizeBridgecardRegistrationMode(res?.bridgecardCardholderRegistrationMode));
      setBridgecardInfrastructureMode(normalizeBridgecardInfrastructureMode(res?.bridgecardInfrastructureMode));
      setBridgecardInfrastructureModeAccountOverrides(normalizeAccountOverrides(res?.bridgecardInfrastructureModeAccountOverrides));
      const deliveryRows = deliveryModeRows(res?.cardDetailsDeliveryModeAccountOverrides);
      const deliverySupported = isDeliveryMode(res?.cardDetailsDeliveryMode) && deliveryRows !== null;
      setCardDetailsDeliverySupported(deliverySupported);
      if (!(options?.preserveDeliveryDraft && deliveryPolicyDirty)) {
        setCardDetailsDeliveryMode(deliverySupported ? res.cardDetailsDeliveryMode : 'AUTO');
        setCardDetailsDeliveryModeAccountOverrides(deliverySupported ? deliveryRows : []);
        setDeliveryPolicyDirty(false);
      }
    } catch (err) {
      setCardDetailsDeliverySupported(false);
      setError(err?.message || 'Failed to load card policy config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (saveLock.current || loading || !canWrite) return;
    const delaySeconds = normalizeDelay(sudoCustomerCardReadyDelaySeconds);
    const infrastructureMode = normalizeBridgecardInfrastructureMode(bridgecardInfrastructureMode);
    const accountOverrides = accountOverrideMapFromRows(bridgecardInfrastructureModeAccountOverrides);
    const hasAnchorOverride = Object.values(accountOverrides).some((mode) => normalizeBridgecardInfrastructureMode(mode) === 'ANCHOR');
    if (infrastructureMode === 'ANCHOR' || hasAnchorOverride) {
      const confirmed = window.confirm('Anchor mode requires Anchor API credentials and webhook readiness.');
      if (!confirmed) return;
    }
    saveLock.current = true;
    setSaving('provider');
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
      await loadConfig({ preserveDeliveryDraft: true });
      setInfo('Provider settings updated.');
    } catch (err) {
      setError(err?.message || 'Failed to save card policy config');
    } finally {
      saveLock.current = false;
      setSaving(null);
    }
  };

  const addAccountOverride = () => {
    if (saveLock.current || loading || !canWrite) return;
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
    if (saveLock.current || loading || !canWrite) return;
    setBridgecardInfrastructureModeAccountOverrides((prev) => prev.filter((entry) => entry.accountId !== accountId));
  };

  const addDeliveryAccountOverride = () => {
    if (saveLock.current || loading || !canWrite || !cardDetailsDeliverySupported) return;
    const accountId = deliveryAccountId(deliveryOverrideAccountId);
    if (!accountId) { setError('Enter a valid positive account ID for the card-details override.'); return; }
    setError(null);
    setCardDetailsDeliveryModeAccountOverrides((rows) => sortDeliveryRows([
      ...rows.filter((entry) => entry.accountId !== accountId), { accountId, mode: deliveryOverrideMode }
    ]));
    setDeliveryPolicyDirty(true);
    setDeliveryOverrideAccountId('');
  };

  const removeDeliveryAccountOverride = (accountId) => {
    if (saveLock.current || loading || !canWrite || !cardDetailsDeliverySupported) return;
    setCardDetailsDeliveryModeAccountOverrides((rows) => rows.filter((entry) => entry.accountId !== accountId));
    setDeliveryPolicyDirty(true);
  };

  const saveDeliveryPolicy = async () => {
    if (saveLock.current || !canWrite || !cardDetailsDeliverySupported || !deliveryPolicyDirty || loading) return;
    const overrides = deliveryOverrideMap(cardDetailsDeliveryModeAccountOverrides);
    saveLock.current = true;
    setSaving('delivery'); setError(null); setInfo(null);
    try {
      // Save delivery policy only: an emergency flow switch must not change provider routing.
      const result = await api.cardPolicyConfig.update({
        cardDetailsDeliveryMode, cardDetailsDeliveryModeAccountOverrides: overrides
      });
      const rows = deliveryModeRows(result?.cardDetailsDeliveryModeAccountOverrides);
      const saved = rows !== null ? deliveryOverrideMap(rows) : null;
      if (result?.cardDetailsDeliveryMode !== cardDetailsDeliveryMode || !saved ||
          Object.keys(saved).length !== Object.keys(overrides).length ||
          Object.entries(overrides).some(([id, mode]) => saved[id] !== mode)) {
        throw new Error('The server did not confirm the requested card-details policy. Refresh before trying again.');
      }
      setCardDetailsDeliveryMode(result.cardDetailsDeliveryMode);
      setCardDetailsDeliveryModeAccountOverrides(rows);
      setDeliveryPolicyDirty(false);
      setInfo('Card details flow updated. It applies to the next card-details request.');
    } catch (err) {
      setError(err?.message || 'Failed to save card details flow');
    } finally { saveLock.current = false; setSaving(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '760px' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.3rem' }}>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>Card Policy Config</div>
          <div style={{ color: 'var(--muted)' }}>Card details delivery and provider operation settings.</div>
        </div>
        <Link href="/dashboard/cards" className="btn-neutral" style={{ textDecoration: 'none' }}>
          Cards
        </Link>
      </div>

      {error && <div className="card" role="alert" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" role="status" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}
      {!canWrite && <div className="card">Read only. Admin or Super Admin access is required to save card policy settings.</div>}


      <section className="card" aria-label="Card details delivery" style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <div style={{ fontWeight: 700 }}>Customer card details flow</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Switch the flow used to display card details without a new app release. The backend selects the actual flow and URL on each request.
          </div>
        </div>
        {!cardDetailsDeliverySupported && !loading && (
          <div role="status" style={{ color: 'var(--muted)' }}>Card-details controls require backend support. Existing provider settings remain available.</div>
        )}
        <div style={{ display: 'grid', gap: '0.35rem', maxWidth: '520px' }}>
          <label htmlFor="cardDetailsDeliveryMode">Global card details mode</label>
          <select id="cardDetailsDeliveryMode" value={cardDetailsDeliverySupported ? cardDetailsDeliveryMode : ''}
            onChange={(event) => { setCardDetailsDeliveryMode(event.target.value); setDeliveryPolicyDirty(true); }}
            disabled={busy || !canWrite || !cardDetailsDeliverySupported}>
            {!cardDetailsDeliverySupported && <option value="" disabled>{loading ? 'Loading...' : 'Unavailable'}</option>}
            {deliveryModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            {cardDetailsDeliveryMode === 'AUTO' && 'Uses token handoff for supported active cards on app 1.1.27+, otherwise the existing compatible flow.'}
            {cardDetailsDeliveryMode === 'BACKEND' && 'Uses the existing details response or embedded UI, without client token handoff. This can still depend on the provider’s token service.'}
            {cardDetailsDeliveryMode === 'PROVIDER_TOKEN' && 'Requires token handoff on compatible apps. Unsupported, inactive or unissued cards return an unavailable error instead of falling back.'}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Apps below 1.1.27 keep their existing flow. Changes apply on the next request; tokens already issued remain valid until used or expired.
          </div>
        </div>
        <div style={{ display: 'grid', gap: '0.65rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>Per-account card-details overrides</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              An account override takes precedence over the global delivery mode. Remove it to inherit the global setting. Automatic is an explicit choice for that account.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '0.5rem', alignItems: 'end', maxWidth: '680px' }}>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor="cardDetailsOverrideAccountId">Account ID</label>
              <input
                id="cardDetailsOverrideAccountId"
                type="text"
                inputMode="numeric"
                value={deliveryOverrideAccountId}
                onChange={(e) => setDeliveryOverrideAccountId(e.target.value)}
                placeholder="42"
                disabled={busy || !canWrite || !cardDetailsDeliverySupported}
              />
            </div>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor="cardDetailsOverrideMode">Mode</label>
              <select
                id="cardDetailsOverrideMode"
                value={deliveryOverrideMode}
                onChange={(e) => setDeliveryOverrideMode(e.target.value)}
                disabled={busy || !canWrite || !cardDetailsDeliverySupported}
              >
                {deliveryModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn-neutral" onClick={addDeliveryAccountOverride} disabled={busy || !canWrite || !cardDetailsDeliverySupported || !deliveryOverrideAccountId.trim()}>
              Add flow override
            </button>
          </div>

          {cardDetailsDeliveryModeAccountOverrides.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>No card-details overrides. All accounts use the global delivery mode.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.45rem' }}>
              {cardDetailsDeliveryModeAccountOverrides.map((entry) => (
                <div
                  key={entry.accountId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
                    gap: '0.5rem',
                    alignItems: 'center',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.6rem'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>Account {entry.accountId}</div>
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Overrides global delivery mode</div>
                  </div>
                  <select
                    aria-label={`Flow for account ${entry.accountId}`}
                    value={entry.mode}
                    onChange={(e) => {
                      setDeliveryPolicyDirty(true);
                      setCardDetailsDeliveryModeAccountOverrides((prev) =>
                        prev.map((item) => (item.accountId === entry.accountId ? { ...item, mode: e.target.value } : item))
                      );
                    }}
                    disabled={busy || !canWrite || !cardDetailsDeliverySupported}
                  >
                    {deliveryModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn-danger" aria-label={`Remove flow override for account ${entry.accountId}`} onClick={() => removeDeliveryAccountOverride(entry.accountId)} disabled={busy || !canWrite || !cardDetailsDeliverySupported}>
                    Remove flow override
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        {cardDetailsDeliveryModeAccountOverrides.length > 0 && (
          <button type="button" className="btn-neutral"
            onClick={() => { if (saveLock.current || !canWrite || !cardDetailsDeliverySupported) return; setCardDetailsDeliveryModeAccountOverrides([]); setDeliveryPolicyDirty(true); }}
            disabled={busy || !canWrite || !cardDetailsDeliverySupported}>
            Clear flow overrides
          </button>
        )}
        <button type="button" className="btn-primary" onClick={saveDeliveryPolicy}
          disabled={busy || !canWrite || !cardDetailsDeliverySupported || !deliveryPolicyDirty}>
          {saving === 'delivery' ? 'Saving card details flow...' : 'Save card details flow'}
        </button>
      </section>

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
            disabled={busy || !canWrite}
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
            disabled={busy || !canWrite}
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '0.5rem', alignItems: 'end', maxWidth: '680px' }}>
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
                disabled={busy || !canWrite}
              />
            </div>
            <div style={{ display: 'grid', gap: '0.25rem' }}>
              <label htmlFor="bridgecardOverrideMode">Mode</label>
              <select
                id="bridgecardOverrideMode"
                value={overrideMode}
                onChange={(e) => setOverrideMode(e.target.value)}
                disabled={busy || !canWrite}
              >
                {bridgecardInfrastructureModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn-neutral" onClick={addAccountOverride} disabled={busy || !canWrite || !overrideAccountId.trim()}>
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
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
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
                    disabled={busy || !canWrite}
                  >
                    {bridgecardInfrastructureModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn-danger" onClick={() => removeAccountOverride(entry.accountId)} disabled={busy || !canWrite}>
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
              disabled={busy || !canWrite}
            />
            <span style={{ color: 'var(--muted)' }}>seconds</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={loadConfig} disabled={busy}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={busy || !canWrite}>
            {saving === 'provider' ? 'Saving provider settings...' : 'Save provider settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
