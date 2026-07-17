'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

const defaultDraft = { currency: 'KES', amount: '1000' };
const defaultBankCodeFilters = { country: '' };

const RawJson = ({ title, data }) => (
  <div className="card" style={{ display: 'grid', gap: '0.5rem' }}>
    <div style={{ fontWeight: 800 }}>{title}</div>
    <pre
      style={{
        margin: 0,
        padding: '0.85rem',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        overflow: 'auto',
        maxHeight: '360px',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontSize: '12px',
        lineHeight: 1.45
      }}
    >
      {data === null || data === undefined ? 'No response yet.' : JSON.stringify(data, null, 2)}
    </pre>
  </div>
);

const collectCurrencyCodes = (value, out = new Set()) => {
  if (!value) return out;
  if (typeof value === 'string') {
    const trimmed = value.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(trimmed)) out.add(trimmed);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectCurrencyCodes(item, out));
    return out;
  }
  if (typeof value === 'object') {
    ['code', 'currency', 'currencyCode', 'isoCode', 'name'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) collectCurrencyCodes(value[key], out);
    });
    ['data', 'currencies', 'supportedCurrencies', 'items', 'results'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) collectCurrencyCodes(value[key], out);
    });
  }
  return out;
};

const extractBankCodes = (response) => {
  const data = response?.providerResponse?.data || response?.data || [];
  return Array.isArray(data) ? data : [];
};

export default function MapleradSandboxPage() {
  const [draft, setDraft] = useState(defaultDraft);
  const [bankCodeFilters, setBankCodeFilters] = useState(defaultBankCodeFilters);
  const [currenciesResponse, setCurrenciesResponse] = useState(null);
  const [bankCodesResponse, setBankCodesResponse] = useState(null);
  const [creditResponse, setCreditResponse] = useState(null);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [loadingBankCodes, setLoadingBankCodes] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const currencies = useMemo(() => {
    const list = Array.from(collectCurrencyCodes(currenciesResponse)).sort();
    return list.length ? list : ['KES', 'USD', 'GHS'];
  }, [currenciesResponse]);

  const bankCodes = useMemo(() => extractBankCodes(bankCodesResponse), [bankCodesResponse]);

  const refreshCurrencies = useCallback(async () => {
    setLoadingCurrencies(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.maplerad.currencies();
      setCurrenciesResponse(res);
      const nextCurrencies = Array.from(collectCurrencyCodes(res)).sort();
      if (nextCurrencies.length && !nextCurrencies.includes(String(draft.currency || '').toUpperCase())) {
        setDraft((prev) => ({ ...prev, currency: nextCurrencies[0] }));
      }
      setInfo('Loaded Maplerad currencies.');
    } catch (err) {
      setError(err?.message || 'Failed to load Maplerad currencies.');
    } finally {
      setLoadingCurrencies(false);
    }
  }, [draft.currency]);

  useEffect(() => {
    refreshCurrencies();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshBankCodes = async () => {
    const country = String(bankCodeFilters.country || '').trim().toUpperCase();
    if (country && !/^[A-Z]{2}$/.test(country)) {
      setError('Country must be a 2-letter uppercase ISO country code.');
      setInfo(null);
      return;
    }
    setLoadingBankCodes(true);
    setError(null);
    setInfo(null);
    try {
      const params = country ? new URLSearchParams({ country }) : undefined;
      const res = await api.maplerad.bankCodes(params);
      setBankCodesResponse(res);
      setBankCodeFilters((prev) => ({ ...prev, country }));
      setInfo(`Loaded Maplerad bank codes${country ? ` for ${country}` : ''}.`);
    } catch (err) {
      setBankCodesResponse(err?.data || null);
      setError(err?.message || 'Failed to load Maplerad bank codes.');
    } finally {
      setLoadingBankCodes(false);
    }
  };

  const validateDraft = () => {
    const amount = Number(draft.amount);
    const currency = String(draft.currency || '').trim().toUpperCase();
    if (!currency) return 'Currency is required.';
    if (!/^[A-Z]{3}$/.test(currency)) return 'Currency must be a 3-letter uppercase ISO code.';
    if (!Number.isInteger(amount) || amount <= 0) return 'Amount must be a positive integer.';
    return null;
  };

  const creditSandboxWallet = async () => {
    const message = validateDraft();
    if (message) {
      setError(message);
      setInfo(null);
      return;
    }
    setCrediting(true);
    setError(null);
    setInfo(null);
    setCreditResponse(null);
    try {
      const payload = {
        amount: Number(draft.amount),
        currency: String(draft.currency || '').trim().toUpperCase()
      };
      const res = await api.maplerad.creditSandboxWallet(payload);
      setCreditResponse(res);
      setInfo(`Credited Maplerad sandbox wallet with ${payload.amount} ${payload.currency}.`);
    } catch (err) {
      setCreditResponse(err?.data || null);
      setError(err?.status === 403 ? 'Rejected by backend: configured Maplerad key is not a sandbox key.' : err?.message || 'Failed to credit Maplerad sandbox wallet.');
    } finally {
      setCrediting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Providers &gt; Maplerad &gt; Sandbox</div>
          <div style={{ color: 'var(--muted)' }}>Credit the Maplerad sandbox wallet and inspect provider currency responses for QA.</div>
        </div>
        <Link href="/dashboard" className="btn-neutral">
          {'<- Dashboard'}
        </Link>
      </div>

      <div className="card" style={{ color: 'var(--muted)', background: 'var(--surface)', borderColor: 'var(--border)', fontSize: '13px', lineHeight: 1.5 }}>
        Sandbox-only tool. The backend rejects this action with 403 when the configured MAPLERAD_SECRET_KEY is not a sandbox key.
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800 }}>Currencies</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Fetch supported currencies from Maplerad and use them in the credit form.</div>
          </div>
          <button type="button" onClick={refreshCurrencies} disabled={loadingCurrencies || crediting} className="btn-primary">
            {loadingCurrencies ? 'Refreshing...' : 'Refresh currencies'}
          </button>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800 }}>Bank codes / institutions</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Fetch Maplerad institution codes, optionally narrowed by country.</div>
          </div>
          <button type="button" onClick={refreshBankCodes} disabled={loadingBankCodes || crediting} className="btn-primary">
            {loadingBankCodes ? 'Refreshing...' : 'Refresh bank codes'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="bankCodeCountry">Country</label>
            <input
              id="bankCodeCountry"
              value={bankCodeFilters.country}
              onChange={(e) => setBankCodeFilters((prev) => ({ ...prev, country: e.target.value.toUpperCase() }))}
              placeholder="KE"
              maxLength={2}
            />
          </div>
        </div>
        {bankCodes.length > 0 && (
          <div className="table-scroll" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.65rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Code</th>
                  <th style={{ textAlign: 'left', padding: '0.65rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Name</th>
                  <th style={{ textAlign: 'left', padding: '0.65rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Country</th>
                </tr>
              </thead>
              <tbody>
                {bankCodes.map((bankCode, index) => (
                  <tr key={`${bankCode.code || index}-${bankCode.country || ''}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.65rem', fontWeight: 700 }}>{bankCode.code || '-'}</td>
                    <td style={{ padding: '0.65rem' }}>{bankCode.name || '-'}</td>
                    <td style={{ padding: '0.65rem' }}>{bankCode.country || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.85rem' }}>
        <div>
          <div style={{ fontWeight: 800 }}>Credit sandbox wallet</div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Amount must be a positive integer. Currency can be selected or typed as an uppercase ISO code.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="currency">Currency</label>
            <input
              id="currency"
              list="mapleradCurrencies"
              value={draft.currency}
              onChange={(e) => setDraft((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
            />
            <datalist id="mapleradCurrencies">
              {currencies.map((currency) => (
                <option key={currency} value={currency} />
              ))}
            </datalist>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              type="number"
              min={1}
              step={1}
              value={draft.amount}
              onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={creditSandboxWallet} disabled={crediting || loadingCurrencies} className="btn-success">
            {crediting ? 'Crediting...' : 'Credit sandbox wallet'}
          </button>
        </div>
      </div>

      <RawJson title="Currencies provider response" data={currenciesResponse} />
      <RawJson title="Bank codes provider response" data={bankCodesResponse} />
      <RawJson title="Credit provider response" data={creditResponse} />
    </div>
  );
}
