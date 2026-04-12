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
  const [sendAirtimeMinimumUsd, setSendAirtimeMinimumUsd] = useState('');
  const [paypalMinimumPayoutUsd, setPaypalMinimumPayoutUsd] = useState('');
  const [payoutKycThresholdUsd, setPayoutKycThresholdUsd] = useState('');
  const [forcePayoutKycUnlessApproved, setForcePayoutKycUnlessApproved] = useState(false);
  const [forceKycBeforeAppUse, setForceKycBeforeAppUse] = useState(false);
  const [sendCryptoExternalProviderEnabled, setSendCryptoExternalProviderEnabled] = useState(false);

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
      setSendAirtimeMinimumUsd(formatUsdValue(res?.sendAirtimeMinimumUsd));
      setPaypalMinimumPayoutUsd(formatUsdValue(res?.paypalMinimumPayoutUsd));
      setPayoutKycThresholdUsd(formatUsdValue(res?.payoutKycThresholdUsd));
      setForcePayoutKycUnlessApproved(Boolean(res?.forcePayoutKycUnlessApproved));
      setForceKycBeforeAppUse(Boolean(res?.forceKycBeforeAppUse));
      setSendCryptoExternalProviderEnabled(Boolean(res?.sendCryptoExternalProviderEnabled));
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
        interTransferCooldownMinutes: parsed,
        payoutRateLimitActions: normalizedActions,
        cryptoProviderCollectionMinimumUsd: minRaw === '' ? '' : minParsed.toFixed(2),
        cryptoProviderCollectionMaximumUsd: maxRaw === '' ? '' : maxParsed.toFixed(2),
        sendAirtimeMinimumUsd: sendAirtimeMinimumRaw === '' ? '' : sendAirtimeMinimumParsed.toFixed(2),
        paypalMinimumPayoutUsd: paypalMinimumPayoutRaw === '' ? '' : paypalMinimumPayoutParsed.toFixed(2),
        payoutKycThresholdUsd: payoutKycThresholdRaw === '' ? '' : payoutKycThresholdParsed.toFixed(2),
        forcePayoutKycUnlessApproved: Boolean(forcePayoutKycUnlessApproved),
        forceKycBeforeAppUse: Boolean(forceKycBeforeAppUse),
        sendCryptoExternalProviderEnabled: Boolean(sendCryptoExternalProviderEnabled)
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
            <div style={{ fontWeight: 700 }}>Crypto Send</div>
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
