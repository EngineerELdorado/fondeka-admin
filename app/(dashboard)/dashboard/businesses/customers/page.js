'use client';

import { isRegulatorRestrictedRecord } from '@/lib/regulator-presentation';

import { RegulatorRecord, PresentationSelect, NonRegulatorContent, PresentationLink as Link, RegulatorField } from '@/components/RegulatorPresentation';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const TOOLS = ['BUNDLE', 'PAYMENT_REQUESTS', 'ONLINE_STORES', 'POS', 'API'];
const PAYMENTS = ['PAID', 'UNPAID', 'ANY'];
const ENTITLEMENT_STATUSES = ['ACTIVE', 'INACTIVE', 'EXPIRED', 'REVOKED'];
const PURCHASE_STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'];
const GRANT_SOURCES = ['PURCHASE', 'ADMIN', 'MIGRATION', 'PROMOTION'];
const BILLING_MODES = ['ONE_TIME', 'MONTHLY', 'YEARLY'];
const PRICE_SOURCES = ['BASE', 'COUNTRY', 'ACCOUNT'];
const PAYMENT_METHOD_TYPES = ['BALANCE', 'MOBILE_MONEY', 'CRYPTO', 'BANK'];

const emptyFilters = (tab) => ({
  accountId: '', email: '', businessId: '', countryCode: '', q: '', payment: 'PAID',
  tool: '', coveredTool: '', planCode: '', entitlementStatus: '', grantSource: '', paymentRequired: '', recordValid: '',
  grantedFrom: '', grantedBefore: '', expiresBefore: '', purchaseStatus: 'COMPLETED', billingMode: '', priceSource: '', paymentMethodType: '',
  purchaseId: '', paymentTransactionId: '', transactionReference: '', currency: '', minAmount: '', maxAmount: '',
  createdFrom: '', createdBefore: '', paidFrom: '', paidBefore: '', legacyStorePayment: '', sortBy: tab === 'subscribers' ? 'LAST_PAYMENT_AT' : 'CREATED_AT', direction: 'DESC'
});

const normalizeGroups = (value) => Array.isArray(value)
  ? value.map((item) => String(item).trim().toUpperCase()).filter(Boolean)
  : typeof value === 'string' ? value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean) : [];
const pageRows = (response) => Array.isArray(response) ? response : response?.content || [];
const formatEnum = (value) => String(value || '—').toLowerCase().split('_').filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};
const formatMoney = (amount, currency) => {
  if (amount === null || amount === undefined || amount === '') return '—';
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(Number(amount)); }
  catch { return `${amount} ${currency || ''}`.trim(); }
};
const accountOf = (row) => row?.account || row?.payer || row?.customerAccount || {};
const accountIdOf = (row) => accountOf(row)?.accountId ?? accountOf(row)?.id ?? row?.accountId;
const purchaseOf = (row) => row?.purchase || row || {};

const verifiedTotals = (payments) => {
  const totals = payments?.verifiedGrossTotals || payments?.grossTotalsByCurrency || payments?.paidTotals || [];
  if (Array.isArray(totals)) return totals.map((entry) => formatMoney(entry.amount ?? entry.total, entry.currency)).join(', ') || '—';
  if (totals && typeof totals === 'object') return Object.entries(totals).map(([currency, amount]) => formatMoney(amount, currency)).join(', ') || '—';
  return '—';
};

const Modal = ({ title, onClose, children }) => <div className="modal-backdrop"><div className="modal-surface"><div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}><strong>{title}</strong><button type="button" className="btn-neutral" onClick={onClose}>×</button></div>{children}</div></div>;
const SummaryGrid = ({ rows }) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.55rem' }}>{rows.map(([label, value]) => <div key={label} style={{ padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '9px', minWidth: 0 }}><div style={{ color: 'var(--muted)', fontSize: '12px' }}>{label}</div><strong style={{ overflowWrap: 'anywhere' }}>{value ?? '—'}</strong></div>)}</div>;

const toApiParams = (filters, page, size) => {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  const dateKeys = new Set(['grantedFrom', 'grantedBefore', 'expiresBefore', 'createdFrom', 'createdBefore', 'paidFrom', 'paidBefore']);
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, dateKeys.has(key) ? new Date(value).toISOString() : String(value));
  });
  return params;
};

const validateFilters = (filters) => {
  if ((filters.minAmount || filters.maxAmount) && !filters.currency) return 'Currency is required when filtering by amount.';
  if (filters.sortBy === 'AMOUNT' && !filters.currency) return 'Currency is required when sorting the purchase ledger by amount.';
  if (filters.minAmount && filters.maxAmount && Number(filters.minAmount) > Number(filters.maxAmount)) return 'Minimum amount must not exceed maximum amount.';
  if (filters.tool && filters.coveredTool) return 'Choose either exact tool or covered tool, not both.';
  const ranges = [['grantedFrom', 'grantedBefore'], ['createdFrom', 'createdBefore'], ['paidFrom', 'paidBefore']];
  for (const [from, before] of ranges) {
    if (filters[from] && filters[before] && new Date(filters[from]).getTime() >= new Date(filters[before]).getTime()) return `${formatEnum(from)} must be before ${formatEnum(before)}.`;
  }
  return '';
};

export default function BusinessToolsCustomersPage() {
  const { session } = useAuth();
  const [tab, setTab] = useState('subscribers');
  const [filtersByTab, setFiltersByTab] = useState({ subscribers: emptyFilters('subscribers'), purchases: emptyFilters('purchases') });
  const [appliedByTab, setAppliedByTab] = useState({ subscribers: emptyFilters('subscribers'), purchases: emptyFilters('purchases') });
  const [pageByTab, setPageByTab] = useState({ subscribers: 0, purchases: 0 });
  const [size, setSize] = useState(20);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ totalElements: null, totalPages: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [subscriberDetail, setSubscriberDetail] = useState(null);
  const [purchaseDetail, setPurchaseDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mutation, setMutation] = useState(null);
  const [saving, setSaving] = useState(false);

  const adminGroups = useMemo(() => {
    const access = session?.tokens?.accessToken?.payload || {};
    const id = session?.tokens?.idToken?.payload || {};
    return [...normalizeGroups(access['cognito:groups'] || access.groups), ...normalizeGroups(id['cognito:groups'] || id.groups)];
  }, [session]);
  const isSuperAdmin = adminGroups.includes('SUPER_ADMIN');
  const canRead = isSuperAdmin || adminGroups.includes('ADMIN');

  const filters = filtersByTab[tab];
  const applied = appliedByTab[tab];
  const page = pageByTab[tab];
  const setFilter = (key, value) => setFiltersByTab((current) => ({ ...current, [tab]: { ...current[tab], [key]: value } }));

  const loadRows = useCallback(async () => {
    if (!canRead) return;
    setLoading(true); setError('');
    try {
      const params = toApiParams(applied, page, size);
      const response = tab === 'subscribers' ? await api.businessTools.subscribers.list(params) : await api.businessTools.purchases.list(params);
      setRows(pageRows(response));
      setMeta({ totalElements: Number.isFinite(response?.totalElements) ? response.totalElements : null, totalPages: Number.isFinite(response?.totalPages) ? response.totalPages : null });
    } catch (err) {
      setRows([]); setMeta({ totalElements: null, totalPages: null }); setError(err?.message || 'Failed to load Business Tools customers.');
    } finally { setLoading(false); }
  }, [applied, canRead, page, size, tab]);
  useEffect(() => { void loadRows(); }, [loadRows]);

  const applyFilters = () => {
    const validation = validateFilters(filters);
    if (validation) { setError(validation); return; }
    setError('');
    setPageByTab((current) => ({ ...current, [tab]: 0 }));
    setAppliedByTab((current) => ({ ...current, [tab]: { ...filters } }));
  };
  const clearFilters = () => {
    const next = emptyFilters(tab);
    setFiltersByTab((current) => ({ ...current, [tab]: next }));
    setAppliedByTab((current) => ({ ...current, [tab]: next }));
    setPageByTab((current) => ({ ...current, [tab]: 0 }));
  };

  const openSubscriber = async (row) => {
    const accountId = accountIdOf(row);
    if (!accountId) return;
    setDetailLoading(true); setError('');
    try { setSubscriberDetail(await api.businessTools.subscribers.get(accountId)); }
    catch (err) { setError(err?.message || 'Failed to load subscriber details.'); }
    finally { setDetailLoading(false); }
  };
  const openPurchase = async (row) => {
    const purchase = purchaseOf(row);
    if (!purchase.id) return;
    setDetailLoading(true); setError('');
    try { setPurchaseDetail(await api.businessTools.purchases.get(purchase.id)); }
    catch (err) { setError(err?.message || 'Failed to load purchase details.'); }
    finally { setDetailLoading(false); }
  };

  const submitMutation = async () => {
    const reason = mutation?.reason?.trim();
    if (!reason || reason.length > 1000) { setError('Enter an audit reason of 1–1,000 characters.'); return; }
    setSaving(true); setError(''); setInfo('');
    try {
      if (mutation.type === 'reconcile') await api.businessTools.purchases.reconcile(mutation.purchaseId, { reason });
      else await api.businessTools.purchases.refundToWallet(mutation.purchaseId, { reason });
      setInfo(mutation.type === 'reconcile' ? 'Purchase reconciled against the verified financial transaction.' : 'Purchase refund request completed through the existing refund policy.');
      setMutation(null);
      if (purchaseDetail) setPurchaseDetail(await api.businessTools.purchases.get(mutation.purchaseId));
      await loadRows();
    } catch (err) { setError(`${err?.message || 'Business Tools payment operation failed.'} The operation was not retried automatically.`); }
    finally { setSaving(false); }
  };

  const subscriberColumns = useMemo(() => [
    { key: 'account', label: 'Customer', render: (row) => { const account = accountOf(row); const id = accountIdOf(row); return <div><strong>{account.name || [account.firstName, account.lastName].filter(Boolean).join(' ') || account.email || `Account ${id}`}</strong><div style={{ fontSize: '12px' }}>{account.email || '—'} · {account.accountReference || account.reference || '—'}</div></div>; } },
    { key: 'country', label: 'Country', render: (row) => accountOf(row).countryCode || accountOf(row).country || '—' },
    { key: 'businesses', label: 'Businesses', render: (row) => (row.businesses || []).map((business) => business.name || `#${business.id}`).join(', ') || '—' },
    { key: 'entitlements', label: 'Recorded access', render: (row) => (row.entitlements || []).map((entry) => `${formatEnum(entry.tool || 'BUNDLE')}: ${formatEnum(entry.effectiveStatus || entry.status)}`).join(', ') || '—' },
    { key: 'payments', label: 'Verified payments', render: (row) => <div><strong>{row.payments?.paidPurchaseCount ?? 0}</strong><div style={{ fontSize: '12px' }}>{verifiedTotals(row.payments)}</div></div> },
    { key: 'legacy', label: 'Legacy store payment', render: (row) => row.legacyStorePayment ? <div>{formatMoney(row.legacyStorePayment.amount, row.legacyStorePayment.currency)}{row.legacyStorePayment.transactionId ? <div><Link href={`/dashboard/transactions?transactionId=${encodeURIComponent(row.legacyStorePayment.transactionId)}`}>{row.legacyStorePayment.transactionReference || `Transaction ${row.legacyStorePayment.transactionId}`}</Link></div> : <div style={{ fontSize: '12px' }}>{row.legacyStorePayment.transactionReference || 'Verified evidence'}</div>}</div> : '—' },
    { key: 'lastPaidAt', label: 'Last paid', render: (row) => formatDateTime(row.lastPaidAt) },
    { key: 'actions', label: '', render: (row) => <div style={{ display: 'flex', gap: '0.4rem' }}><button type="button" className="btn-neutral btn-sm" disabled={detailLoading} onClick={() => void openSubscriber(row)}>Details</button><Link className="btn-neutral btn-sm" style={{ textDecoration: 'none' }} href={`/dashboard/accounts/accounts/${encodeURIComponent(accountIdOf(row))}#business-tools-access`}>Manage</Link></div> }
  ], [detailLoading]);

  const purchaseColumns = useMemo(() => [
    { key: 'purchase', label: 'Purchase', render: (row) => purchaseOf(row).id || '—' },
    { key: 'payer', label: 'Payer', render: (row) => { const account = accountOf(row); return <div><strong>{account.name || account.email || `Account ${accountIdOf(row) || '—'}`}</strong><div style={{ fontSize: '12px' }}>{account.email || '—'}</div></div>; } },
    { key: 'scope', label: 'Scope / plan', render: (row) => { const purchase = purchaseOf(row); return <div>{formatEnum(purchase.tool || 'BUNDLE')}<div style={{ fontSize: '12px' }}>{purchase.planCode || purchase.plan?.code || '—'} · v{purchase.planVersion ?? '—'}</div></div>; } },
    { key: 'status', label: 'Outcome', render: (row) => { const purchase = purchaseOf(row); return <div>{formatEnum(purchase.status)}<div style={{ fontSize: '12px' }}>{purchase.failureCode ? formatEnum(purchase.failureCode) : '—'}</div></div>; } },
    { key: 'amount', label: 'Gross charged', render: (row) => { const purchase = purchaseOf(row); return formatMoney(purchase.amount, purchase.currency); } },
    { key: 'snapshot', label: 'Accepted offer', render: (row) => { const purchase = purchaseOf(row); return <div>{formatMoney(purchase.planAmount, purchase.planCurrency)}<div style={{ fontSize: '12px' }}>{formatEnum(purchase.billingMode)} · {formatEnum(purchase.priceSource)}</div></div>; } },
    { key: 'method', label: 'Method', render: (row) => formatEnum(purchaseOf(row).paymentMethodType) },
    { key: 'transaction', label: 'Transaction', render: (row) => { const purchase = purchaseOf(row); return purchase.paymentTransactionId ? <Link href={`/dashboard/transactions?transactionId=${encodeURIComponent(purchase.paymentTransactionId)}`}>{purchase.paymentTransactionId}</Link> : '—'; } },
    { key: 'createdAt', label: 'Created / paid', render: (row) => { const purchase = purchaseOf(row); return <div>{formatDateTime(purchase.createdAt)}<div style={{ fontSize: '12px' }}>{formatDateTime(purchase.completedAt || purchase.paidAt)}</div></div>; } },
    { key: 'actions', label: '', render: (row) => { const purchase = purchaseOf(row); return <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}><button type="button" className="btn-neutral btn-sm" disabled={detailLoading} onClick={() => void openPurchase(row)}>Details</button>{isSuperAdmin ? <><button type="button" className="btn-neutral btn-sm" onClick={() => setMutation({ type: 'reconcile', purchaseId: purchase.id, reason: 'Review Business Tools purchase against verified transaction state' })}>Reconcile</button><button type="button" className="btn-danger btn-sm" onClick={() => setMutation({ type: 'refund', purchaseId: purchase.id, reason: 'Refund verified Business Tools purchase to wallet' })}>Refund</button></> : null}</div>; } }
  ], [detailLoading, isSuperAdmin]);

  const detailSubscriber = subscriberDetail || {};
  const detailAccount = accountOf(detailSubscriber);
  const effective = detailSubscriber.effectiveAccess || {};
  const detailPurchase = purchaseOf(purchaseDetail || {});
  const detailPayer = accountOf(purchaseDetail || {});
  const detailTransaction = purchaseDetail?.financialTransaction || purchaseDetail?.paymentTransaction || purchaseDetail?.transaction || {};
  const canNext = meta.totalPages === null ? rows.length === size && rows.length > 0 : page + 1 < meta.totalPages;

  if (!canRead) return <div className="card"><h1 style={{ marginTop: 0 }}>Business Tools customers</h1><div className="alert alert-error">This directory is available to Admin and Super Admin roles.</div></div>;

  return <div style={{ display: 'grid', gap: '1rem' }}>
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}><div><h1 style={{ margin: 0 }}>Business Tools customers</h1><p style={{ color: 'var(--muted)', margin: '0.35rem 0 0' }}>Customer access records and verified Business Tools purchase attempts. Legacy store payments remain separate evidence.</p></div><div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}><Link href="/dashboard/businesses/plans" className="btn-neutral" style={{ textDecoration: 'none' }}>Plans</Link><Link href="/dashboard/businesses/migration" className="btn-neutral" style={{ textDecoration: 'none' }}>Migration</Link><button type="button" className="btn-neutral" disabled={loading} onClick={() => void loadRows()}>{loading ? 'Refreshing…' : 'Refresh'}</button></div></div>
    {error ? <div className="alert alert-error">{error}</div> : null}{info ? <div className="alert alert-success">{info}</div> : null}
    <div className="card" style={{ display: 'grid', gap: '0.8rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}><button type="button" className={tab === 'subscribers' ? 'btn-primary' : 'btn-neutral'} onClick={() => setTab('subscribers')}>Customer directory</button><button type="button" className={tab === 'purchases' ? 'btn-primary' : 'btn-neutral'} onClick={() => setTab('purchases')}>Purchase ledger</button></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
        <label><span>Search</span><input value={filters.q} onChange={(e) => setFilter('q', e.target.value)} placeholder="Name, email, phone, reference or Business" /></label>
        <label><span>Account ID</span><input value={filters.accountId} onChange={(e) => setFilter('accountId', e.target.value)} /></label>
        <label><span>Email</span><input type="email" value={filters.email} onChange={(e) => setFilter('email', e.target.value)} /></label>
        <label><span>Payment</span><PresentationSelect value={filters.payment} onChange={(e) => setFilter('payment', e.target.value)}>{PAYMENTS.map((value) => <option data-regulator-restricted={isRegulatorRestrictedRecord(value)} key={value}>{value}</option>)}</PresentationSelect></label>
        <label><span>Exact tool</span><PresentationSelect value={filters.tool} onChange={(e) => { setFilter('tool', e.target.value); if (e.target.value) setFilter('coveredTool', ''); }}><option value="">Any</option>{TOOLS.map((value) => <option data-regulator-restricted={isRegulatorRestrictedRecord(value)} key={value}>{value}</option>)}</PresentationSelect></label>
        <label><span>Covered tool (includes bundle)</span><PresentationSelect value={filters.coveredTool} onChange={(e) => { setFilter('coveredTool', e.target.value); if (e.target.value) setFilter('tool', ''); }}><option value="">Any</option>{TOOLS.filter((value) => value !== 'BUNDLE').map((value) => <option data-regulator-restricted={isRegulatorRestrictedRecord(value)} key={value}>{value}</option>)}</PresentationSelect></label>
        <label><span>Plan code</span><input value={filters.planCode} onChange={(e) => setFilter('planCode', e.target.value)} /></label>
        <label><span>Purchase status</span><PresentationSelect value={filters.purchaseStatus} onChange={(e) => setFilter('purchaseStatus', e.target.value)}><option value="">Any</option>{PURCHASE_STATUSES.map((value) => <option data-regulator-restricted={isRegulatorRestrictedRecord(value)} key={value}>{value}</option>)}</PresentationSelect></label>
      </div>
      <button type="button" className="btn-neutral btn-sm" style={{ justifySelf: 'start' }} onClick={() => setShowAdvanced((value) => !value)}>{showAdvanced ? 'Hide advanced filters' : 'Show advanced filters'}</button>
      {showAdvanced ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
        <label><span>Business ID</span><input value={filters.businessId} onChange={(e) => setFilter('businessId', e.target.value)} /></label><label><span>Country</span><input maxLength={2} value={filters.countryCode} onChange={(e) => setFilter('countryCode', e.target.value.toUpperCase())} /></label>
        <label><span>Entitlement status</span><PresentationSelect value={filters.entitlementStatus} onChange={(e) => setFilter('entitlementStatus', e.target.value)}><option value="">Any</option>{ENTITLEMENT_STATUSES.map((value) => <option data-regulator-restricted={isRegulatorRestrictedRecord(value)} key={value}>{value}</option>)}</PresentationSelect></label><label><span>Grant source</span><PresentationSelect value={filters.grantSource} onChange={(e) => setFilter('grantSource', e.target.value)}><option value="">Any</option>{GRANT_SOURCES.map((value) => <option data-regulator-restricted={isRegulatorRestrictedRecord(value)} key={value}>{value}</option>)}</PresentationSelect></label>
        {[['paymentRequired', 'Payment required'], ['recordValid', 'Record valid'], ['legacyStorePayment', 'Legacy store payment']].map(([key, label]) => <label key={key}><span>{label}</span><PresentationSelect value={filters[key]} onChange={(e) => setFilter(key, e.target.value)}><option value="">Any</option><option value="true">Yes</option><option value="false">No</option></PresentationSelect></label>)}
        <label><span>Billing mode</span><PresentationSelect value={filters.billingMode} onChange={(e) => setFilter('billingMode', e.target.value)}><option value="">Any</option>{BILLING_MODES.map((value) => <option data-regulator-restricted={isRegulatorRestrictedRecord(value)} key={value}>{value}</option>)}</PresentationSelect></label><label><span>Price source</span><PresentationSelect value={filters.priceSource} onChange={(e) => setFilter('priceSource', e.target.value)}><option value="">Any</option>{PRICE_SOURCES.map((value) => <option data-regulator-restricted={isRegulatorRestrictedRecord(value)} key={value}>{value}</option>)}</PresentationSelect></label><label><span>Payment method</span><PresentationSelect value={filters.paymentMethodType} onChange={(e) => setFilter('paymentMethodType', e.target.value)}><option value="">Any</option>{PAYMENT_METHOD_TYPES.map((value) => <option data-regulator-restricted={isRegulatorRestrictedRecord(value)} key={value}>{value}</option>)}</PresentationSelect></label>
        <label><span>Purchase UUID</span><input value={filters.purchaseId} onChange={(e) => setFilter('purchaseId', e.target.value)} /></label><label><span>Transaction ID</span><input value={filters.paymentTransactionId} onChange={(e) => setFilter('paymentTransactionId', e.target.value)} /></label><label><span>Transaction reference</span><input value={filters.transactionReference} onChange={(e) => setFilter('transactionReference', e.target.value)} /></label>
        <label><span>Currency</span><input maxLength={3} value={filters.currency} onChange={(e) => setFilter('currency', e.target.value.toUpperCase())} /></label><label><span>Minimum gross</span><input type="number" min="0" step="0.01" value={filters.minAmount} onChange={(e) => setFilter('minAmount', e.target.value)} /></label><label><span>Maximum gross</span><input type="number" min="0" step="0.01" value={filters.maxAmount} onChange={(e) => setFilter('maxAmount', e.target.value)} /></label>
        {[['createdFrom', 'Created from'], ['createdBefore', 'Created before'], ['paidFrom', 'Paid from'], ['paidBefore', 'Paid before'], ['grantedFrom', 'Granted from'], ['grantedBefore', 'Granted before'], ['expiresBefore', 'Expires before']].map(([key, label]) => <label key={key}><span>{label}</span><input type="datetime-local" value={filters[key]} onChange={(e) => setFilter(key, e.target.value)} /></label>)}
        <label><span>Sort by</span><PresentationSelect value={filters.sortBy} onChange={(e) => setFilter('sortBy', e.target.value)}>{['ACCOUNT_ID', 'EMAIL', 'CREATED_AT', 'LAST_PAYMENT_AT', ...(tab === 'purchases' ? ['AMOUNT'] : [])].map((value) => <option data-regulator-restricted={isRegulatorRestrictedRecord(value)} key={value}>{value}</option>)}</PresentationSelect></label><label><span>Direction</span><PresentationSelect value={filters.direction} onChange={(e) => setFilter('direction', e.target.value)}><option>DESC</option><option>ASC</option></PresentationSelect></label>
      </div> : null}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', flexWrap: 'wrap' }}><button type="button" className="btn-primary" onClick={applyFilters}>Apply filters</button><button type="button" className="btn-neutral" onClick={clearFilters}>Clear</button><label><span>Page size</span><PresentationSelect value={size} onChange={(e) => { setSize(Number(e.target.value)); setPageByTab((current) => ({ ...current, [tab]: 0 })); }}>{[20, 50, 100].map((value) => <option data-regulator-restricted={isRegulatorRestrictedRecord(value)} key={value}>{value}</option>)}</PresentationSelect></label></div>
      <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{tab === 'subscribers' ? 'Directory totals are each account’s all-time verified payments, not revenue for the selected filter interval.' : 'The ledger returns only matching purchase rows. Accepted commercial snapshots are kept separate from current catalog prices.'}</div>
    </div>
    <DataTable columns={tab === 'subscribers' ? subscriberColumns : purchaseColumns} rows={rows} page={page} pageSize={size} totalElements={meta.totalElements} totalPages={meta.totalPages} onPageChange={(next) => setPageByTab((current) => ({ ...current, [tab]: next }))} canPrev={page > 0} canNext={canNext} showAccountQuickNav={false} emptyLabel={loading ? 'Loading…' : 'No matching records.'} />

    {subscriberDetail ? <Modal title={`Business Tools customer ${detailAccount.accountReference || accountIdOf(detailSubscriber)}`} onClose={() => setSubscriberDetail(null)}><div style={{ display: 'grid', gap: '0.75rem' }}><SummaryGrid rows={[["Account", detailAccount.name || detailAccount.email || accountIdOf(detailSubscriber)], ['Email', detailAccount.email], ['Country', detailAccount.countryCode], ['Pricing mode', formatEnum(effective.pricingMode)], ['Effective bundle access', effective.accessGranted ? 'Granted' : formatEnum(effective.status)], ['Verified payments', verifiedTotals(detailSubscriber.payments)], ['First activity', formatDateTime(detailSubscriber.firstActivityAt)], ['Last activity', formatDateTime(detailSubscriber.lastActivityAt)]]} /><div><strong>Owned Businesses</strong><div style={{ marginTop: '0.35rem' }}>{(detailSubscriber.businesses || []).map((business) => <div key={business.id}>{business.name || `Business ${business.id}`} · {formatEnum(business.status)} · KYB {formatEnum(business.kybStatus)}{business.defaultBusiness ? ' · Default' : ''}</div>)}</div></div><div><strong>Recorded entitlements</strong><div style={{ overflowX: 'auto', marginTop: '0.35rem' }}><table style={{ width: '100%', minWidth: '760px' }}><thead><tr>{['Tool', 'Plan', 'Status', 'Source', 'Valid from', 'Valid until', 'Payment required', 'Record valid'].map((label) => <RegulatorField field={label} key={label}><th key={label}>{label}</th></RegulatorField>)}</tr></thead><tbody>{(detailSubscriber.entitlements || []).map((entry, index) => <RegulatorRecord record={entry} key={entry.id || index}><tr key={entry.id || index}><td>{formatEnum(entry.tool || 'BUNDLE')}</td><td>{entry.plan?.code || entry.planCode || '—'}<div style={{ fontSize: '11px' }}>{formatMoney(entry.plan?.catalogAmount, entry.plan?.catalogCurrency)}</div></td><td>{formatEnum(entry.effectiveStatus || entry.status)}</td><td>{formatEnum(entry.grantSource || entry.grantedBy)}</td><td>{formatDateTime(entry.validFrom)}</td><td>{formatDateTime(entry.validUntil)}</td><td>{entry.paymentRequired ? 'Yes' : 'No'}</td><td>{entry.recordValid ? 'Yes' : 'No'}</td></tr></RegulatorRecord>)}</tbody></table></div></div><div><strong>Effective per-tool access</strong><div style={{ marginTop: '0.35rem' }}>{(effective.tools || []).map((tool) => <div key={tool.tool}>{formatEnum(tool.tool)}: <strong>{tool.accessGranted ? 'Granted' : formatEnum(tool.status)}</strong> · {formatEnum(tool.accessSource)} · Due {formatMoney(tool.pricing?.amountDue, tool.pricing?.currency)}</div>)}</div></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}><Link className="btn-primary" style={{ textDecoration: 'none' }} href={`/dashboard/accounts/accounts/${encodeURIComponent(accountIdOf(detailSubscriber))}#business-tools-access`}>Manage access and history</Link><button type="button" className="btn-neutral" onClick={() => setSubscriberDetail(null)}>Close</button></div></div></Modal> : null}

    {purchaseDetail ? <Modal title={`Business Tools purchase ${detailPurchase.id || ''}`} onClose={() => setPurchaseDetail(null)}><div style={{ display: 'grid', gap: '0.75rem' }}><SummaryGrid rows={[["Payer", detailPayer.name || detailPayer.email || accountIdOf(purchaseDetail)], ['Scope', formatEnum(detailPurchase.tool || 'BUNDLE')], ['Plan code', detailPurchase.planCode || detailPurchase.plan?.code], ['Plan version', detailPurchase.planVersion], ['Billing mode', formatEnum(detailPurchase.billingMode)], ['Accepted plan price', formatMoney(detailPurchase.planAmount, detailPurchase.planCurrency)], ['Gross charged', formatMoney(detailPurchase.amount, detailPurchase.currency)], ['Price source', formatEnum(detailPurchase.priceSource)], ['Payment method', formatEnum(detailPurchase.paymentMethodType)], ['Status', formatEnum(detailPurchase.status)], ['Failure code', detailPurchase.failureCode || '—'], ['Created', formatDateTime(detailPurchase.createdAt)], ['Completed', formatDateTime(detailPurchase.completedAt || detailPurchase.paidAt)]]} /><div className="card"><strong>Verified financial transaction</strong><SummaryGrid rows={[["Transaction ID", detailPurchase.paymentTransactionId || detailTransaction.id || detailTransaction.transactionId], ['Reference', detailTransaction.reference || detailPurchase.transactionReference], ['Status', formatEnum(detailTransaction.status)], ['Service', formatEnum(detailTransaction.service)], ['Action', formatEnum(detailTransaction.action)], ['Gross amount', formatMoney(detailTransaction.grossAmount ?? detailTransaction.amount, detailTransaction.grossCurrency || detailTransaction.currency)]]} /></div><div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>{detailPurchase.paymentTransactionId ? <Link className="btn-neutral" style={{ textDecoration: 'none' }} href={`/dashboard/transactions?transactionId=${encodeURIComponent(detailPurchase.paymentTransactionId)}`}>Open transaction</Link> : null}{accountIdOf(purchaseDetail) ? <Link className="btn-neutral" style={{ textDecoration: 'none' }} href={`/dashboard/accounts/accounts/${encodeURIComponent(accountIdOf(purchaseDetail))}#business-tools-access`}>Open customer</Link> : null}{isSuperAdmin ? <><button type="button" className="btn-neutral" onClick={() => setMutation({ type: 'reconcile', purchaseId: detailPurchase.id, reason: 'Review Business Tools purchase against verified transaction state' })}>Reconcile</button><NonRegulatorContent><button type="button" className="btn-danger" onClick={() => setMutation({ type: 'refund', purchaseId: detailPurchase.id, reason: 'Refund verified Business Tools purchase to wallet' })}>Refund to wallet</button></NonRegulatorContent></> : null}<button type="button" className="btn-neutral" onClick={() => setPurchaseDetail(null)}>Close</button></div></div></Modal> : null}

    {mutation ? <Modal title={mutation.type === 'reconcile' ? 'Reconcile payment status' : 'Refund Business Tools purchase'} onClose={() => !saving && setMutation(null)}><div style={{ display: 'grid', gap: '0.75rem' }}><div style={{ color: mutation.type === 'refund' ? '#991B1B' : 'var(--muted)' }}>{mutation.type === 'reconcile' ? 'Checks verified local transaction state. It does not resubmit or charge the provider.' : 'Uses the existing authorized refund policy. It does not delete the purchase or payment history.'}</div><label><span>Required audit reason</span><textarea rows={3} maxLength={1000} value={mutation.reason} onChange={(e) => setMutation((current) => ({ ...current, reason: e.target.value }))} /></label><div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}><button type="button" className="btn-neutral" disabled={saving} onClick={() => setMutation(null)}>Cancel</button><button type="button" className={mutation.type === 'refund' ? 'btn-danger' : 'btn-primary'} disabled={saving} onClick={() => void submitMutation()}>{saving ? 'Submitting…' : mutation.type === 'reconcile' ? 'Reconcile payment status' : 'Refund to wallet'}</button></div></div></Modal> : null}
  </div>;
}
