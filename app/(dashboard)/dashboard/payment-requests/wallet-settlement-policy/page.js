'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const modeOptions = [
  {
    value: 'REQUEST_CURRENCY',
    label: 'Request currency',
    description: 'Owner receives money in the currency they created the payment request in. Default and safest.'
  },
  {
    value: 'PAYER_CURRENCY',
    label: 'Payer currency',
    description: 'Owner receives money in the currency the payer used.'
  }
];

const modeLabel = (value) => modeOptions.find((option) => option.value === value)?.label || value || '-';

export default function WalletSettlementPolicyPage() {
  const [policy, setPolicy] = useState(null);
  const [mode, setMode] = useState('REQUEST_CURRENCY');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const loadPolicy = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.paymentRequests.walletSettlementPolicy.get();
      setPolicy(res || null);
      setMode(res?.mode || res?.defaultMode || 'REQUEST_CURRENCY');
    } catch (err) {
      setError(err?.message || 'Failed to load wallet settlement policy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicy();
  }, []);

  const savePolicy = async () => {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.paymentRequests.walletSettlementPolicy.update({ mode });
      setPolicy(res || { ...(policy || {}), mode });
      setMode(res?.mode || mode);
      setInfo(`Wallet settlement currency saved as ${modeLabel(res?.mode || mode)}.`);
    } catch (err) {
      setError(err?.message || 'Failed to save wallet settlement policy.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Wallet Settlement Currency</div>
          <div style={{ color: 'var(--muted)' }}>Global policy for wallet-funded payment request settlement currency.</div>
        </div>
        <Link href="/dashboard/payment-requests" className="btn-neutral">Payment Requests hub</Link>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <div className="card" style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800 }}>Global setting</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Account custom caps can override this per account. If backend config is missing or invalid, backend falls back to Request currency.
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {modeOptions.map((option) => (
            <label
              key={option.value}
              style={{
                display: 'grid',
                gap: '0.2rem',
                padding: '0.85rem',
                border: `1px solid ${mode === option.value ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '10px',
                background: mode === option.value ? 'var(--accent-soft)' : 'transparent',
                cursor: 'pointer'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                <input type="radio" name="walletSettlementCurrencyMode" value={option.value} checked={mode === option.value} onChange={(e) => setMode(e.target.value)} />
                {option.label}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: '13px' }}>{option.description}</span>
              <code style={{ color: 'var(--muted)', fontSize: '12px' }}>{option.value}</code>
            </label>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
          <div style={{ padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <div style={{ color: 'var(--muted)', fontSize: '12px', textTransform: 'uppercase' }}>Current mode</div>
            <div style={{ fontWeight: 800 }}>{modeLabel(policy?.mode || mode)}</div>
          </div>
          <div style={{ padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <div style={{ color: 'var(--muted)', fontSize: '12px', textTransform: 'uppercase' }}>Default mode</div>
            <div style={{ fontWeight: 800 }}>{modeLabel(policy?.defaultMode || 'REQUEST_CURRENCY')}</div>
          </div>
          <div style={{ padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <div style={{ color: 'var(--muted)', fontSize: '12px', textTransform: 'uppercase' }}>Config key</div>
            <div style={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{policy?.configKey || 'payment_request_wallet_settlement_currency_mode'}</div>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-neutral" onClick={loadPolicy} disabled={loading || saving}>
            {loading ? 'Loading...' : 'Reload'}
          </button>
          <button type="button" className="btn-primary" onClick={savePolicy} disabled={loading || saving}>
            {saving ? 'Saving...' : 'Save policy'}
          </button>
        </div>
      </div>
    </div>
  );
}
