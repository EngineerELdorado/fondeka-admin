'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const DEFAULT_CONFIG = {
  amount: 0,
  currency: 'USD',
  free: true,
  priceAmountConfigKey: 'commerce.store.creation.price_amount',
  priceCurrencyConfigKey: 'commerce.store.creation.price_currency'
};

const normalizeCurrency = (value) => String(value || DEFAULT_CONFIG.currency).trim().toUpperCase();

const normalizeAmount = (value, fallback = DEFAULT_CONFIG.amount) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const normalizeConfig = (config) => {
  const amount = normalizeAmount(config?.amount);
  return {
    amount,
    currency: normalizeCurrency(config?.currency),
    free: typeof config?.free === 'boolean' ? config.free : amount <= 0,
    priceAmountConfigKey: config?.priceAmountConfigKey || DEFAULT_CONFIG.priceAmountConfigKey,
    priceCurrencyConfigKey: config?.priceCurrencyConfigKey || DEFAULT_CONFIG.priceCurrencyConfigKey
  };
};

const buildPayload = (draft) => ({
  amount: normalizeAmount(draft.amount),
  currency: normalizeCurrency(draft.currency)
});

const formatAmount = (amount, currency) => {
  const value = normalizeAmount(amount);
  if (value <= 0) return 'Free';
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${normalizeCurrency(currency)}`;
};

export default function CommerceStoreCreationFeePage() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [draft, setDraft] = useState({ amount: '0', currency: DEFAULT_CONFIG.currency });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const hasChanges = useMemo(
    () => JSON.stringify(buildPayload(draft)) !== JSON.stringify({ amount: config.amount, currency: config.currency }),
    [config, draft]
  );

  const applyConfig = (nextConfig) => {
    const normalized = normalizeConfig(nextConfig || DEFAULT_CONFIG);
    setConfig(normalized);
    setDraft({ amount: String(normalized.amount), currency: normalized.currency });
  };

  const showMessage = (setter, message) => {
    setter(message);
    window.setTimeout(() => setter(null), 4000);
  };

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.commerceStoreCreationFee.get();
      applyConfig(res || DEFAULT_CONFIG);
    } catch (err) {
      setError(err?.message || 'Failed to load commerce store creation fee.');
      applyConfig(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveConfig = async () => {
    const rawAmount = Number(draft.amount);
    if (!Number.isFinite(rawAmount) || rawAmount < 0) {
      setError('Amount must be zero or greater.');
      return;
    }
    const rawCurrency = String(draft.currency || '').trim().toUpperCase();
    if (!rawCurrency) {
      setError('Currency is required.');
      return;
    }
    const payload = { amount: rawAmount, currency: rawCurrency };
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.commerceStoreCreationFee.update(payload);
      applyConfig(res || payload);
      showMessage(setInfo, 'Commerce store creation fee saved.');
    } catch (err) {
      setError(err?.message || 'Failed to save commerce store creation fee.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 800 }}>Commerce Store Creation Fee</div>
          <div style={{ color: 'var(--muted)' }}>Set the base amount customers pay before creating a Commerce store.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/commerce/stores" className="btn-neutral" style={{ textDecoration: 'none' }}>
            Stores
          </Link>
          <Link href="/dashboard/commerce/settlement-policy" className="btn-neutral" style={{ textDecoration: 'none' }}>
            Settlement policy
          </Link>
          <Link href="/dashboard/fees/fee-configs" className="btn-neutral" style={{ textDecoration: 'none' }}>
            Fee configs
          </Link>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {info ? <div className="alert alert-success">{info}</div> : null}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800 }}>Current store creation price</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Amount 0 means store creation is free. Amount greater than 0 requires payment with a Fondeka Balance wallet.
            </div>
          </div>
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              minWidth: '140px',
              textAlign: 'right',
              background: config.free ? 'rgba(22, 163, 74, 0.08)' : 'var(--surface)'
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>Customer pays</div>
            <div style={{ fontSize: '20px', fontWeight: 900 }}>{loading ? 'Loading...' : formatAmount(config.amount, config.currency)}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Status</div>
            <div style={{ fontWeight: 800 }}>{config.free ? 'Free store creation' : 'Paid store creation'}</div>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Amount config key</div>
            <code style={{ fontSize: '12px' }}>{config.priceAmountConfigKey}</code>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Currency config key</div>
            <code style={{ fontSize: '12px' }}>{config.priceCurrencyConfigKey}</code>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div>
          <div style={{ fontWeight: 800 }}>Update creation fee</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Extra fees are managed separately in fee configs with action COMMERCE_STORE_CREATION.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="storeCreationAmount">Amount</label>
            <input
              id="storeCreationAmount"
              type="number"
              min={0}
              step="0.01"
              value={draft.amount}
              onChange={(event) => setDraft((prev) => ({ ...prev, amount: event.target.value }))}
              disabled={loading || saving}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="storeCreationCurrency">Currency</label>
            <input
              id="storeCreationCurrency"
              value={draft.currency}
              onChange={(event) => setDraft((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
              disabled={loading || saving}
              placeholder="USD"
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={saveConfig} disabled={loading || saving || !hasChanges}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" className="btn-neutral" onClick={loadConfig} disabled={loading || saving}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
    </div>
  );
}
