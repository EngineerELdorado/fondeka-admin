'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const MIN_COOLDOWN = 1;
const MAX_COOLDOWN = 1440;
const ALLOWED_PAYOUT_ACTIONS = ['WITHDRAW_FROM_WALLET', 'WITHDRAW_FROM_CARD', 'SELL_CRYPTO'];
const formatUsdValue = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : String(value);
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

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.walletPolicyConfig.get();
      const value = res?.interTransferCooldownMinutes;
      setCooldown(value === null || value === undefined ? '' : String(value));
      const incomingActions = Array.isArray(res?.payoutRateLimitActions) ? res.payoutRateLimitActions : [];
      setPayoutRateLimitActions(incomingActions.filter((action) => ALLOWED_PAYOUT_ACTIONS.includes(String(action))));
      setCryptoProviderCollectionMinimumUsd(formatUsdValue(res?.cryptoProviderCollectionMinimumUsd));
      setCryptoProviderCollectionMaximumUsd(formatUsdValue(res?.cryptoProviderCollectionMaximumUsd));
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
    const minRaw = String(cryptoProviderCollectionMinimumUsd || '').trim();
    const maxRaw = String(cryptoProviderCollectionMaximumUsd || '').trim();
    const minParsed = minRaw === '' ? null : Number(minRaw);
    const maxParsed = maxRaw === '' ? null : Number(maxRaw);
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
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.walletPolicyConfig.update({
        interTransferCooldownMinutes: parsed,
        payoutRateLimitActions: normalizedActions,
        cryptoProviderCollectionMinimumUsd: minRaw === '' ? '' : minParsed.toFixed(2),
        cryptoProviderCollectionMaximumUsd: maxRaw === '' ? '' : maxParsed.toFixed(2)
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
