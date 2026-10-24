'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const ENFORCEMENT_KEY = 'business_tools.access.enforced';
const normalizeGroups = (value) => Array.isArray(value)
  ? value.map((item) => String(item).trim().toUpperCase()).filter(Boolean)
  : typeof value === 'string' ? value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean) : [];
const pageContent = (response) => Array.isArray(response) ? response : response?.content || [];
const formatDateTime = (value) => value ? new Date(value).toLocaleString() : '—';
const formatEnum = (value) => String(value || '—').toLowerCase().split('_').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
const formatMoney = (amount, currency) => {
  if (amount === null || amount === undefined) return '—';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(Number(amount)); }
  catch { return `${amount} ${currency || ''}`.trim(); }
};
const badgeStyle = (active) => ({ display: 'inline-flex', padding: '0.2rem 0.55rem', borderRadius: '999px', fontWeight: 800, fontSize: '12px', background: active ? '#ECFDF3' : '#F3F4F6', color: active ? '#15803D' : '#4B5563' });

const Modal = ({ title, onClose, children }) => <div className="modal-backdrop"><div className="modal-surface"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}><strong>{title}</strong><button type="button" className="btn-neutral" onClick={onClose}>×</button></div>{children}</div></div>;

const CreditDetails = ({ details }) => {
  const sources = Array.isArray(details?.sources) ? details.sources : [];
  return <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.4rem', maxWidth: '620px' }}>
    <div style={{ fontSize: '12px' }}>Plan {formatMoney(details?.planAmount, details?.currency)} · Credit {formatMoney(details?.legacyCreditAmount, details?.currency)} · Due {formatMoney(details?.amountDue, details?.currency)}</div>
    {sources.length ? <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}><thead><tr>{['Transaction', 'Original', 'Credited'].map((label) => <th key={label} style={{ textAlign: 'left', padding: '0.3rem' }}>{label}</th>)}</tr></thead><tbody>{sources.map((source, index) => <tr key={`${source.transactionId}-${index}`}><td style={{ padding: '0.3rem' }}>{source.transactionId ? <Link href={`/dashboard/transactions?transactionId=${encodeURIComponent(source.transactionId)}`}>{source.transactionId}</Link> : '—'}</td><td style={{ padding: '0.3rem' }}>{formatMoney(source.originalAmount, source.originalCurrency)}</td><td style={{ padding: '0.3rem' }}>{formatMoney(source.creditedAmount, source.currency)}</td></tr>)}</tbody></table></div> : <div style={{ color: 'var(--muted)', fontSize: '11px' }}>No legacy credit sources.</div>}
  </div>;
};

export function BusinessToolsAccountPanel({ accountId }) {
  const { session } = useAuth();
  const [access, setAccess] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [purchasePage, setPurchasePage] = useState(0);
  const [purchasePages, setPurchasePages] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyPages, setHistoryPages] = useState(null);
  const [enforcement, setEnforcement] = useState({ global: null, override: null });
  const [expandedPurchases, setExpandedPurchases] = useState(new Set());
  const [expandedHistory, setExpandedHistory] = useState(new Set());
  const [sectionExpanded, setSectionExpanded] = useState(false);
  const [mutation, setMutation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const isSuperAdmin = useMemo(() => {
    const accessToken = session?.tokens?.accessToken?.payload || {};
    const idToken = session?.tokens?.idToken?.payload || {};
    return [...normalizeGroups(accessToken?.['cognito:groups'] || accessToken?.groups), ...normalizeGroups(idToken?.['cognito:groups'] || idToken?.groups)].includes('SUPER_ADMIN');
  }, [session]);

  const loadAccess = useCallback(async () => {
    if (!accountId) return;
    const response = await api.businessTools.accounts.getAccess(accountId);
    setAccess(response);
  }, [accountId]);

  const loadPurchases = useCallback(async () => {
    if (!accountId) return;
    const response = await api.businessTools.accounts.listPurchases(accountId, new URLSearchParams({ page: String(purchasePage), size: '10' }));
    setPurchases(pageContent(response));
    setPurchasePages(Number.isFinite(response?.totalPages) ? response.totalPages : null);
  }, [accountId, purchasePage]);

  const loadHistory = useCallback(async () => {
    if (!accountId) return;
    const response = await api.businessTools.accounts.listHistory(accountId, new URLSearchParams({ page: String(historyPage), size: '10' }));
    setHistory(pageContent(response));
    setHistoryPages(Number.isFinite(response?.totalPages) ? response.totalPages : null);
  }, [accountId, historyPage]);

  const loadEnforcement = useCallback(async () => {
    if (!accountId) return;
    const [flag, overrides] = await Promise.all([
      api.featureFlags.get(ENFORCEMENT_KEY).catch((err) => err?.status === 404 ? null : Promise.reject(err)),
      api.featureFlags.listOverrides(ENFORCEMENT_KEY).catch((err) => err?.status === 404 ? [] : Promise.reject(err))
    ]);
    const list = Array.isArray(overrides) ? overrides : [];
    const override = list.find((item) => String(item?.accountId ?? item?.account?.id) === String(accountId)) || null;
    setEnforcement({ global: flag, override });
  }, [accountId]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { await Promise.all([loadAccess(), loadPurchases(), loadHistory(), loadEnforcement()]); }
    catch (err) { setError(err?.message || 'Failed to load Business Tools access and payment data.'); }
    finally { setLoading(false); }
  }, [loadAccess, loadEnforcement, loadHistory, loadPurchases]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const openMutation = (type, purchase = null, toolAccess = null) => setMutation({
    type,
    purchase,
    tool: toolAccess?.tool || null,
    toolAccess,
    planCode: toolAccess?.plan?.code || access?.plan?.code || 'BUSINESS_TOOLS_LIFETIME',
    validUntil: '',
    reason: type === 'requirePayment' ? 'Require Business Tools payment' : '',
    acknowledged: false,
    error: ''
  });

  const submitMutation = async () => {
    const reason = mutation?.reason?.trim() || '';
    const showMutationError = (message) => {
      setError(message);
      setMutation((previous) => previous ? { ...previous, error: message } : previous);
    };
    if (reason.length < 3) return showMutationError('Enter a meaningful audit reason.');
    if (reason.length > 1000) return showMutationError('Reason must be 1,000 characters or fewer.');
    if (mutation.type !== 'requirePayment' && !mutation?.acknowledged) return showMutationError('Confirm that you reviewed the account and mutation effects.');
    if (mutation.type === 'grant' && mutation.validUntil && new Date(mutation.validUntil).getTime() <= Date.now()) return showMutationError('Grant expiry must be in the future.');
    setSaving(true);
    setError(null);
    setMutation((previous) => previous ? { ...previous, error: '' } : previous);
    setInfo(null);
    try {
      if (mutation.type === 'grant') {
        const payload = { planCode: mutation.planCode, validUntil: mutation.validUntil ? new Date(mutation.validUntil).toISOString() : null, reason };
        if (mutation.tool) await api.businessTools.accounts.grantTool(mutation.tool, { accountId }, payload);
        else await api.businessTools.accounts.grant(accountId, payload);
        setInfo(`${mutation.tool ? formatEnum(mutation.tool) : 'All Business Tools'} access granted. This is an admin grant, not a purchase or refund.`);
      } else if (mutation.type === 'requirePayment') {
        if (mutation.tool) await api.businessTools.accounts.requireToolPayment(mutation.tool, { accountId }, { reason });
        else await api.businessTools.accounts.requirePayment(accountId, { reason });
        setInfo(`${mutation.tool ? formatEnum(mutation.tool) : 'All-tools bundle'} payment is now required. No automatic charge, refund or data deletion occurred.`);
      } else if (mutation.type === 'revoke') {
        if (mutation.tool) await api.businessTools.accounts.revokeTool(mutation.tool, { accountId }, { reason });
        else await api.businessTools.accounts.revoke(accountId, { reason });
        setInfo(`${mutation.tool ? formatEnum(mutation.tool) : 'All Business Tools'} entitlement revoked. Business data and payment history were preserved.`);
      } else {
        await api.businessTools.reconcilePurchase(mutation.purchase.id, { reason });
        setInfo('Payment status reconciled from verified local transaction state. No new charge was submitted.');
      }
      setMutation(null);
      await refreshAll();
    } catch (err) {
      const message = `${err?.message || 'Business Tools operation failed.'} The operation was not retried automatically.`;
      setError(message);
      setMutation((previous) => previous ? { ...previous, error: message } : previous);
    } finally { setSaving(false); }
  };

  const pending = access?.pendingPurchase;
  const pricing = access?.pricing;
  const toolAccessRows = Array.isArray(access?.tools) ? access.tools : [];
  const fullPaymentReviewPurchase = purchases.find((purchase) => purchase?.failureCode === 'BUSINESS_TOOLS_FULL_PAYMENT_REQUIRED');
  const accountOverride = enforcement.override;
  const effectiveEnforcement = accountOverride?.enabled ?? enforcement.global?.enabled ?? false;

  return (
    <section id="business-tools-access" className="card" style={{ padding: '1rem', display: 'grid', gap: '0.9rem', scrollMarginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div><div style={{ fontWeight: 800, fontSize: '18px' }}>Business Tools — Access and payments</div><div style={{ color: 'var(--muted)', fontSize: '13px' }}>Account entitlement is separate from Business status/KYB, store verification and payment outcomes.</div></div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>{sectionExpanded ? <><Link href="/dashboard/businesses/plans" className="btn-neutral btn-sm" style={{ textDecoration: 'none' }}>Plans</Link><Link href="/dashboard/feature-flags" className="btn-neutral btn-sm" style={{ textDecoration: 'none' }}>Rollout flag</Link><button type="button" className="btn-neutral btn-sm" disabled={loading} onClick={refreshAll}>{loading ? 'Refreshing…' : 'Refresh'}</button></> : null}<button type="button" className="btn-neutral btn-sm" onClick={() => setSectionExpanded((value) => !value)}>{sectionExpanded ? 'Collapse' : 'Expand'}</button></div>
      </div>
      {sectionExpanded ? <>
      {error ? <div className="alert alert-error">{error}</div> : null}{info ? <div className="alert alert-success">{info}</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
        <div style={{ padding: '0.7rem', border: '1px solid var(--border)', borderRadius: '10px' }}><div style={{ color: 'var(--muted)', fontSize: '12px' }}>Entitlement decision</div><span style={badgeStyle(Boolean(access?.accessGranted))}>{access?.accessGranted ? 'Access granted' : 'Access not granted'}</span><div style={{ fontSize: '12px', marginTop: '0.25rem' }}>{formatEnum(access?.status)}</div></div>
        <div style={{ padding: '0.7rem', border: '1px solid var(--border)', borderRadius: '10px' }}><div style={{ color: 'var(--muted)', fontSize: '12px' }}>Validity</div><strong>{access?.accessGranted && !access?.validUntil ? 'Active, no expiry' : access?.validUntil ? `Until ${formatDateTime(access.validUntil)}` : 'No active validity'}</strong><div style={{ fontSize: '12px' }}>From {formatDateTime(access?.validFrom)}</div></div>
        <div style={{ padding: '0.7rem', border: '1px solid var(--border)', borderRadius: '10px' }}><div style={{ color: 'var(--muted)', fontSize: '12px' }}>Bundle offer</div><strong>{!access?.plan ? 'Not configured' : !access.plan.purchasesEnabled ? 'Purchases disabled' : Number(access.plan.amount) === 0 ? 'Active free offer' : 'Purchases enabled'}</strong><div style={{ fontSize: '12px' }}>{access?.plan?.name || 'No configured offer'}</div></div>
        <div style={{ padding: '0.7rem', border: '1px solid var(--border)', borderRadius: '10px' }}><div style={{ color: 'var(--muted)', fontSize: '12px' }}>Rollout enforcement</div><strong>{effectiveEnforcement ? 'Enforced' : 'Not enforced'}</strong><div style={{ fontSize: '12px' }}>{accountOverride ? `Account override: ${accountOverride.enabled ? 'ON' : 'OFF'}` : `Inherited global flag: ${enforcement.global?.enabled ? 'ON' : 'OFF'}`}</div></div>
      </div>
      <div style={{ padding: '0.7rem', borderRadius: '10px', background: 'var(--accent-soft)', fontSize: '13px' }}><strong>Pricing mode: {formatEnum(access?.pricingMode || 'BUNDLE')}</strong><div>Bundle pricing and access enforcement are separate settings. Existing bundle access remains compatible in either mode.</div></div>

      <div style={{ display: 'grid', gap: '0.55rem' }}><strong>Independent tools</strong>{toolAccessRows.length === 0 ? <div style={{ color: 'var(--muted)' }}>No per-tool access details returned by the backend.</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1180px' }}><thead><tr>{['Tool', 'Access', 'Source', 'Validity', 'Payment', 'Effective price', 'Price source', 'Amount due', 'Pending purchase', ''].map((label) => <th key={label} style={{ textAlign: 'left', padding: '0.45rem', borderBottom: '1px solid var(--border)' }}>{label}</th>)}</tr></thead><tbody>{toolAccessRows.map((tool) => <tr key={tool.tool} style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '0.45rem' }}><strong>{formatEnum(tool.tool)}</strong>{tool.purchaseNotice ? <div style={{ maxWidth: '240px', fontSize: '11px', color: 'var(--muted)' }}>{tool.purchaseNotice}</div> : null}</td><td style={{ padding: '0.45rem' }}><span style={badgeStyle(Boolean(tool.accessGranted))}>{tool.accessGranted ? 'Granted' : formatEnum(tool.status)}</span></td><td style={{ padding: '0.45rem' }}>{formatEnum(tool.accessSource)}</td><td style={{ padding: '0.45rem' }}>{tool.validUntil ? formatDateTime(tool.validUntil) : tool.accessGranted ? 'No expiry' : '—'}</td><td style={{ padding: '0.45rem' }}>{tool.paymentRequired ? <strong style={{ color: '#B91C1C' }}>Required by admin</strong> : 'Not required'}</td><td style={{ padding: '0.45rem' }}>{formatMoney(tool.pricing?.planAmount, tool.pricing?.currency)}{tool.free ? <div style={{ color: '#15803D', fontSize: '11px' }}>Free active offer</div> : null}</td><td style={{ padding: '0.45rem' }}>{formatEnum(tool.pricing?.priceSource)}</td><td style={{ padding: '0.45rem' }}>{formatMoney(tool.pricing?.amountDue, tool.pricing?.currency)}</td><td style={{ padding: '0.45rem' }}>{tool.pendingPurchase ? <>{tool.pendingPurchase.id}{tool.pendingPurchase.paymentTransactionId ? <div><Link href={`/dashboard/transactions?transactionId=${encodeURIComponent(tool.pendingPurchase.paymentTransactionId)}`}>Transaction {tool.pendingPurchase.paymentTransactionId}</Link></div> : null}</> : '—'}</td><td style={{ padding: '0.45rem' }}>{isSuperAdmin ? <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}><button type="button" className="btn-success btn-sm" onClick={() => openMutation('grant', null, tool)}>Grant</button><button type="button" className="btn-danger btn-sm" onClick={() => openMutation('revoke', null, tool)}>Revoke</button><button type="button" className="btn-danger btn-sm" title={Number(tool.pricing?.planAmount) <= 0 || tool.plan?.purchasesEnabled === false ? 'Require-payment needs an active positive effective price.' : ''} disabled={Boolean(tool.paymentRequired) || Number(tool.pricing?.planAmount) <= 0 || tool.plan?.purchasesEnabled === false} onClick={() => openMutation('requirePayment', null, tool)}>{tool.paymentRequired ? 'Payment required' : 'Require payment'}</button></div> : null}</td></tr>)}</tbody></table></div>}</div>
      {access?.paymentRequired ? <div style={{ padding: '0.75rem', border: '1px solid #DC2626', borderRadius: '10px', background: '#FEF2F2', color: '#991B1B' }}><strong>Payment required by admin</strong><div style={{ fontSize: '13px', marginTop: '0.2rem' }}>Previous store-creation payments cannot unlock access. A new completed Business Tools purchase or an explicit admin grant is required. This restriction applies even when rollout enforcement is disabled.</div></div> : null}
      {!effectiveEnforcement && !access?.accessGranted && !access?.paymentRequired ? <div style={{ padding: '0.7rem', borderRadius: '10px', background: 'var(--accent-soft)', fontSize: '13px' }}>Access is inactive, but the rollout flag currently indicates protected production operations are not enforced for this account.</div> : null}

      {pricing ? <div><strong>Pricing</strong><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.6rem', marginTop: '0.5rem' }}>
        {[['Business Tools price', pricing.planAmount], ['Amount due', pricing.amountDue]].map(([label, value]) => <div key={label} style={{ padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px' }}><div style={{ color: 'var(--muted)', fontSize: '12px' }}>{label}</div><strong>{formatMoney(value, pricing.currency)}</strong></div>)}
        <div style={{ padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px' }}><div style={{ color: 'var(--muted)', fontSize: '12px' }}>Payment processing fees</div><strong>See payment quote / transaction</strong></div>
      </div></div> : null}

      {pending ? <div style={{ padding: '0.75rem', border: '1px solid #F59E0B', borderRadius: '10px' }}><strong>Payment processing</strong><div>Purchase {pending.id}</div>{pending.paymentTransactionId ? <Link href={`/dashboard/transactions?transactionId=${encodeURIComponent(pending.paymentTransactionId)}`}>Transaction {pending.paymentTransactionId}</Link> : null}</div> : null}
      {fullPaymentReviewPurchase ? <div style={{ padding: '0.75rem', border: '1px solid #F59E0B', borderRadius: '10px', background: '#FFFBEB', color: '#92400E' }}><strong>Payment received — access requires review</strong><div style={{ fontSize: '13px', marginTop: '0.2rem' }}>Purchase {fullPaymentReviewPurchase.id} used historical store credit and cannot satisfy the later admin payment requirement. Review its payment and the approved support/refund path before asking the customer to pay again.</div></div> : null}
      {isSuperAdmin ? <div style={{ display: 'grid', gap: '0.4rem' }}><strong>Bundle / bulk controls</strong><div style={{ color: '#92400E', fontSize: '12px' }}>These controls affect the all-tools bundle. Prefer the tool-specific actions above when only one capability should change.</div><div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}><button type="button" className="btn-success" onClick={() => openMutation('grant')}>Grant all tools</button><button type="button" className="btn-danger" onClick={() => openMutation('revoke')}>Revoke all four tools</button><button type="button" className="btn-danger" disabled={Boolean(access?.paymentRequired)} onClick={() => openMutation('requirePayment')}>{access?.paymentRequired ? 'Bundle payment already required' : 'Require bundle payment'}</button></div></div> : <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Read only — Business Tools mutations require Super Admin.</div>}

      <div style={{ display: 'grid', gap: '0.55rem' }}><strong>Purchases</strong>{purchases.length === 0 ? <div style={{ color: 'var(--muted)' }}>No purchases.</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1060px' }}><thead><tr>{['Purchase', 'Tool', 'Status', 'Offer snapshot', 'Credit', 'New gross charge', 'Method', 'Transaction', 'Timeline', ''].map((label) => <th key={label} style={{ textAlign: 'left', padding: '0.45rem', borderBottom: '1px solid var(--border)' }}>{label}</th>)}</tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id} style={{ borderBottom: '1px solid var(--border)' }}><td style={{ padding: '0.45rem' }}>{purchase.id}</td><td style={{ padding: '0.45rem' }}>{formatEnum(purchase.tool || 'BUNDLE')}</td><td style={{ padding: '0.45rem' }}>{purchase.failureCode === 'BUSINESS_TOOLS_LEGACY_CREDIT_UNAVAILABLE' ? <span style={{ color: '#B45309', fontWeight: 700 }}>Payment received — access requires review</span> : formatEnum(purchase.status)}{purchase.failureCode && purchase.failureCode !== 'BUSINESS_TOOLS_LEGACY_CREDIT_UNAVAILABLE' ? <div style={{ fontSize: '11px' }}>{formatEnum(purchase.failureCode)}</div> : null}</td><td style={{ padding: '0.45rem' }}>{formatMoney(purchase.planAmount, purchase.planCurrency)}<div style={{ fontSize: '11px' }}>{formatEnum(purchase.billingMode)} · v{purchase.planVersion}</div></td><td style={{ padding: '0.45rem' }}>{formatMoney(purchase.legacyCreditAmount, purchase.planCurrency)}</td><td style={{ padding: '0.45rem' }}>{formatMoney(purchase.amount, purchase.currency)}<div style={{ fontSize: '11px' }}>Includes payment fees</div></td><td style={{ padding: '0.45rem' }}>{formatEnum(purchase.paymentMethodType)}</td><td style={{ padding: '0.45rem' }}>{purchase.paymentTransactionId ? <Link href={`/dashboard/transactions?transactionId=${encodeURIComponent(purchase.paymentTransactionId)}`}>{purchase.paymentTransactionId}</Link> : '—'}</td><td style={{ padding: '0.45rem' }}>Created {formatDateTime(purchase.createdAt)}<div style={{ fontSize: '11px' }}>Completed {formatDateTime(purchase.completedAt)}</div></td><td style={{ padding: '0.45rem' }}><div style={{ display: 'flex', gap: '0.35rem' }}><button type="button" className="btn-neutral btn-sm" onClick={() => setExpandedPurchases((previous) => { const next = new Set(previous); next.has(purchase.id) ? next.delete(purchase.id) : next.add(purchase.id); return next; })}>{expandedPurchases.has(purchase.id) ? 'Hide credit' : 'Credit details'}</button>{isSuperAdmin ? <button type="button" className="btn-neutral btn-sm" onClick={() => openMutation('reconcile', purchase)}>Reconcile payment status</button> : null}</div>{expandedPurchases.has(purchase.id) ? <CreditDetails details={purchase.legacyCreditDetails || {}} /> : null}</td></tr>)}</tbody></table></div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}><button type="button" className="btn-neutral btn-sm" disabled={purchasePage === 0} onClick={() => setPurchasePage((p) => p - 1)}>←</button><span>Page {purchasePage + 1}{purchasePages !== null ? ` of ${Math.max(1, purchasePages)}` : ''}</span><button type="button" className="btn-neutral btn-sm" disabled={purchasePages !== null ? purchasePage + 1 >= purchasePages : purchases.length < 10} onClick={() => setPurchasePage((p) => p + 1)}>→</button></div>
      </div>

      <div style={{ display: 'grid', gap: '0.55rem' }}><strong>Account Business Tools history</strong>{history.length === 0 ? <div style={{ color: 'var(--muted)' }}>No history events.</div> : history.map((event, index) => { const key = event.id || `${event.createdAt}-${index}`; return <div key={key} style={{ padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}><div><strong>{formatEnum(event.action)}</strong><div style={{ color: 'var(--muted)', fontSize: '12px' }}>{formatDateTime(event.createdAt)} · Actor: {event.actorReference || 'System / worker'}{event.purchaseId ? ` · Purchase ${event.purchaseId}` : ''}</div>{event.reason ? <div style={{ marginTop: '0.2rem' }}>{event.reason}</div> : null}</div><button type="button" className="btn-neutral btn-sm" onClick={() => setExpandedHistory((previous) => { const next = new Set(previous); next.has(key) ? next.delete(key) : next.add(key); return next; })}>{expandedHistory.has(key) ? 'Hide details' : 'Details'}</button></div>{expandedHistory.has(key) ? <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '11px' }}>{JSON.stringify(event.details || {}, null, 2)}</pre> : null}</div>; })}<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}><button type="button" className="btn-neutral btn-sm" disabled={historyPage === 0} onClick={() => setHistoryPage((p) => p - 1)}>←</button><span>Page {historyPage + 1}{historyPages !== null ? ` of ${Math.max(1, historyPages)}` : ''}</span><button type="button" className="btn-neutral btn-sm" disabled={historyPages !== null ? historyPage + 1 >= historyPages : history.length < 10} onClick={() => setHistoryPage((p) => p + 1)}>→</button></div></div>

      {mutation ? <Modal title={mutation.type === 'grant' ? 'Confirm access grant' : mutation.type === 'revoke' ? 'Confirm entitlement revocation' : mutation.type === 'requirePayment' ? 'Require Business Tools payment' : 'Confirm payment reconciliation'} onClose={() => saving ? null : setMutation(null)}><div style={{ display: 'grid', gap: '0.75rem' }}><div style={{ padding: '0.7rem', background: '#FFF7ED', color: '#92400E', borderRadius: '10px', fontSize: '13px' }}>{mutation.type === 'grant' ? 'This creates an ADMIN grant and can replace purchase-backed provenance. It does not create a purchase, payment or refund.' : mutation.type === 'revoke' ? `This is not an account suspension, refund or proactive ban. ${pending ? 'A pending payment exists and may grant access later.' : 'It preserves business data and credentials.'}` : mutation.type === 'requirePayment' ? 'This access will be blocked until a qualifying new Business Tools payment completes or an admin grants access. No automatic charge, refund or data deletion occurs.' : 'This checks verified local transaction state. It does not retry or resubmit a provider charge.'}</div>{mutation.tool ? <div style={{ padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px' }}><strong>Affected tool: {formatEnum(mutation.tool)}</strong><div style={{ fontSize: '12px' }}>Effective price: {formatMoney(mutation.toolAccess?.pricing?.planAmount, mutation.toolAccess?.pricing?.currency)} · Amount due: {formatMoney(mutation.toolAccess?.pricing?.amountDue, mutation.toolAccess?.pricing?.currency)} · Source: {formatEnum(mutation.toolAccess?.pricing?.priceSource)}</div></div> : <div style={{ color: '#92400E', fontSize: '12px' }}><strong>Affected scope: all four tools / bundle compatibility access.</strong></div>}{mutation.error ? <div className="alert alert-error">{mutation.error}</div> : null}{mutation.type === 'grant' ? <><label style={{ display: 'grid', gap: '0.25rem' }}><span>Plan code</span><input value={mutation.planCode} onChange={(e) => setMutation((p) => ({ ...p, planCode: e.target.value, error: '' }))} /></label><label style={{ display: 'grid', gap: '0.25rem' }}><span>Valid until (optional, local time)</span><input type="datetime-local" value={mutation.validUntil} onChange={(e) => setMutation((p) => ({ ...p, validUntil: e.target.value, error: '' }))} /></label></> : null}<label style={{ display: 'grid', gap: '0.25rem' }}><span>Required audit reason</span><textarea rows={3} maxLength={1000} value={mutation.reason} onChange={(e) => setMutation((p) => ({ ...p, reason: e.target.value, error: '' }))} /></label>{mutation.type !== 'requirePayment' ? <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}><input type="checkbox" checked={mutation.acknowledged} onChange={(e) => setMutation((p) => ({ ...p, acknowledged: e.target.checked, error: '' }))} /><span>I confirmed account {accountId}, reviewed access/history{pending ? ' and the pending payment' : ''}, and understand this operation is separate from Business/KYB status.</span></label> : <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Clicking Require payment confirms this action for account {accountId}.</div>}<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}><button type="button" className="btn-neutral" disabled={saving} onClick={() => setMutation(null)}>Cancel</button><button type="button" className={mutation.type === 'revoke' || mutation.type === 'requirePayment' ? 'btn-danger' : 'btn-primary'} disabled={saving} onClick={() => void submitMutation()}>{saving ? 'Submitting…' : mutation.type === 'reconcile' ? 'Reconcile payment status' : mutation.type === 'requirePayment' ? 'Require payment' : 'Confirm'}</button></div></div></Modal> : null}
      </> : null}
    </section>
  );
}
