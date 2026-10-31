'use client';

import { NonRegulatorContent } from '@/components/RegulatorPresentation';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const DEFAULT_POLICY = {
  automaticEnforcementEnabled: true,
  minSuccessfulTransactions: 3,
  minBalanceUsd: 0.5,
  attemptCostUsd: 0,
  smsFallbackEnabled: true
};

const nonNegativeNumber = (value, label) => {
  if (String(value).trim() === '') throw new Error(`${label} is required.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be zero or more.`);
  return parsed;
};

const moneyInputValue = (value, fallback) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : Number(fallback).toFixed(2);
};

const policyFromResponse = (response) => ({
  automaticEnforcementEnabled: response?.automaticEnforcementEnabled ?? DEFAULT_POLICY.automaticEnforcementEnabled,
  minSuccessfulTransactions: String(response?.minSuccessfulTransactions ?? DEFAULT_POLICY.minSuccessfulTransactions),
  minBalanceUsd: moneyInputValue(response?.minBalanceUsd, DEFAULT_POLICY.minBalanceUsd),
  attemptCostUsd: moneyInputValue(response?.attemptCostUsd, DEFAULT_POLICY.attemptCostUsd),
  smsFallbackEnabled: response?.smsFallbackEnabled ?? DEFAULT_POLICY.smsFallbackEnabled
});

const ToggleField = ({ checked, disabled, label, description, onChange }) => (
  <div style={{ display: 'grid', gap: '0.35rem', padding: '0.85rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', fontWeight: 700 }}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
      {label}
    </label>
    <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{description}</div>
  </div>
);

export default function AccountPhoneVerificationPolicyPage() {
  const [form, setForm] = useState(policyFromResponse());
  const [savedAttemptCostUsd, setSavedAttemptCostUsd] = useState(DEFAULT_POLICY.attemptCostUsd);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const loadPolicy = async ({ preserveInfo = false } = {}) => {
    setLoading(true);
    setError(null);
    if (!preserveInfo) setInfo(null);
    try {
      const response = await api.accountPhoneVerificationPolicyConfig.get();
      setForm(policyFromResponse(response));
      setSavedAttemptCostUsd(Number(response?.attemptCostUsd ?? DEFAULT_POLICY.attemptCostUsd));
    } catch (err) {
      setError(err?.message || 'Failed to load phone verification policy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const savePolicy = async () => {
    setError(null);
    setInfo(null);

    let minSuccessfulTransactions;
    let minBalanceUsd;
    let attemptCostUsd;
    try {
      minSuccessfulTransactions = nonNegativeNumber(form.minSuccessfulTransactions, 'Minimum successful transactions');
      if (!Number.isInteger(minSuccessfulTransactions)) {
        throw new Error('Minimum successful transactions must be a whole number.');
      }
      minBalanceUsd = nonNegativeNumber(form.minBalanceUsd, 'Minimum USD balance');
      attemptCostUsd = nonNegativeNumber(form.attemptCostUsd, 'Verification attempt cost');
    } catch (validationError) {
      setError(validationError.message);
      return;
    }

    if (savedAttemptCostUsd <= 0 && attemptCostUsd > 0) {
      const confirmed = window.confirm(
        `Enable a ${attemptCostUsd.toFixed(2)} USD verification attempt cost? Each authenticated code request will debit the customer's USD wallet.`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      await api.accountPhoneVerificationPolicyConfig.update({
        automaticEnforcementEnabled: Boolean(form.automaticEnforcementEnabled),
        minSuccessfulTransactions,
        minBalanceUsd,
        attemptCostUsd,
        smsFallbackEnabled: Boolean(form.smsFallbackEnabled)
      });
      await loadPolicy({ preserveInfo: true });
      setInfo('Phone verification policy updated.');
    } catch (err) {
      setError(err?.message || 'Failed to save phone verification policy.');
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || saving;
  const automaticEnforcementEnabled = Boolean(form.automaticEnforcementEnabled);
  const enforcementFieldsDisabled = disabled || !automaticEnforcementEnabled;
  const configuredAttemptCost = Number(form.attemptCostUsd);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '820px' }}>
      <div className="card" style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Phone verification policy</div>
        <div style={{ color: 'var(--muted)' }}>
          Configure automatic phone-verification enforcement, code-request pricing, and message fallback for existing accounts.
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <div className="card" style={{ display: 'grid', gap: '0.9rem' }}>
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800 }}>Automatic enforcement</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Eligible accounts are required to verify their phone number automatically. Disable this globally when automatic enforcement should not run.
          </div>
        </div>

        <ToggleField
          checked={automaticEnforcementEnabled}
          disabled={disabled}
          label="Automatic enforcement"
          description={automaticEnforcementEnabled
            ? 'On: eligible accounts are automatically forced to verify their phone number. An eligible unverified account can be forced again after its account-level requirement is turned off.'
            : 'Off: the automatic phone-verification rule is not applied to any account. Manual account-level controls remain available.'}
          onChange={(value) => setField('automaticEnforcementEnabled', value)}
        />

        <div
          style={{
            padding: '0.75rem',
            borderRadius: '10px',
            border: `1px solid ${automaticEnforcementEnabled ? '#86efac' : '#fcd34d'}`,
            background: automaticEnforcementEnabled ? '#f0fdf4' : '#fffbeb',
            color: automaticEnforcementEnabled ? '#166534' : '#92400e',
            fontWeight: 700
          }}
        >
          {automaticEnforcementEnabled
            ? 'Automatic enforcement is active. The eligibility thresholds below will be applied.'
            : 'Automatic enforcement is off. The eligibility thresholds below are saved but are not applied.'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.3rem' }}>
            <label htmlFor="minSuccessfulTransactions" style={{ fontWeight: 700 }}>Minimum successful transactions</label>
            <input
              id="minSuccessfulTransactions"
              type="number"
              min="0"
              step="1"
              value={form.minSuccessfulTransactions}
              onChange={(event) => setField('minSuccessfulTransactions', event.target.value)}
              disabled={enforcementFieldsDisabled}
            />
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Successful customer transactions required before enforcement. Refunds, bonuses, adjustments, disbursements, reversals, automatic payouts, and internal OTHER entries do not count.
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.3rem' }}>
            <label htmlFor="minBalanceUsd" style={{ fontWeight: 700 }}>Minimum USD balance</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="minBalanceUsd"
                type="number"
                min="0"
                step="0.01"
                value={form.minBalanceUsd}
                onChange={(event) => setField('minBalanceUsd', event.target.value)}
                disabled={enforcementFieldsDisabled}
                style={{ flex: 1 }}
              />
              <span style={{ fontWeight: 700 }}>USD</span>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              The account&apos;s available USD balance must be strictly greater than this amount.
            </div>
          </div>
        </div>
      </div>

      <NonRegulatorContent><div className="card" style={{ display: 'grid', gap: '0.9rem' }}>
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800 }}>Verification delivery and cost</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            These settings apply to authenticated account verification. Public registration verification is not charged.
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.3rem', maxWidth: '390px' }}>
          <label htmlFor="attemptCostUsd" style={{ fontWeight: 700 }}>Verification attempt cost</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              id="attemptCostUsd"
              type="number"
              min="0"
              step="0.01"
              value={form.attemptCostUsd}
              onChange={(event) => setField('attemptCostUsd', event.target.value)}
              disabled={disabled}
              style={{ flex: 1 }}
            />
            <span style={{ fontWeight: 700 }}>USD</span>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Debited from the customer&apos;s USD wallet for every authenticated verification-code request. Failed requests roll the debit back.
          </div>
          {Number.isFinite(configuredAttemptCost) && configuredAttemptCost > 0 && (
            <div style={{ color: '#b45309', fontSize: '12px', fontWeight: 700 }}>
              Customer wallets will be charged {configuredAttemptCost.toFixed(2)} USD for each authenticated code request.
            </div>
          )}
        </div>

        <ToggleField
          checked={Boolean(form.smsFallbackEnabled)}
          disabled={disabled}
          label="Allow SMS fallback"
          description={form.smsFallbackEnabled
            ? 'On: try WhatsApp first, then SMS if WhatsApp does not accept the message.'
            : 'Off: use WhatsApp only; failed WhatsApp delivery follows the normal notification retry process.'}
          onChange={(value) => setField('smsFallbackEnabled', value)}
        />
      </div></NonRegulatorContent>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn-neutral" onClick={() => loadPolicy()} disabled={disabled}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        <button type="button" className="btn-primary" onClick={savePolicy} disabled={disabled}>
          {saving ? 'Saving…' : 'Save policy'}
        </button>
      </div>
    </div>
  );
}
