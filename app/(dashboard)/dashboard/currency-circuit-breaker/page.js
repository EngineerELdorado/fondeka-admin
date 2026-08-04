'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const DEFAULT_USER_MESSAGE = 'We are temporarily processing USD transactions only. Please convert your balance to USD and try again.';

const StatusBadge = ({ blocked }) => {
  const enabled = Boolean(blocked);
  return (
    <span className={`pill ${enabled ? 'pill-danger' : 'pill-success'}`}>
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
};

export default function CurrencyCircuitBreakerPage() {
  const [config, setConfig] = useState(null);
  const [draftBlocked, setDraftBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [confirmEnable, setConfirmEnable] = useState(false);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.currencyCircuitBreaker.get();
      setConfig(res || null);
      setDraftBlocked(Boolean(res?.nonUsdTransactionsBlocked));
      setConfirmEnable(false);
    } catch (err) {
      setError(err?.message || 'Failed to load currency circuit breaker');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (nextBlocked) => {
    if (nextBlocked && !confirmEnable) {
      setDraftBlocked(true);
      setConfirmEnable(true);
      setInfo(null);
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.currencyCircuitBreaker.update({
        nonUsdTransactionsBlocked: Boolean(nextBlocked)
      });
      const nextConfig = res || { ...(config || {}), nonUsdTransactionsBlocked: Boolean(nextBlocked) };
      setConfig(nextConfig);
      setDraftBlocked(Boolean(nextConfig.nonUsdTransactionsBlocked));
      setConfirmEnable(false);
      setInfo(`Non-USD transaction circuit breaker ${nextConfig.nonUsdTransactionsBlocked ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      setError(err?.message || 'Failed to update currency circuit breaker');
      setDraftBlocked(Boolean(config?.nonUsdTransactionsBlocked));
    } finally {
      setSaving(false);
    }
  };

  const currentBlocked = Boolean(config?.nonUsdTransactionsBlocked);
  const hasChanged = draftBlocked !== currentBlocked;
  const userMessage = config?.userMessage || DEFAULT_USER_MESSAGE;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '980px' }}>
      <div className="card" style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 700 }}>Operations / Circuit Breakers / Currency Transactions</div>
        <div style={{ fontSize: '20px', fontWeight: 800 }}>Non-USD transaction circuit breaker</div>
        <div style={{ color: 'var(--muted)' }}>
          Emergency kill switch for multi-currency transaction risk. Use it during FX, margin, wallet, or provider incidents.
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <div className="card" style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <div style={{ fontWeight: 800 }}>Status</div>
            <div style={{ color: 'var(--muted)' }}>
              {currentBlocked
                ? 'Enabled: only USD transactions are allowed. Non-USD fiat transactions are blocked, except conversion into USD.'
                : 'Disabled: all supported currencies can transact normally.'}
            </div>
          </div>
          <StatusBadge blocked={currentBlocked} />
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '0.85rem',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            color: 'var(--text)'
          }}
        >
          <span style={{ display: 'grid', gap: '0.25rem' }}>
            <span style={{ fontWeight: 800 }}>Block non-USD transactions</span>
            <span style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 500 }}>
              Sends only `nonUsdTransactionsBlocked` to `PUT /admin-api/currency-circuit-breaker`.
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={draftBlocked}
            disabled={loading || saving}
            onChange={(event) => {
              const checked = event.target.checked;
              setDraftBlocked(checked);
              if (checked && !currentBlocked) {
                setConfirmEnable(true);
                return;
              }
              setConfirmEnable(false);
              if (!checked && currentBlocked) save(false);
            }}
            style={{ width: 'auto', minWidth: '20px', height: '20px' }}
          />
        </label>

        {confirmEnable && (
          <div style={{ display: 'grid', gap: '0.6rem', padding: '0.85rem', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.06)' }}>
            <div style={{ color: '#b91c1c', fontWeight: 800 }}>Confirm customer-impacting change</div>
            <div style={{ color: 'var(--text)' }}>
              This will immediately block customer transactions involving non-USD fiat currencies. Customers will still be able to convert balances into USD.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn-danger" onClick={() => save(true)} disabled={saving}>
                {saving ? 'Enabling...' : 'Enable breaker'}
              </button>
              <button
                type="button"
                className="btn-neutral"
                onClick={() => {
                  setDraftBlocked(currentBlocked);
                  setConfirmEnable(false);
                }}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!confirmEnable && hasChanged && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-primary" onClick={() => save(draftBlocked)} disabled={loading || saving}>
              {saving ? 'Saving...' : 'Save change'}
            </button>
            <button
              type="button"
              className="btn-neutral"
              onClick={() => {
                setDraftBlocked(currentBlocked);
                setConfirmEnable(false);
              }}
              disabled={saving}
            >
              Reset
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={loadConfig} disabled={loading || saving}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Customer behavior</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            <div style={{ color: '#b91c1c', fontWeight: 800 }}>Blocked when enabled</div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--muted)' }}>
              <li>Loan applications in CDF, KES, XOF, and other non-USD fiat currencies.</li>
              <li>Wallet deposits or withdrawals using non-USD fiat.</li>
              <li>USD wallet payouts to non-USD mobile money.</li>
              <li>Bill payment, airtime, eSIM, savings, card, payment request, or collection flows using non-USD fiat.</li>
              <li>Fiat conversion from USD to CDF, KES, or other non-USD fiat currencies.</li>
            </ul>
          </div>
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            <div style={{ color: '#15803d', fontWeight: 800 }}>Allowed when enabled</div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--muted)' }}>
              <li>USD wallet transactions.</li>
              <li>Crypto-only operations where no non-USD fiat is involved.</li>
              <li>Fiat conversion from CDF, KES, or other non-USD fiat currencies into USD.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.55rem' }}>
        <div style={{ fontWeight: 800 }}>Error contract</div>
        <div style={{ color: 'var(--muted)' }}>
          Blocked customer requests return `WARNING_MESSAGE`, so clients should show the backend message as an operational notice.
        </div>
        <div style={{ display: 'grid', gap: '0.35rem', color: 'var(--muted)', fontSize: '13px' }}>
          <div><strong style={{ color: 'var(--text)' }}>Config key:</strong> {config?.configKey || 'currency.non_usd_transactions_blocked'}</div>
          <div><strong style={{ color: 'var(--text)' }}>Message code:</strong> {config?.userMessageCode || 'currency.circuit_breaker.non_usd_blocked'}</div>
          <div><strong style={{ color: 'var(--text)' }}>User message:</strong> {userMessage}</div>
        </div>
      </div>
    </div>
  );
}
