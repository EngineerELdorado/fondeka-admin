'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const DEFAULT_USER_MESSAGE = 'We are temporarily processing USD transactions only. Please convert your balance to USD and try again.';
const ACTION_OPTIONS = [
  'BONUS',
  'BUY_CARD',
  'BUY_CRYPTO',
  'BUY_GIFT_CARD',
  'CARD_ONLINE_PAYMENT',
  'CARD_ONLINE_TRANSACTION',
  'CARD_PAYMENT_REVERSAL',
  'CONVERT_FIAT',
  'E_SIM_PURCHASE',
  'E_SIM_TOPUP',
  'FUND_CARD',
  'FUND_WALLET',
  'GROUP_SAVING_CONTRIBUTION',
  'GROUP_SAVING_PAYOUT',
  'GROUP_SAVING_ROUND_DISTRIBUTION',
  'INTER_TRANSFER',
  'LOAN_DISBURSEMENT',
  'LOAN_REQUEST',
  'OTHER',
  'PAY_ELECTRICITY_BILL',
  'PAY_INTERNET_BILL',
  'PAY_NETFLIX',
  'PAY_REQUEST',
  'PAY_TV_SUBSCRIPTION',
  'PAY_WATER_BILL',
  'PERSONAL_SAVING_DEPOSIT',
  'PERSONAL_SAVING_INTEREST_PAYOUT',
  'PERSONAL_SAVING_WITHDRAWAL',
  'RECEIVE_CRYPTO',
  'REFUND_TO_WALLET',
  'REPAY_LOAN',
  'REQUEST_PAYMENT',
  'SELL_CRYPTO',
  'SEND_AIRTIME',
  'SEND_CRYPTO',
  'SEND_DATA_BUNDLES',
  'SETTLEMENT',
  'SWAP_CRYPTO',
  'WITHDRAW_FROM_CARD',
  'WITHDRAW_FROM_WALLET'
].sort();

const normalizeActions = (actions) => {
  if (!Array.isArray(actions)) return [];
  return [...new Set(actions.map((action) => String(action || '').trim().toUpperCase()).filter(Boolean))].sort();
};

const sameActions = (left, right) => {
  const a = normalizeActions(left);
  const b = normalizeActions(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

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
  const [draftAllowedActions, setDraftAllowedActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [confirmEnable, setConfirmEnable] = useState(false);
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState(false);
  const [actionSearch, setActionSearch] = useState('');

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.currencyCircuitBreaker.get();
      setConfig(res || null);
      setDraftBlocked(Boolean(res?.nonUsdTransactionsBlocked));
      setDraftAllowedActions(normalizeActions(res?.allowedActions));
      setConfirmEnable(false);
      setActionsDropdownOpen(false);
      setActionSearch('');
    } catch (err) {
      setError(err?.message || 'Failed to load currency circuit breaker');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async ({ nextBlocked = draftBlocked, nextAllowedActions = draftAllowedActions, includeBlocked = true, includeAllowedActions = false } = {}) => {
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
      const payload = {};
      if (includeBlocked) payload.nonUsdTransactionsBlocked = Boolean(nextBlocked);
      if (includeAllowedActions) payload.allowedActions = normalizeActions(nextAllowedActions);
      const res = await api.currencyCircuitBreaker.update(payload);
      const nextConfig = res || {
        ...(config || {}),
        ...(includeBlocked ? { nonUsdTransactionsBlocked: Boolean(nextBlocked) } : {}),
        ...(includeAllowedActions ? { allowedActions: normalizeActions(nextAllowedActions) } : {})
      };
      setConfig(nextConfig);
      setDraftBlocked(Boolean(nextConfig.nonUsdTransactionsBlocked));
      setDraftAllowedActions(normalizeActions(nextConfig.allowedActions));
      setConfirmEnable(false);
      setActionsDropdownOpen(false);
      setActionSearch('');
      setInfo(includeAllowedActions && includeBlocked
        ? `Non-USD transaction circuit breaker ${nextConfig.nonUsdTransactionsBlocked ? 'enabled' : 'disabled'} and exceptions updated.`
        : includeAllowedActions
          ? 'Allowed action exceptions updated.'
          : `Non-USD transaction circuit breaker ${nextConfig.nonUsdTransactionsBlocked ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      setError(err?.message || 'Failed to update currency circuit breaker');
      setDraftBlocked(Boolean(config?.nonUsdTransactionsBlocked));
      setDraftAllowedActions(normalizeActions(config?.allowedActions));
    } finally {
      setSaving(false);
    }
  };

  const currentBlocked = Boolean(config?.nonUsdTransactionsBlocked);
  const currentAllowedActions = normalizeActions(config?.allowedActions);
  const actionOptions = normalizeActions([...ACTION_OPTIONS, ...currentAllowedActions]);
  const filteredActionOptions = actionOptions.filter((action) => action.includes(String(actionSearch || '').trim().toUpperCase()));
  const hasBreakerChanged = draftBlocked !== currentBlocked;
  const hasAllowedActionsChanged = !sameActions(draftAllowedActions, currentAllowedActions);
  const userMessage = config?.userMessage || DEFAULT_USER_MESSAGE;
  const toggleAllowedAction = (action, checked) => {
    const normalized = String(action || '').trim().toUpperCase();
    setDraftAllowedActions((prev) => {
      const next = checked ? [...prev, normalized] : prev.filter((item) => item !== normalized);
      return normalizeActions(next);
    });
  };

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
                ? 'Enabled: non-USD fiat transactions are blocked unless the action is selected below. Conversion into USD is always allowed.'
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
              When enabled, non-USD transactions are blocked unless their action is selected below. Fiat conversion to USD is always allowed.
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
              if (!checked && currentBlocked) save({ nextBlocked: false, includeBlocked: true });
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
              <button
                type="button"
                className="btn-danger"
                onClick={() => save({ nextBlocked: true, includeBlocked: true, includeAllowedActions: hasAllowedActionsChanged })}
                disabled={saving}
              >
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

        <div style={{ display: 'grid', gap: '0.65rem' }}>
          <div style={{ display: 'grid', gap: '0.2rem' }}>
            <div style={{ fontWeight: 800 }}>Allowed actions during maintenance</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Exceptions are action-based, not currency-based. Unknown or unresolved actions remain blocked for safety.
            </div>
          </div>
          <div style={{ position: 'relative', display: 'grid', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn-neutral"
              onClick={() => setActionsDropdownOpen((prev) => !prev)}
              disabled={loading || saving}
              aria-expanded={actionsDropdownOpen}
              aria-controls="allowed-actions-dropdown"
              style={{ justifyContent: 'space-between', display: 'inline-flex', alignItems: 'center', width: 'min(100%, 420px)' }}
            >
              <span>{draftAllowedActions.length ? `${draftAllowedActions.length} action${draftAllowedActions.length === 1 ? '' : 's'} selected` : 'Select allowed actions'}</span>
              <span aria-hidden="true">{actionsDropdownOpen ? '^' : 'v'}</span>
            </button>

            {draftAllowedActions.length > 0 ? (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {draftAllowedActions.map((action) => (
                  <span key={action} className="pill" style={{ background: 'var(--accent-soft)', color: 'var(--text)' }}>
                    {action}
                    <button
                      type="button"
                      onClick={() => toggleAllowedAction(action, false)}
                      disabled={loading || saving}
                      style={{ border: 'none', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', padding: 0, fontWeight: 900 }}
                      aria-label={`Remove ${action}`}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            {actionsDropdownOpen && (
              <div
                id="allowed-actions-dropdown"
                style={{
                  position: 'absolute',
                  top: '44px',
                  left: 0,
                  zIndex: 20,
                  width: 'min(100%, 520px)',
                  maxHeight: '340px',
                  overflow: 'auto',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  background: 'var(--surface)',
                  boxShadow: 'var(--shadow)',
                  display: 'grid',
                  gap: '0.55rem'
                }}
              >
                <input
                  value={actionSearch}
                  onChange={(event) => setActionSearch(event.target.value)}
                  placeholder="Search actions"
                  autoFocus
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-neutral btn-sm" onClick={() => setDraftAllowedActions(actionOptions)} disabled={loading || saving}>
                    Select all
                  </button>
                  <button type="button" className="btn-neutral btn-sm" onClick={() => setDraftAllowedActions([])} disabled={loading || saving || draftAllowedActions.length === 0}>
                    Clear
                  </button>
                </div>
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  {filteredActionOptions.length ? filteredActionOptions.map((action) => (
                    <label
                      key={action}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        padding: '0.45rem 0.35rem',
                        color: 'var(--text)',
                        margin: 0
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={draftAllowedActions.includes(action)}
                        disabled={loading || saving}
                        onChange={(event) => toggleAllowedAction(action, event.target.checked)}
                        style={{ width: 'auto' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>{action}</span>
                    </label>
                  )) : (
                    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>No actions match this search.</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => save({ includeBlocked: false, includeAllowedActions: true })}
              disabled={loading || saving || !hasAllowedActionsChanged}
            >
              {saving ? 'Saving...' : 'Save exceptions'}
            </button>
            <button
              type="button"
              className="btn-neutral"
              onClick={() => setDraftAllowedActions([])}
              disabled={loading || saving || draftAllowedActions.length === 0}
            >
              Clear exceptions
            </button>
            <button
              type="button"
              className="btn-neutral"
              onClick={() => setDraftAllowedActions(currentAllowedActions)}
              disabled={saving || !hasAllowedActionsChanged}
            >
              Reset exceptions
            </button>
          </div>
        </div>

        {!confirmEnable && hasBreakerChanged && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => save({ nextBlocked: draftBlocked, includeBlocked: true, includeAllowedActions: hasAllowedActionsChanged })}
              disabled={loading || saving}
            >
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
              <li>Non-USD transactions whose action is selected in the exception list.</li>
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
          <div><strong style={{ color: 'var(--text)' }}>Allowed actions config key:</strong> {config?.allowedActionsConfigKey || 'currency.non_usd_transactions_allowed_actions'}</div>
          <div><strong style={{ color: 'var(--text)' }}>Allowed actions:</strong> {currentAllowedActions.length ? currentAllowedActions.join(', ') : 'None'}</div>
          <div><strong style={{ color: 'var(--text)' }}>Message code:</strong> {config?.userMessageCode || 'currency.circuit_breaker.non_usd_blocked'}</div>
          <div><strong style={{ color: 'var(--text)' }}>User message:</strong> {userMessage}</div>
        </div>
      </div>
    </div>
  );
}
