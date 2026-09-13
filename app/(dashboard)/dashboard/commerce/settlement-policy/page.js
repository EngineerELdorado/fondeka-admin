'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const MODE_OPTIONS = [
  { value: 'DIRECT', label: 'Direct', description: 'Merchant proceeds become available immediately.' },
  { value: 'HELD', label: 'Held', description: 'Merchant proceeds remain pending until the hold period expires.' }
];

const DEFAULT_POLICY = { mode: 'DIRECT', holdDays: 7 };

const normalizeMode = (value) => {
  const mode = String(value || '').trim().toUpperCase();
  return mode === 'HELD' ? 'HELD' : 'DIRECT';
};

const normalizeHoldDays = (value, fallback = DEFAULT_POLICY.holdDays) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
};

const normalizePolicy = (policy, fallback = DEFAULT_POLICY) => ({
  mode: normalizeMode(policy?.mode ?? fallback.mode),
  holdDays: normalizeHoldDays(policy?.holdDays ?? policy?.hold_days, fallback.holdDays),
  raw: policy || null
});

const buildPayload = (draft) => ({
  mode: normalizeMode(draft.mode),
  holdDays: normalizeHoldDays(draft.holdDays, DEFAULT_POLICY.holdDays)
});

const modeBadgeStyle = (mode) => ({
  display: 'inline-flex',
  alignItems: 'center',
  border: `1px solid ${mode === 'HELD' ? 'rgba(245, 158, 11, 0.32)' : 'rgba(22, 163, 74, 0.28)'}`,
  background: mode === 'HELD' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(22, 163, 74, 0.08)',
  color: mode === 'HELD' ? '#92400e' : '#166534',
  padding: '0.25rem 0.55rem',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800
});

function PolicyFields({ idPrefix, draft, setDraft, disabled }) {
  const modeDescription = MODE_OPTIONS.find((option) => option.value === normalizeMode(draft.mode))?.description || '';
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor={`${idPrefix}-mode`}>Settlement mode</label>
          <select
            id={`${idPrefix}-mode`}
            value={normalizeMode(draft.mode)}
            onChange={(e) => setDraft((prev) => ({ ...prev, mode: e.target.value }))}
            disabled={disabled}
          >
            {MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.value})
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor={`${idPrefix}-holdDays`}>Hold days</label>
          <input
            id={`${idPrefix}-holdDays`}
            type="number"
            min={0}
            step={1}
            value={draft.holdDays}
            onChange={(e) => setDraft((prev) => ({ ...prev, holdDays: e.target.value }))}
            disabled={disabled}
          />
        </div>
      </div>
      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{modeDescription}</div>
    </div>
  );
}

function PolicySummary({ title, policy, source }) {
  const normalized = normalizePolicy(policy);
  return (
    <div style={{ display: 'grid', gap: '0.35rem', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800 }}>{title}</span>
        <span style={modeBadgeStyle(normalized.mode)}>{normalized.mode}</span>
        {source ? <span style={{ color: 'var(--muted)', fontSize: '12px' }}>{source}</span> : null}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
        Hold days: <strong style={{ color: 'var(--text)' }}>{normalized.holdDays}</strong>
      </div>
    </div>
  );
}

export default function CommerceSettlementPolicyPage() {
  const [globalPolicy, setGlobalPolicy] = useState(DEFAULT_POLICY);
  const [globalDraft, setGlobalDraft] = useState(DEFAULT_POLICY);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalSaving, setGlobalSaving] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [accountPolicy, setAccountPolicy] = useState(null);
  const [accountDraft, setAccountDraft] = useState(DEFAULT_POLICY);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const accountIdValue = String(accountId || '').trim();
  const hasGlobalChanges = useMemo(
    () => JSON.stringify(buildPayload(globalDraft)) !== JSON.stringify(buildPayload(globalPolicy)),
    [globalDraft, globalPolicy]
  );

  const showMessage = (setter, message) => {
    setter(message);
    window.setTimeout(() => setter(null), 4000);
  };

  const applyGlobalPolicy = (res) => {
    const normalized = normalizePolicy(res);
    setGlobalPolicy(normalized);
    setGlobalDraft({ mode: normalized.mode, holdDays: String(normalized.holdDays) });
  };

  const loadGlobalPolicy = async () => {
    setGlobalLoading(true);
    setError(null);
    try {
      const res = await api.commerceSettlementPolicy.get();
      applyGlobalPolicy(res || DEFAULT_POLICY);
    } catch (err) {
      setError(err?.message || 'Failed to load commerce settlement policy.');
      applyGlobalPolicy(DEFAULT_POLICY);
    } finally {
      setGlobalLoading(false);
    }
  };

  useEffect(() => {
    loadGlobalPolicy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveGlobalPolicy = async () => {
    setGlobalSaving(true);
    setError(null);
    setInfo(null);
    try {
      const payload = buildPayload(globalDraft);
      const res = await api.commerceSettlementPolicy.update(payload);
      applyGlobalPolicy(res || payload);
      showMessage(setInfo, 'Global commerce settlement policy saved.');
    } catch (err) {
      setError(err?.message || 'Failed to save global commerce settlement policy.');
    } finally {
      setGlobalSaving(false);
    }
  };

  const loadAccountPolicy = async () => {
    if (!accountIdValue) {
      setError('Enter an account ID.');
      return;
    }
    setAccountLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.commerceSettlementPolicy.getAccount(accountIdValue);
      const normalized = normalizePolicy(res || globalPolicy, globalPolicy);
      setAccountPolicy(res || null);
      setAccountDraft({ mode: normalized.mode, holdDays: String(normalized.holdDays) });
      showMessage(setInfo, `Loaded settlement policy for account ${accountIdValue}.`);
    } catch (err) {
      if (err?.status === 404) {
        setAccountPolicy(null);
        const fallback = normalizePolicy(globalPolicy);
        setAccountDraft({ mode: fallback.mode, holdDays: String(fallback.holdDays) });
        showMessage(setInfo, `No account override found for ${accountIdValue}. Global policy is shown as the fallback.`);
      } else {
        setError(err?.message || 'Failed to load account settlement policy.');
      }
    } finally {
      setAccountLoading(false);
    }
  };

  const saveAccountPolicy = async () => {
    if (!accountIdValue) {
      setError('Enter an account ID.');
      return;
    }
    setAccountSaving(true);
    setError(null);
    setInfo(null);
    try {
      const payload = buildPayload(accountDraft);
      const res = await api.commerceSettlementPolicy.updateAccount(accountIdValue, payload);
      setAccountPolicy(res || payload);
      const normalized = normalizePolicy(res || payload, globalPolicy);
      setAccountDraft({ mode: normalized.mode, holdDays: String(normalized.holdDays) });
      showMessage(setInfo, `Settlement policy override saved for account ${accountIdValue}.`);
    } catch (err) {
      setError(err?.message || 'Failed to save account settlement policy override.');
    } finally {
      setAccountSaving(false);
    }
  };

  const deleteAccountPolicy = async () => {
    if (!accountIdValue) {
      setError('Enter an account ID.');
      return;
    }
    setAccountSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.commerceSettlementPolicy.removeAccount(accountIdValue);
      setAccountPolicy(null);
      const fallback = normalizePolicy(globalPolicy);
      setAccountDraft({ mode: fallback.mode, holdDays: String(fallback.holdDays) });
      showMessage(setInfo, `Settlement policy override removed for account ${accountIdValue}.`);
    } catch (err) {
      setError(err?.message || 'Failed to remove account settlement policy override.');
    } finally {
      setAccountSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 800 }}>Commerce Settlement Policy</div>
          <div style={{ color: 'var(--muted)' }}>Control when online Commerce merchant proceeds become available.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/commerce/stores" className="btn-neutral" style={{ textDecoration: 'none' }}>
            Commerce stores
          </Link>
          <Link href="/dashboard/feature-flags" className="btn-neutral" style={{ textDecoration: 'none' }}>
            Commerce flags
          </Link>
        </div>
      </div>

      {error ? (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>
          {info}
        </div>
      ) : null}

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div>
          <div style={{ fontWeight: 800 }}>Global default</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Applies to online Store and Marketplace checkout proceeds unless an account override exists. POS orders are excluded from delayed settlement.
          </div>
        </div>
        <PolicySummary title="Current global policy" policy={globalPolicy} source="commerce.online.settlement.*" />
        <PolicyFields idPrefix="global-policy" draft={globalDraft} setDraft={setGlobalDraft} disabled={globalLoading || globalSaving} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={saveGlobalPolicy} disabled={globalLoading || globalSaving || !hasGlobalChanges}>
            {globalSaving ? 'Saving...' : 'Save global policy'}
          </button>
          <button type="button" className="btn-neutral" onClick={loadGlobalPolicy} disabled={globalLoading || globalSaving}>
            {globalLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div>
          <div style={{ fontWeight: 800 }}>Account override</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Use this to hold one merchant/account while the global default stays direct, or remove the override to fall back to global behavior.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 280px) auto', gap: '0.75rem', alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="accountId">Account ID</label>
            <input id="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="12345" disabled={accountLoading || accountSaving} />
          </div>
          <button type="button" className="btn-neutral" onClick={loadAccountPolicy} disabled={!accountIdValue || accountLoading || accountSaving}>
            {accountLoading ? 'Loading...' : 'Load account policy'}
          </button>
        </div>

        <PolicySummary
          title="Effective account policy"
          policy={accountPolicy || globalPolicy}
          source={accountPolicy ? `Override for account ${accountIdValue}` : 'Falling back to global policy'}
        />
        <PolicyFields idPrefix="account-policy" draft={accountDraft} setDraft={setAccountDraft} disabled={accountLoading || accountSaving || !accountIdValue} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={saveAccountPolicy} disabled={!accountIdValue || accountLoading || accountSaving}>
            {accountSaving ? 'Saving...' : 'Save account override'}
          </button>
          <button type="button" className="btn-danger" onClick={deleteAccountPolicy} disabled={!accountIdValue || accountLoading || accountSaving}>
            Remove override
          </button>
        </div>
      </div>
    </div>
  );
}
