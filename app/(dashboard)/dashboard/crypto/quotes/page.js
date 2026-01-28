'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700 }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

const FROM_CURRENCY_OPTIONS = ['USD', 'USDC', 'BNB', 'SOL', 'BTC', 'ETH', 'USDT', 'EURC'];
const TO_CURRENCY_OPTIONS = ['USDC', 'BNB', 'SOL', 'BTC', 'ETH', 'USDT', 'EURC'];

export default function CryptoQuotesPage() {
  const [fromPreset, setFromPreset] = useState('USD');
  const [fromCustom, setFromCustom] = useState('');
  const [toPreset, setToPreset] = useState('USDT');
  const [toCustom, setToCustom] = useState('');
  const [amount, setAmount] = useState('100.00');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchQuote = async () => {
    const from = (fromPreset === 'OTHER' ? fromCustom : fromPreset).trim();
    const to = (toPreset === 'OTHER' ? toCustom : toPreset).trim();
    const rawAmount = amount.trim();

    if (!from || !to || !rawAmount) {
      setError('Enter from/to currency and amount.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.cryptoQuotes.quote({ fromCurrency: from, toCurrency: to, amount: rawAmount });
      setQuote(res || null);
    } catch (err) {
      setError(err.message || 'Failed to fetch quote');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Crypto Quotes</div>
          <div style={{ color: 'var(--muted)' }}>Get a live quote to know the target amount before sending.</div>
        </div>
        <Link href="/dashboard/crypto" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Crypto hub
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="fromCurrency">From currency</label>
          <select id="fromCurrency" value={fromPreset} onChange={(e) => setFromPreset(e.target.value)}>
            {FROM_CURRENCY_OPTIONS.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
            <option value="OTHER">Other…</option>
          </select>
          {fromPreset === 'OTHER' && (
            <input
              aria-label="From currency (custom)"
              value={fromCustom}
              onChange={(e) => setFromCustom(e.target.value)}
              placeholder="Enter currency"
            />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="toCurrency">To currency</label>
          <select id="toCurrency" value={toPreset} onChange={(e) => setToPreset(e.target.value)}>
            {TO_CURRENCY_OPTIONS.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
            <option value="OTHER">Other…</option>
          </select>
          {toPreset === 'OTHER' && (
            <input
              aria-label="To currency (custom)"
              value={toCustom}
              onChange={(e) => setToCustom(e.target.value)}
              placeholder="Enter currency"
            />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="amount">Amount (from currency)</label>
          <input id="amount" type="number" min="0" step="0.00000001" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100.00" />
        </div>
        <button type="button" onClick={fetchQuote} className="btn-primary" disabled={loading}>
          {loading ? 'Quoting…' : 'Get quote'}
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}

      {quote && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontWeight: 800 }}>Quote result</div>
          <DetailGrid
            rows={[
              { label: 'Requested amount', value: quote?.requestedAmount },
              { label: 'Net amount (send)', value: quote?.netAmount },
              { label: 'Exchange rate', value: quote?.exchangeRate },
              { label: 'Valid until', value: quote?.validUntil },
              { label: 'Quote ID', value: quote?.quoteId }
            ]}
          />
        </div>
      )}
    </div>
  );
}
