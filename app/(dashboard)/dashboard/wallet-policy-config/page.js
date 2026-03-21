'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const MIN_COOLDOWN = 1;
const MAX_COOLDOWN = 1440;

export default function WalletPolicyConfigPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [cooldown, setCooldown] = useState('');

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.walletPolicyConfig.get();
      const value = res?.interTransferCooldownMinutes;
      setCooldown(value === null || value === undefined ? '' : String(value));
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
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.walletPolicyConfig.update({ interTransferCooldownMinutes: parsed });
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
