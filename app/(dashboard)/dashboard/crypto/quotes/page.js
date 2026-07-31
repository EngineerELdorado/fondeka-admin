'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const CRYPTO_WARNING_FALLBACK_MESSAGE =
  'You are not yet allowed to perform crypto operations. Please contact customer service to enable it for your account.';

const isWarningMessageError = (err) => {
  const code = err?.data?.errorCode || err?.data?.code || err?.data?.name || '';
  return String(code).toUpperCase() === 'WARNING_MESSAGE';
};

const getWarningMessage = (err) => err?.data?.message || CRYPTO_WARNING_FALLBACK_MESSAGE;

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

const FALLBACK_FIAT_CURRENCY_OPTIONS = ['USD', 'CDF', 'KES', 'EUR', 'GBP'];
const CRYPTO_FROM_CURRENCY_OPTIONS = ['USDC', 'BNB', 'SOL', 'BTC', 'ETH', 'USDT', 'EURC'];
const TO_CURRENCY_OPTIONS = ['USDC', 'BNB', 'SOL', 'BTC', 'ETH', 'USDT', 'EURC'];

const normalizeList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.content)) return response.content;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const normalizeCurrency = (value) => String(value || '').trim().toUpperCase();

const hasPositiveRate = (value) => {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0;
};

const hasUsdFxRate = (item) => {
  const currency = normalizeCurrency(item?.currency);
  const baseCurrency = normalizeCurrency(item?.baseCurrency || 'USD');
  return currency === 'USD' || (baseCurrency === 'USD' && hasPositiveRate(item?.rate));
};

const sortCurrencyOptions = (codes) => (
  Array.from(new Set(codes.map(normalizeCurrency).filter(Boolean))).sort((left, right) => {
    if (left === 'USD') return -1;
    if (right === 'USD') return 1;
    return left.localeCompare(right);
  })
);

export default function CryptoQuotesPage() {
  const [fromPreset, setFromPreset] = useState('USD');
  const [fromCustom, setFromCustom] = useState('');
  const [toPreset, setToPreset] = useState('USDT');
  const [toCustom, setToCustom] = useState('');
  const [amount, setAmount] = useState('100.00');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [currencyProducts, setCurrencyProducts] = useState([]);
  const [currencyProductsError, setCurrencyProductsError] = useState(null);

  const fiatCurrencyOptions = useMemo(() => {
    const activeProductCurrencies = normalizeList(currencyProducts)
      .filter((item) => item?.active !== false && hasUsdFxRate(item))
      .map((item) => item?.currency);
    return sortCurrencyOptions(activeProductCurrencies.length ? activeProductCurrencies : FALLBACK_FIAT_CURRENCY_OPTIONS);
  }, [currencyProducts]);

  const fromCurrencyOptions = useMemo(
    () => sortCurrencyOptions([...fiatCurrencyOptions, ...CRYPTO_FROM_CURRENCY_OPTIONS]),
    [fiatCurrencyOptions]
  );

  const fiatCurrencySummary = fiatCurrencyOptions.join(', ');

  useEffect(() => {
    const fetchCurrencyProducts = async () => {
      setCurrencyProductsError(null);
      try {
        const res = await api.currencyProducts.list(new URLSearchParams({ page: '0', size: '500' }));
        setCurrencyProducts(normalizeList(res));
      } catch (err) {
        setCurrencyProductsError(err.message || 'Failed to load currency products.');
        setCurrencyProducts([]);
      }
    };

    fetchCurrencyProducts();
  }, []);

  const fetchQuote = async () => {
    const from = normalizeCurrency(fromPreset === 'OTHER' ? fromCustom : fromPreset);
    const to = normalizeCurrency(toPreset === 'OTHER' ? toCustom : toPreset);
    const rawAmount = amount.trim();

    if (!from || !to || !rawAmount) {
      setError('Enter from/to currency and amount.');
      return;
    }

    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const res = await api.cryptoQuotes.quote({ fromCurrency: from, toCurrency: to, amount: rawAmount });
      setQuote(res || null);
    } catch (err) {
      if (isWarningMessageError(err)) {
        setWarning(getWarningMessage(err));
      } else {
        setError(err.message || 'Failed to fetch quote');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Crypto Quotes</div>
          <div style={{ color: 'var(--muted)' }}>
            Crypto quotes support any active fiat currency with a configured FX rate. Test quotes from {fiatCurrencySummary || 'enabled fiat currencies'} to supported crypto assets such as USDT, USDC, BTC, and ETH.
          </div>
        </div>
        <Link href="/dashboard/crypto" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Crypto hub
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="fromCurrency">From currency</label>
          <select id="fromCurrency" value={fromPreset} onChange={(e) => setFromPreset(e.target.value)}>
            {fromCurrencyOptions.map((code) => (
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
        <div style={{ gridColumn: '1 / -1', color: 'var(--muted)', fontSize: '13px' }}>
          Try quoting from other fiat currencies to crypto too, for example CDF -&gt; USDT, KES -&gt; USDT, or EUR -&gt; BTC, as long as the fiat currency is active and has a valid USD FX rate.
          {fiatCurrencySummary ? ` Current fiat options: ${fiatCurrencySummary}.` : ''}
          {currencyProductsError ? ` Currency product options could not be loaded: ${currencyProductsError}` : ''}
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {warning && <div className="card" style={{ color: '#b45309', fontWeight: 700 }}>{warning}</div>}

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
