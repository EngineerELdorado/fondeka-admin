'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

const MIN_COOLDOWN = 1;
const MAX_COOLDOWN = 1440;
const ALLOWED_PAYOUT_ACTIONS = ['WITHDRAW_FROM_WALLET', 'WITHDRAW_FROM_CARD', 'SELL_CRYPTO'];
const ACTION_OPTIONS = [
  'FUND_WALLET',
  'WITHDRAW_FROM_WALLET',
  'PERSONAL_SAVING_DEPOSIT',
  'PERSONAL_SAVING_WITHDRAWAL',
  'PERSONAL_SAVING_INTEREST_PAYOUT',
  'GROUP_SAVING_CONTRIBUTION',
  'GROUP_SAVING_PAYOUT',
  'REFUND_TO_WALLET',
  'BONUS',
  'PAY_INTERNET_BILL',
  'PAY_TV_SUBSCRIPTION',
  'PAY_ELECTRICITY_BILL',
  'PAY_WATER_BILL',
  'LOAN_REQUEST',
  'LOAN_DISBURSEMENT',
  'REPAY_LOAN',
  'FUND_CARD',
  'WITHDRAW_FROM_CARD',
  'BUY_CARD',
  'CARD_ONLINE_PAYMENT',
  'CARD_PAYMENT_REVERSAL',
  'BUY_CRYPTO',
  'SELL_CRYPTO',
  'RECEIVE_CRYPTO',
  'SEND_CRYPTO',
  'SWAP_CRYPTO',
  'REQUEST_PAYMENT',
  'PAY_REQUEST',
  'E_SIM_PURCHASE',
  'E_SIM_TOPUP',
  'SEND_AIRTIME',
  'SEND_DATA_BUNDLES',
  'BUY_GIFT_CARD',
  'PAY_NETFLIX',
  'INTER_TRANSFER',
  'OTHER'
].sort();
const feeApplicationModeOptions = [
  { value: 'EXCLUSIVE', label: 'Sender pays fees (EXCLUSIVE)' },
  { value: 'INCLUSIVE', label: 'Recipient pays fees (INCLUSIVE)' }
];
const FEE_APPLICATION_MODES = new Set(feeApplicationModeOptions.map((option) => option.value));
const formatUsdValue = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : String(value);
};
const humanizeEnum = (value) =>
  String(value || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const autoRefundChipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.35rem 0.65rem',
  borderRadius: '999px',
  border: '1px solid color-mix(in srgb, var(--accent) 22%, var(--border))',
  background: 'var(--accent-soft)',
  color: 'var(--text)',
  fontSize: '12px',
  fontWeight: 700
};

export default function WalletPolicyConfigPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [cooldown, setCooldown] = useState('');
  const [payoutRateLimitActions, setPayoutRateLimitActions] = useState([]);
  const [cryptoProviderCollectionMinimumUsd, setCryptoProviderCollectionMinimumUsd] = useState('');
  const [cryptoProviderCollectionMaximumUsd, setCryptoProviderCollectionMaximumUsd] = useState('');
  const [sendAirtimeMinimumUsd, setSendAirtimeMinimumUsd] = useState('');
  const [paypalMinimumPayoutUsd, setPaypalMinimumPayoutUsd] = useState('');
  const [payoutKycThresholdUsd, setPayoutKycThresholdUsd] = useState('');
  const [forcePayoutKycUnlessApproved, setForcePayoutKycUnlessApproved] = useState(false);
  const [forceKycBeforeAppUse, setForceKycBeforeAppUse] = useState(false);
  const [sendCryptoExternalProviderEnabled, setSendCryptoExternalProviderEnabled] = useState(false);
  const [autoRefundBlockedActions, setAutoRefundBlockedActions] = useState([]);
  const [autoRefundActionSearch, setAutoRefundActionSearch] = useState('');
  const [globalFeeApplicationMode, setGlobalFeeApplicationMode] = useState('EXCLUSIVE');
  const [actionFeeApplicationModes, setActionFeeApplicationModes] = useState({});
  const [configSnapshot, setConfigSnapshot] = useState(null);

  const autoRefundActionOptions = useMemo(() => {
    const known = new Set(ACTION_OPTIONS);
    for (const action of autoRefundBlockedActions) {
      if (action) known.add(String(action));
    }
    return Array.from(known).sort();
  }, [autoRefundBlockedActions]);

  const filteredAutoRefundActionOptions = useMemo(() => {
    const query = autoRefundActionSearch.trim().toLowerCase();
    if (!query) return autoRefundActionOptions;
    return autoRefundActionOptions.filter((action) => {
      const raw = String(action);
      return raw.toLowerCase().includes(query) || humanizeEnum(raw).toLowerCase().includes(query);
    });
  }, [autoRefundActionOptions, autoRefundActionSearch]);

  const selectedAutoRefundBlockedActions = useMemo(
    () =>
      Array.from(new Set((Array.isArray(autoRefundBlockedActions) ? autoRefundBlockedActions : []).map((action) => String(action)).filter(Boolean))).sort(),
    [autoRefundBlockedActions]
  );

  const actionFeeModeEntries = useMemo(
    () =>
      Object.entries(actionFeeApplicationModes || {})
        .filter(([action, mode]) => action && FEE_APPLICATION_MODES.has(String(mode || '').toUpperCase()))
        .sort(([left], [right]) => String(left).localeCompare(String(right))),
    [actionFeeApplicationModes]
  );

  const availableActionFeeModeActions = useMemo(() => {
    const configured = new Set(actionFeeModeEntries.map(([action]) => String(action)));
    return ACTION_OPTIONS.filter((action) => !configured.has(action));
  }, [actionFeeModeEntries]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.walletPolicyConfig.get();
      setConfigSnapshot(res || {});
      const value = res?.interTransferCooldownMinutes;
      setCooldown(value === null || value === undefined ? '' : String(value));
      const incomingActions = Array.isArray(res?.payoutRateLimitActions) ? res.payoutRateLimitActions : [];
      setPayoutRateLimitActions(incomingActions.filter((action) => ALLOWED_PAYOUT_ACTIONS.includes(String(action))));
      setAutoRefundBlockedActions(Array.isArray(res?.autoRefundBlockedActions) ? res.autoRefundBlockedActions.map((action) => String(action)).filter(Boolean) : []);
      setCryptoProviderCollectionMinimumUsd(formatUsdValue(res?.cryptoProviderCollectionMinimumUsd));
      setCryptoProviderCollectionMaximumUsd(formatUsdValue(res?.cryptoProviderCollectionMaximumUsd));
      setSendAirtimeMinimumUsd(formatUsdValue(res?.sendAirtimeMinimumUsd));
      setPaypalMinimumPayoutUsd(formatUsdValue(res?.paypalMinimumPayoutUsd));
      setPayoutKycThresholdUsd(formatUsdValue(res?.payoutKycThresholdUsd));
      setForcePayoutKycUnlessApproved(Boolean(res?.forcePayoutKycUnlessApproved));
      setForceKycBeforeAppUse(Boolean(res?.forceKycBeforeAppUse));
      setSendCryptoExternalProviderEnabled(Boolean(res?.sendCryptoExternalProviderEnabled));
      setGlobalFeeApplicationMode(String(res?.globalFeeApplicationMode || 'EXCLUSIVE').toUpperCase());
      const incomingActionFeeModes =
        res?.actionFeeApplicationModes && typeof res.actionFeeApplicationModes === 'object' ? res.actionFeeApplicationModes : {};
      const normalizedActionFeeModes = Object.fromEntries(
        Object.entries(incomingActionFeeModes)
          .map(([action, mode]) => [String(action || '').trim(), String(mode || '').toUpperCase()])
          .filter(([action, mode]) => action && FEE_APPLICATION_MODES.has(mode))
      );
      setActionFeeApplicationModes(normalizedActionFeeModes);
    } catch (err) {
      setError(err?.message || 'Failed to load wallet policy config');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const parsed = Number(cooldown);
    if (!Number.isInteger(parsed) || parsed < MIN_COOLDOWN || parsed > MAX_COOLDOWN) {
      setError(`Inter-transfer cooldown must be an integer between ${MIN_COOLDOWN} and ${MAX_COOLDOWN}.`);
      return;
    }
    const normalizedActions = Array.from(
      new Set(
        (Array.isArray(payoutRateLimitActions) ? payoutRateLimitActions : [])
          .map((action) => String(action || '').trim())
          .filter((action) => ALLOWED_PAYOUT_ACTIONS.includes(action))
      )
    );
    const normalizedAutoRefundBlockedActions = Array.from(
      new Set(
        (Array.isArray(autoRefundBlockedActions) ? autoRefundBlockedActions : [])
          .map((action) => String(action || '').trim())
          .filter(Boolean)
      )
    );
    const normalizedActionFeeModes = Object.fromEntries(
      Object.entries(actionFeeApplicationModes || {})
        .map(([action, mode]) => [String(action || '').trim(), String(mode || '').toUpperCase()])
        .filter(([action, mode]) => action && FEE_APPLICATION_MODES.has(mode))
    );
    const minRaw = String(cryptoProviderCollectionMinimumUsd || '').trim();
    const maxRaw = String(cryptoProviderCollectionMaximumUsd || '').trim();
    const sendAirtimeMinimumRaw = String(sendAirtimeMinimumUsd || '').trim();
    const paypalMinimumPayoutRaw = String(paypalMinimumPayoutUsd || '').trim();
    const payoutKycThresholdRaw = String(payoutKycThresholdUsd || '').trim();
    const minParsed = minRaw === '' ? null : Number(minRaw);
    const maxParsed = maxRaw === '' ? null : Number(maxRaw);
    const sendAirtimeMinimumParsed = sendAirtimeMinimumRaw === '' ? null : Number(sendAirtimeMinimumRaw);
    const paypalMinimumPayoutParsed = paypalMinimumPayoutRaw === '' ? null : Number(paypalMinimumPayoutRaw);
    const payoutKycThresholdParsed = payoutKycThresholdRaw === '' ? null : Number(payoutKycThresholdRaw);
    if (minRaw !== '' && (!Number.isFinite(minParsed) || minParsed <= 0)) {
      setError('Minimum amount must be greater than 0.');
      return;
    }
    if (maxRaw !== '' && (!Number.isFinite(maxParsed) || maxParsed <= 0)) {
      setError('Maximum amount must be greater than 0.');
      return;
    }
    if (minParsed !== null && maxParsed !== null && minParsed > maxParsed) {
      setError('Minimum amount must be less than or equal to maximum amount.');
      return;
    }
    if (sendAirtimeMinimumRaw !== '' && (!Number.isFinite(sendAirtimeMinimumParsed) || sendAirtimeMinimumParsed <= 0)) {
      setError('Minimum send airtime amount must be a positive amount.');
      return;
    }
    if (paypalMinimumPayoutRaw !== '' && (!Number.isFinite(paypalMinimumPayoutParsed) || paypalMinimumPayoutParsed <= 0)) {
      setError('Minimum PayPal payout amount must be a positive amount.');
      return;
    }
    if (payoutKycThresholdRaw !== '' && (!Number.isFinite(payoutKycThresholdParsed) || payoutKycThresholdParsed <= 0)) {
      setError('Payout KYC threshold must be a positive amount.');
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.walletPolicyConfig.update({
        ...(configSnapshot && typeof configSnapshot === 'object' ? configSnapshot : {}),
        interTransferCooldownMinutes: parsed,
        payoutRateLimitActions: normalizedActions,
        cryptoProviderCollectionMinimumUsd: minRaw === '' ? '' : minParsed.toFixed(2),
        cryptoProviderCollectionMaximumUsd: maxRaw === '' ? '' : maxParsed.toFixed(2),
        sendAirtimeMinimumUsd: sendAirtimeMinimumRaw === '' ? '' : sendAirtimeMinimumParsed.toFixed(2),
        paypalMinimumPayoutUsd: paypalMinimumPayoutRaw === '' ? '' : paypalMinimumPayoutParsed.toFixed(2),
        payoutKycThresholdUsd: payoutKycThresholdRaw === '' ? '' : payoutKycThresholdParsed.toFixed(2),
        forcePayoutKycUnlessApproved: Boolean(forcePayoutKycUnlessApproved),
        forceKycBeforeAppUse: Boolean(forceKycBeforeAppUse),
        sendCryptoExternalProviderEnabled: Boolean(sendCryptoExternalProviderEnabled),
        autoRefundBlockedActions: normalizedAutoRefundBlockedActions,
        globalFeeApplicationMode: globalFeeApplicationMode || 'EXCLUSIVE',
        actionFeeApplicationModes: normalizedActionFeeModes
      });
      setInfo('Wallet policy config updated.');
      await loadConfig();
    } catch (err) {
      setError(err?.message || 'Failed to save wallet policy config');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '760px' }}>
      <div className="card" style={{ display: 'grid', gap: '0.3rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Wallet Policy Config</div>
        <div style={{ color: 'var(--muted)' }}>
          Controls INTER_TRANSFER protection: same sender cannot transfer again to the same recipient until cooldown expires.
        </div>
        <div style={{ color: 'var(--muted)' }}>
          Also controls payout anti-fraud gate for repeated payouts to the same recipient within the cooldown window.
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="interTransferCooldownMinutes">Inter-transfer cooldown (minutes)</label>
          <input
            id="interTransferCooldownMinutes"
            type="number"
            min={MIN_COOLDOWN}
            max={MAX_COOLDOWN}
            step={1}
            value={cooldown}
            onChange={(e) => setCooldown(e.target.value)}
            placeholder="10"
            disabled={loading || saving}
          />
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Allowed range: {MIN_COOLDOWN} to {MAX_COOLDOWN} minutes.
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Global Fee Mode</div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Default-of-defaults for fee application across the platform.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '360px' }}>
            <label htmlFor="globalFeeApplicationMode">Default fee mode for all actions</label>
            <select
              id="globalFeeApplicationMode"
              value={globalFeeApplicationMode}
              onChange={(e) => setGlobalFeeApplicationMode(e.target.value)}
              disabled={loading || saving}
            >
              {feeApplicationModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Used only when no action-level wallet policy default, fee-config row mode, or account override is configured.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              App-requested mode, account overrides, fee-config row modes, and action-level wallet policy defaults all win over this master default.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: '0.2rem' }}>
              <div style={{ fontWeight: 700 }}>Action-specific fee mode defaults</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                These defaults apply to a specific action without requiring a fee-config row mode.
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                If a fee-config row or account override sets a fee mode, that more specific rule wins.
              </div>
            </div>

            <button
              type="button"
              className="btn-neutral"
              disabled={loading || saving || availableActionFeeModeActions.length === 0}
              onClick={() => {
                const nextAction = availableActionFeeModeActions[0];
                if (!nextAction) return;
                setError(null);
                setActionFeeApplicationModes((prev) => ({
                  ...(prev && typeof prev === 'object' ? prev : {}),
                  [nextAction]: 'EXCLUSIVE'
                }));
              }}
            >
              Add action override
            </button>
          </div>

          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Remove an action from this list to let it inherit from the master global fee mode.
          </div>

          {actionFeeModeEntries.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {actionFeeModeEntries.map(([action, mode], index) => (
                <div
                  key={action}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(220px, 1.3fr) minmax(220px, 1fr) auto',
                    gap: '0.6rem',
                    alignItems: 'end',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{ display: 'grid', gap: '0.25rem' }}>
                    <label htmlFor={`actionFeeApplicationModes-action-${index}`}>Action</label>
                    <select
                      id={`actionFeeApplicationModes-action-${index}`}
                      value={action}
                      onChange={(e) => {
                        const nextAction = String(e.target.value || '').trim();
                        if (!nextAction || nextAction === action) return;
                        if (actionFeeApplicationModes[nextAction]) {
                          setError(`Fee mode for ${nextAction} is already configured in wallet policy.`);
                          return;
                        }
                        setError(null);
                        setActionFeeApplicationModes((prev) => {
                          const next = { ...(prev && typeof prev === 'object' ? prev : {}) };
                          const currentMode = next[action] || mode;
                          delete next[action];
                          next[nextAction] = currentMode;
                          return next;
                        });
                      }}
                      disabled={loading || saving}
                    >
                      {[action, ...availableActionFeeModeActions].map((option) => (
                        <option key={option} value={option}>
                          {humanizeEnum(option)} ({option})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gap: '0.25rem' }}>
                    <label htmlFor={`actionFeeApplicationModes-mode-${index}`}>Fee mode</label>
                    <select
                      id={`actionFeeApplicationModes-mode-${index}`}
                      value={mode}
                      onChange={(e) => {
                        const nextMode = String(e.target.value || '').toUpperCase();
                        setError(null);
                        setActionFeeApplicationModes((prev) => ({
                          ...(prev && typeof prev === 'object' ? prev : {}),
                          [action]: FEE_APPLICATION_MODES.has(nextMode) ? nextMode : 'EXCLUSIVE'
                        }));
                      }}
                      disabled={loading || saving}
                    >
                      {feeApplicationModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => {
                      setError(null);
                      setActionFeeApplicationModes((prev) => {
                        const next = { ...(prev && typeof prev === 'object' ? prev : {}) };
                        delete next[action];
                        return next;
                      });
                    }}
                    disabled={loading || saving}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '0.85rem',
                border: '1px dashed var(--border)',
                borderRadius: '12px',
                color: 'var(--muted)',
                fontSize: '13px'
              }}
            >
              No action-level fee mode defaults configured. All actions currently inherit from the master global fee mode unless a more specific rule exists.
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Payout rate limit actions</div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Select payout actions gated by cooldown. Empty selection disables payout gate for all actions.
          </div>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            {ALLOWED_PAYOUT_ACTIONS.map((action) => {
              const checked = payoutRateLimitActions.includes(action);
              return (
                <label key={action} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setPayoutRateLimitActions((prev) => {
                        const set = new Set(prev);
                        if (isChecked) set.add(action);
                        else set.delete(action);
                        return Array.from(set);
                      });
                    }}
                    disabled={loading || saving}
                  />
                  {action}
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Block Auto Refund For Actions</div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            If an action is selected here, failed transactions for that action will not be auto-refunded. They will be marked for manual refund instead.
          </div>
          <div style={{ display: 'grid', gap: '0.6rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                {selectedAutoRefundBlockedActions.length > 0
                  ? `${selectedAutoRefundBlockedActions.length} action${selectedAutoRefundBlockedActions.length === 1 ? '' : 's'} blocked from auto-refund`
                  : 'No actions blocked from auto-refund'}
              </div>
              {selectedAutoRefundBlockedActions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAutoRefundBlockedActions([])}
                  disabled={loading || saving}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    padding: 0
                  }}
                >
                  Clear all
                </button>
              )}
            </div>

            {selectedAutoRefundBlockedActions.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {selectedAutoRefundBlockedActions.map((action) => (
                  <span key={action} style={autoRefundChipStyle}>
                    <span>{humanizeEnum(action)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAutoRefundBlockedActions((prev) => prev.filter((item) => String(item) !== action))
                      }
                      disabled={loading || saving}
                      aria-label={`Remove ${humanizeEnum(action)}`}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: 0,
                        fontWeight: 900,
                        lineHeight: 1
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--accent)' }}>
                Add or remove actions
              </summary>
              <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.65rem' }}>
                <input
                  type="search"
                  value={autoRefundActionSearch}
                  onChange={(e) => setAutoRefundActionSearch(e.target.value)}
                  placeholder="Search actions"
                  disabled={loading || saving}
                />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '0.35rem',
                    maxHeight: '220px',
                    overflow: 'auto',
                    padding: '0.6rem',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    background: 'color-mix(in srgb, var(--surface) 96%, var(--bg) 4%)'
                  }}
                >
                  {filteredAutoRefundActionOptions.map((action) => {
                    const checked = selectedAutoRefundBlockedActions.includes(action);
                    return (
                      <label
                        key={action}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          minWidth: 0,
                          padding: '0.4rem 0.45rem',
                          borderRadius: '10px',
                          background: checked ? 'var(--accent-soft)' : 'transparent'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setAutoRefundBlockedActions((prev) => {
                              const set = new Set(prev.map((item) => String(item)));
                              if (isChecked) set.add(action);
                              else set.delete(action);
                              return Array.from(set);
                            });
                          }}
                          disabled={loading || saving}
                        />
                        <span style={{ overflowWrap: 'anywhere' }}>
                          {humanizeEnum(action)} <span style={{ color: 'var(--muted)' }}>({action})</span>
                        </span>
                      </label>
                    );
                  })}
                  {filteredAutoRefundActionOptions.length === 0 ? (
                    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>No matching actions.</div>
                  ) : null}
                </div>
              </div>
            </details>

            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Empty selection means no actions are blocked from auto-refund.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>Crypto Provider Collection Limits</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              These limits apply only when we create or submit an external crypto provider collection. Internal wallet-funded crypto flows are not affected.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Applies only when the flow sends the user to an external crypto provider. Leave blank for no minimum. Leave blank for no maximum.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="cryptoProviderCollectionMinimumUsd">Minimum amount (USD)</label>
              <input
                id="cryptoProviderCollectionMinimumUsd"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={cryptoProviderCollectionMinimumUsd}
                onChange={(e) => setCryptoProviderCollectionMinimumUsd(e.target.value)}
                onBlur={() => setCryptoProviderCollectionMinimumUsd((prev) => formatUsdValue(String(prev || '').trim()))}
                placeholder="10.00"
                disabled={loading || saving}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="cryptoProviderCollectionMaximumUsd">Maximum amount (USD)</label>
              <input
                id="cryptoProviderCollectionMaximumUsd"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={cryptoProviderCollectionMaximumUsd}
                onChange={(e) => setCryptoProviderCollectionMaximumUsd(e.target.value)}
                onBlur={() => setCryptoProviderCollectionMaximumUsd((prev) => formatUsdValue(String(prev || '').trim()))}
                placeholder="500.00"
                disabled={loading || saving}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>Payout Limits</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Applies to all PayPal payout flows.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Leave blank to use the default minimum of 100.00 USD.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '280px' }}>
            <label htmlFor="paypalMinimumPayoutUsd">Minimum PayPal payout amount (USD)</label>
            <input
              id="paypalMinimumPayoutUsd"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={paypalMinimumPayoutUsd}
              onChange={(e) => setPaypalMinimumPayoutUsd(e.target.value)}
              onBlur={() => setPaypalMinimumPayoutUsd((prev) => formatUsdValue(String(prev || '').trim()))}
              placeholder="100.00"
              disabled={loading || saving}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>Send crypto via external provider</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Turn off to route send-crypto transactions to manual intervention instead of external provider execution.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={sendCryptoExternalProviderEnabled}
                onChange={(e) => setSendCryptoExternalProviderEnabled(e.target.checked)}
                disabled={loading || saving}
              />
              Enable external provider for send crypto
            </label>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              If disabled, send crypto transactions will not be sent through the provider.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              They will remain in manual intervention for ops to fulfill manually.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              If later failed or canceled, the customer&apos;s crypto wallet is refunded.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>Global KYC Gate</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Controls whether the mobile app should force KYC before normal app usage.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              When enabled, `/customer-api/accounts/my-account` returns `forceKycBeforeAppUse = true` and the app should send the user into KYC before they continue.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              This is a global switch for now. It does not yet vary by country, account, or route.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={forceKycBeforeAppUse}
                onChange={(e) => setForceKycBeforeAppUse(e.target.checked)}
                disabled={loading || saving}
              />
              Force KYC before app use
            </label>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Enable this when business or compliance wants KYC required before the user can access the app normally.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Leave it off to continue using only the existing action-based KYC enforcement.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>Payout KYC</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Users with KYC status NONE must complete KYC when their payout amount or completed transaction volume exceeds this threshold.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Applies only when the user&apos;s current KYC status is NONE.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              KYC is required when the payout amount or total completed transaction volume exceeds this threshold. Leave blank to use the system default.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              If force KYC is enabled, the threshold is ignored for users whose KYC status is NONE.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={forcePayoutKycUnlessApproved}
                onChange={(e) => setForcePayoutKycUnlessApproved(e.target.checked)}
                disabled={loading || saving}
              />
              Force KYC for payouts when KYC status is NONE
            </label>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              If enabled, users with KYC status NONE must complete KYC before any covered payout, regardless of payout amount or completed transaction volume.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Use this for regulatory or audit controls when no payout should be allowed before KYC is completed.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '280px' }}>
            <label htmlFor="payoutKycThresholdUsd">Payout KYC threshold (USD)</label>
            <input
              id="payoutKycThresholdUsd"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={payoutKycThresholdUsd}
              onChange={(e) => setPayoutKycThresholdUsd(e.target.value)}
              onBlur={() => setPayoutKycThresholdUsd((prev) => formatUsdValue(String(prev || '').trim()))}
              placeholder="75.00"
              disabled={loading || saving}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontWeight: 700 }}>Airtime Limits</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Applies to airtime purchases sent by users. Leave blank for no minimum.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              If this field is empty, users can send airtime for any allowed amount.
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              If this field is set, airtime below this amount will be rejected.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '280px' }}>
            <label htmlFor="sendAirtimeMinimumUsd">Minimum send airtime amount (USD)</label>
            <input
              id="sendAirtimeMinimumUsd"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={sendAirtimeMinimumUsd}
              onChange={(e) => setSendAirtimeMinimumUsd(e.target.value)}
              onBlur={() => setSendAirtimeMinimumUsd((prev) => formatUsdValue(String(prev || '').trim()))}
              placeholder="2.00"
              disabled={loading || saving}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={loadConfig} disabled={loading || saving}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={loading || saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
