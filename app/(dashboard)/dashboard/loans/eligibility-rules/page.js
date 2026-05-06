'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const SCOPE_OPTIONS = ['ACCOUNT', 'PRODUCT', 'ACTION', 'SERVICE', 'GLOBAL'];
const SERVICE_OPTIONS = ['WALLET', 'BILL_PAYMENT', 'BILL_PAYMENTS', 'LENDING', 'CARD', 'CRYPTO', 'PAYMENT_REQUEST', 'E_SIM', 'AIRTIME_AND_DATA', 'OTHER'];
const ACTION_OPTIONS = [
  'FUND_WALLET',
  'WITHDRAW_FROM_WALLET',
  'PERSONAL_SAVING_DEPOSIT',
  'PERSONAL_SAVING_WITHDRAWAL',
  'PERSONAL_SAVING_INTEREST_PAYOUT',
  'GROUP_SAVING_CONTRIBUTION',
  'GROUP_SAVING_PAYOUT',
  'GROUP_SAVING_ROUND_DISTRIBUTION',
  'REFUND_TO_WALLET',
  'BONUS',
  'PAY_INTERNET_BILL',
  'PAY_TV_SUBSCRIPTION',
  'PAY_ELECTRICITY_BILL',
  'PAY_WATER_BILL',
  'LOAN_REQUEST',
  'LOAN_DISBURSEMENT',
  'REPAY_LOAN',
  'FUND_CARD',
  'WITHDRAW_FROM_CARD',
  'BUY_CARD',
  'CARD_ONLINE_PAYMENT',
  'CARD_PAYMENT_REVERSAL',
  'BUY_CRYPTO',
  'SELL_CRYPTO',
  'RECEIVE_CRYPTO',
  'SEND_CRYPTO',
  'SWAP_CRYPTO',
  'REQUEST_PAYMENT',
  'PAY_REQUEST',
  'E_SIM_PURCHASE',
  'E_SIM_TOPUP',
  'SEND_AIRTIME',
  'SEND_DATA_BUNDLES',
  'BUY_GIFT_CARD',
  'PAY_NETFLIX',
  'INTER_TRANSFER',
  'OTHER'
].sort();

const precedenceRankByScope = {
  ACCOUNT: 2,
  PRODUCT: 3,
  ACTION: 4,
  SERVICE: 5,
  GLOBAL: 6
};

const emptyDraft = {
  id: null,
  scope: 'GLOBAL',
  accountId: '',
  billProductId: '',
  paymentProviderId: '',
  service: '',
  action: '',
  eligibilityPercentOfRevenue: '',
  enabled: true,
  note: ''
};

const emptyPreview = {
  accountId: '',
  billProductId: '',
  paymentProviderId: '',
  service: '',
  action: '',
  revenueAmount: ''
};

const Modal = ({ title, onClose, children, width = 760 }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={{ maxWidth: width }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
    {rows.map((row) => (
      <div key={row.label} className="card" style={{ display: 'grid', gap: '0.2rem', padding: '0.8rem' }}>
        <div style={{ color: 'var(--muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{row.label}</div>
        <div style={{ fontWeight: 700 }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

const toList = (res) => (Array.isArray(res) ? res : res?.content || []);

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatAmount = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  return parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatPercent = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed}%` : '—';
};

const humanizeEnum = (value) =>
  String(value || '')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const normalizeRuleDraft = (row) => ({
  id: row?.id ?? null,
  scope: String(row?.scope || 'GLOBAL').toUpperCase(),
  accountId: row?.accountId ? String(row.accountId) : '',
  billProductId: row?.billProductId ? String(row.billProductId) : '',
  paymentProviderId: row?.paymentProviderId ? String(row.paymentProviderId) : '',
  service: row?.service ? String(row.service) : '',
  action: row?.action ? String(row.action) : '',
  eligibilityPercentOfRevenue:
    row?.eligibilityPercentOfRevenue === null || row?.eligibilityPercentOfRevenue === undefined
      ? ''
      : String(row.eligibilityPercentOfRevenue),
  enabled: row?.enabled !== false,
  note: row?.note ? String(row.note) : ''
});

const buildPayload = (draft) => {
  const percent = Number(draft.eligibilityPercentOfRevenue);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('Eligibility % of Revenue must be between 0 and 100.');
  }
  const note = String(draft.note || '').trim();
  if (!note) {
    throw new Error('Note is required.');
  }

  const payload = {
    scope: draft.scope,
    eligibilityPercentOfRevenue: percent,
    enabled: Boolean(draft.enabled),
    note
  };

  const accountId = draft.accountId.trim();
  const billProductId = draft.billProductId.trim();
  const paymentProviderId = draft.paymentProviderId.trim();
  const service = draft.service.trim();
  const action = draft.action.trim();

  if (draft.scope === 'ACCOUNT') {
    if (!accountId) throw new Error('ACCOUNT scope requires accountId.');
    payload.accountId = Number(accountId);
  } else if (draft.scope === 'PRODUCT') {
    if (!billProductId) throw new Error('PRODUCT scope requires billProductId.');
    payload.billProductId = Number(billProductId);
  } else if (draft.scope === 'ACTION') {
    if (!action) throw new Error('ACTION scope requires action.');
    payload.action = action;
  } else if (draft.scope === 'SERVICE') {
    if (!service) throw new Error('SERVICE scope requires service.');
    payload.service = service;
  } else if (draft.scope === 'GLOBAL') {
    if (accountId || billProductId || paymentProviderId || service || action) {
      throw new Error('GLOBAL scope cannot include narrower qualifiers.');
    }
  }

  if (paymentProviderId) payload.paymentProviderId = Number(paymentProviderId);
  return payload;
};

export default function LoanEligibilityRulesPage() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    scope: '',
    enabled: '',
    accountId: '',
    billProductId: '',
    paymentProviderId: '',
    service: '',
    action: ''
  });
  const [appliedFilters, setAppliedFilters] = useState({
    scope: '',
    enabled: '',
    accountId: '',
    billProductId: '',
    paymentProviderId: '',
    service: '',
    action: ''
  });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewDraft, setPreviewDraft] = useState(emptyPreview);
  const [previewResult, setPreviewResult] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [billProducts, setBillProducts] = useState([]);
  const [paymentProviders, setPaymentProviders] = useState([]);

  const billProductMap = useMemo(() => {
    const map = new Map();
    billProducts.forEach((item) => map.set(String(item.id), item));
    return map;
  }, [billProducts]);

  const paymentProviderMap = useMemo(() => {
    const map = new Map();
    paymentProviders.forEach((item) => map.set(String(item.id), item));
    return map;
  }, [paymentProviders]);

  const loadOptions = async () => {
    try {
      const [billProductRes, paymentProviderRes] = await Promise.all([
        api.billProducts.list(new URLSearchParams({ page: '0', size: '500' })),
        api.paymentProviders.list(new URLSearchParams({ page: '0', size: '500' }))
      ]);
      setBillProducts(toList(billProductRes));
      setPaymentProviders(toList(paymentProviderRes));
    } catch {
      setBillProducts([]);
      setPaymentProviders([]);
    }
  };

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (appliedFilters.scope) params.set('scope', appliedFilters.scope);
      if (appliedFilters.enabled !== '') params.set('enabled', appliedFilters.enabled);
      if (appliedFilters.accountId.trim()) params.set('accountId', appliedFilters.accountId.trim());
      if (appliedFilters.billProductId.trim()) params.set('billProductId', appliedFilters.billProductId.trim());
      if (appliedFilters.paymentProviderId.trim()) params.set('paymentProviderId', appliedFilters.paymentProviderId.trim());
      if (appliedFilters.service.trim()) params.set('service', appliedFilters.service.trim());
      if (appliedFilters.action.trim()) params.set('action', appliedFilters.action.trim());

      const res = await api.loanEligibilityRules.list(params);
      const list = toList(res);
      setRows(list);
      setTotalPages(Math.max(1, Number(res?.totalPages) || 1));
      setTotalElements(Number(res?.totalElements) || list.length);
    } catch (err) {
      setRows([]);
      setError(err?.message || 'Failed to load loan eligibility rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setDraft(emptyDraft);
    setShowForm(true);
    setError(null);
    setInfo(null);
  };

  const openEdit = async (row) => {
    setError(null);
    setInfo(null);
    try {
      const full = row?.id ? await api.loanEligibilityRules.get(row.id) : row;
      setDraft(normalizeRuleDraft(full || row));
      setShowForm(true);
    } catch (err) {
      setError(err?.message || 'Failed to load rule');
    }
  };

  const saveRule = async () => {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const payload = buildPayload(draft);
      if (draft.id) {
        await api.loanEligibilityRules.update(draft.id, payload);
        setInfo(`Updated rule ${draft.id}.`);
      } else {
        await api.loanEligibilityRules.create(payload);
        setInfo('Created loan eligibility rule.');
      }
      setShowForm(false);
      await fetchRows();
    } catch (err) {
      setError(err?.message || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async () => {
    if (!confirmDelete?.id) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.loanEligibilityRules.remove(confirmDelete.id);
      setInfo(`Deleted rule ${confirmDelete.id}.`);
      setConfirmDelete(null);
      await fetchRows();
    } catch (err) {
      setError(err?.message || 'Failed to delete rule');
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    const payload = {};
    if (previewDraft.accountId.trim()) payload.accountId = Number(previewDraft.accountId.trim());
    if (previewDraft.billProductId.trim()) payload.billProductId = Number(previewDraft.billProductId.trim());
    if (previewDraft.paymentProviderId.trim()) payload.paymentProviderId = Number(previewDraft.paymentProviderId.trim());
    if (previewDraft.service.trim()) payload.service = previewDraft.service.trim();
    if (previewDraft.action.trim()) payload.action = previewDraft.action.trim();
    if (previewDraft.revenueAmount.trim()) {
      const revenueAmount = Number(previewDraft.revenueAmount.trim());
      if (!Number.isFinite(revenueAmount) || revenueAmount < 0) {
        setError('Preview revenue amount must be 0 or greater.');
        return;
      }
      payload.revenueAmount = revenueAmount;
    }

    setPreviewLoading(true);
    setError(null);
    setPreviewResult(null);
    try {
      const res = await api.loanEligibilityRules.preview(payload);
      setPreviewResult(res || null);
    } catch (err) {
      setError(err?.message || 'Failed to preview rule resolution');
    } finally {
      setPreviewLoading(false);
    }
  };

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'scope', label: 'Scope', render: (row) => row?.scope || '—' },
      { key: 'account', label: 'Account', render: (row) => row?.accountId ?? '—' },
      {
        key: 'product',
        label: 'Product',
        render: (row) => {
          const productId = row?.billProductId;
          if (!productId) return '—';
          const match = billProductMap.get(String(productId));
          return match ? `${match.displayName || match.name || productId}` : String(productId);
        }
      },
      {
        key: 'paymentProvider',
        label: 'Payment provider',
        render: (row) => {
          const providerId = row?.paymentProviderId;
          if (!providerId) return '—';
          const match = paymentProviderMap.get(String(providerId));
          return match ? `${match.displayName || match.name || providerId}` : String(providerId);
        }
      },
      { key: 'service', label: 'Service', render: (row) => row?.service || '—' },
      { key: 'action', label: 'Action', render: (row) => row?.action || '—' },
      { key: 'eligibilityPercentOfRevenue', label: 'Eligibility % of Revenue', render: (row) => formatPercent(row?.eligibilityPercentOfRevenue) },
      { key: 'enabled', label: 'Enabled', render: (row) => (row?.enabled === false ? 'No' : 'Yes') },
      { key: 'precedence', label: 'Precedence Rank', render: (row) => precedenceRankByScope[String(row?.scope || '').toUpperCase()] ?? '—' },
      { key: 'note', label: 'Note', render: (row) => row?.note || '—' },
      { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row?.createdAt) },
      { key: 'updatedAt', label: 'Updated', render: (row) => formatDateTime(row?.updatedAt) },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => openEdit(row)}>
              Edit
            </button>
            <button type="button" className="btn-danger btn-sm" onClick={() => setConfirmDelete(row)}>
              Delete
            </button>
          </div>
        )
      }
    ],
    [billProductMap, paymentProviderMap]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>Loan Eligibility Rules</div>
          <div style={{ color: 'var(--muted)' }}>
            Define how much revenue becomes loan eligibility for new completed transactions. These rules affect new ledger entries only.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={() => setShowPreview(true)}>
            Rule Preview
          </button>
          <button type="button" className="btn-primary" onClick={openCreate}>
            Add Rule
          </button>
          <Link href="/dashboard/loans" className="btn-neutral" style={{ textDecoration: 'none' }}>
            ← Loans
          </Link>
        </div>
      </div>

      {error ? <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div> : null}
      {info ? <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div> : null}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Filters</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="filter-scope">Scope</label>
            <select id="filter-scope" value={filters.scope} onChange={(e) => setFilters((prev) => ({ ...prev, scope: e.target.value }))}>
              <option value="">All</option>
              {SCOPE_OPTIONS.map((scope) => (
                <option key={scope} value={scope}>{scope}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="filter-enabled">Enabled</label>
            <select id="filter-enabled" value={filters.enabled} onChange={(e) => setFilters((prev) => ({ ...prev, enabled: e.target.value }))}>
              <option value="">All</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="filter-accountId">Account ID</label>
            <input id="filter-accountId" value={filters.accountId} onChange={(e) => setFilters((prev) => ({ ...prev, accountId: e.target.value }))} placeholder="7" />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="filter-billProductId">Bill Product ID</label>
            <input id="filter-billProductId" value={filters.billProductId} onChange={(e) => setFilters((prev) => ({ ...prev, billProductId: e.target.value }))} placeholder="42" />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="filter-paymentProviderId">Payment Provider ID</label>
            <input id="filter-paymentProviderId" value={filters.paymentProviderId} onChange={(e) => setFilters((prev) => ({ ...prev, paymentProviderId: e.target.value }))} placeholder="3" />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="filter-service">Service</label>
            <select id="filter-service" value={filters.service} onChange={(e) => setFilters((prev) => ({ ...prev, service: e.target.value }))}>
              <option value="">All</option>
              {SERVICE_OPTIONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="filter-action">Action</label>
            <select id="filter-action" value={filters.action} onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}>
              <option value="">All</option>
              {ACTION_OPTIONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={() => { setPage(0); setAppliedFilters(filters); }} disabled={loading}>
            {loading ? 'Loading…' : 'Search'}
          </button>
          <button
            type="button"
            className="btn-neutral"
            onClick={() => {
              const reset = { scope: '', enabled: '', accountId: '', billProductId: '', paymentProviderId: '', service: '', action: '' };
              setFilters(reset);
              setAppliedFilters(reset);
              setPage(0);
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={size}
        totalPages={totalPages}
        totalElements={totalElements}
        canPrev={page > 0}
        canNext={page + 1 < totalPages}
        onPageChange={setPage}
        emptyLabel="No loan eligibility rules found"
      />

      {showForm ? (
        <Modal title={draft.id ? `Edit Rule ${draft.id}` : 'Create Loan Eligibility Rule'} onClose={() => (!saving ? setShowForm(false) : null)}>
          <div style={{ display: 'grid', gap: '0.85rem', marginTop: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="rule-scope">Scope</label>
                <select id="rule-scope" value={draft.scope} onChange={(e) => setDraft((prev) => ({ ...prev, scope: e.target.value }))}>
                  {SCOPE_OPTIONS.map((scope) => (
                    <option key={scope} value={scope}>{scope}</option>
                  ))}
                </select>
              </div>
              {draft.scope === 'ACCOUNT' ? (
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  <label htmlFor="rule-accountId">Account ID</label>
                  <input id="rule-accountId" value={draft.accountId} onChange={(e) => setDraft((prev) => ({ ...prev, accountId: e.target.value }))} placeholder="7" />
                </div>
              ) : null}
              {draft.scope === 'PRODUCT' ? (
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  <label htmlFor="rule-billProductId">Bill Product</label>
                  <select id="rule-billProductId" value={draft.billProductId} onChange={(e) => setDraft((prev) => ({ ...prev, billProductId: e.target.value }))}>
                    <option value="">Select product</option>
                    {billProducts.map((item) => (
                      <option key={item.id} value={item.id}>{item.displayName || item.name || `Product ${item.id}`}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              {draft.scope === 'SERVICE' ? (
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  <label htmlFor="rule-service">Service</label>
                  <select id="rule-service" value={draft.service} onChange={(e) => setDraft((prev) => ({ ...prev, service: e.target.value }))}>
                    <option value="">Select service</option>
                    {SERVICE_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              {draft.scope === 'ACTION' ? (
                <div style={{ display: 'grid', gap: '0.25rem' }}>
                  <label htmlFor="rule-action">Action</label>
                  <select id="rule-action" value={draft.action} onChange={(e) => setDraft((prev) => ({ ...prev, action: e.target.value }))}>
                    <option value="">Select action</option>
                    {ACTION_OPTIONS.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="rule-paymentProviderId">Payment Provider ID (advanced)</label>
                <select id="rule-paymentProviderId" value={draft.paymentProviderId} onChange={(e) => setDraft((prev) => ({ ...prev, paymentProviderId: e.target.value }))}>
                  <option value="">None</option>
                  {paymentProviders.map((item) => (
                    <option key={item.id} value={item.id}>{item.displayName || item.name || `Provider ${item.id}`}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="rule-percent">Eligibility % of Revenue</label>
                <input id="rule-percent" type="number" min="0" max="100" step="0.01" value={draft.eligibilityPercentOfRevenue} onChange={(e) => setDraft((prev) => ({ ...prev, eligibilityPercentOfRevenue: e.target.value }))} placeholder="50.00" />
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))} />
                Enabled
              </label>
              <div style={{ display: 'grid', gap: '0.25rem', gridColumn: '1 / -1' }}>
                <label htmlFor="rule-note">Note</label>
                <textarea id="rule-note" rows={3} value={draft.note} onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))} placeholder="Default global fallback" />
              </div>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              Precedence after account custom pricing: ACCOUNT → PRODUCT → ACTION → SERVICE → GLOBAL. Payment provider ID is an advanced narrowing qualifier.
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn-primary" onClick={saveRule} disabled={saving}>{saving ? 'Saving…' : draft.id ? 'Update Rule' : 'Create Rule'}</button>
            </div>
          </div>
        </Modal>
      ) : null}

      {showPreview ? (
        <Modal title="Rule Preview" onClose={() => (!previewLoading ? setShowPreview(false) : null)} width={820}>
          <div style={{ display: 'grid', gap: '0.85rem', marginTop: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="preview-accountId">Account ID</label>
                <input id="preview-accountId" value={previewDraft.accountId} onChange={(e) => setPreviewDraft((prev) => ({ ...prev, accountId: e.target.value }))} placeholder="7" />
              </div>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="preview-billProductId">Bill Product</label>
                <select id="preview-billProductId" value={previewDraft.billProductId} onChange={(e) => setPreviewDraft((prev) => ({ ...prev, billProductId: e.target.value }))}>
                  <option value="">Any</option>
                  {billProducts.map((item) => (
                    <option key={item.id} value={item.id}>{item.displayName || item.name || `Product ${item.id}`}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="preview-paymentProviderId">Payment Provider</label>
                <select id="preview-paymentProviderId" value={previewDraft.paymentProviderId} onChange={(e) => setPreviewDraft((prev) => ({ ...prev, paymentProviderId: e.target.value }))}>
                  <option value="">Any</option>
                  {paymentProviders.map((item) => (
                    <option key={item.id} value={item.id}>{item.displayName || item.name || `Provider ${item.id}`}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="preview-service">Service</label>
                <select id="preview-service" value={previewDraft.service} onChange={(e) => setPreviewDraft((prev) => ({ ...prev, service: e.target.value }))}>
                  <option value="">Any</option>
                  {SERVICE_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="preview-action">Action</label>
                <select id="preview-action" value={previewDraft.action} onChange={(e) => setPreviewDraft((prev) => ({ ...prev, action: e.target.value }))}>
                  <option value="">Any</option>
                  {ACTION_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gap: '0.25rem' }}>
                <label htmlFor="preview-revenueAmount">Revenue Amount</label>
                <input id="preview-revenueAmount" type="number" min="0" step="0.01" value={previewDraft.revenueAmount} onChange={(e) => setPreviewDraft((prev) => ({ ...prev, revenueAmount: e.target.value }))} placeholder="3.00" />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setShowPreview(false)} disabled={previewLoading}>Close</button>
              <button type="button" className="btn-primary" onClick={runPreview} disabled={previewLoading}>{previewLoading ? 'Previewing…' : 'Run Preview'}</button>
            </div>
            {previewResult ? (
              <DetailGrid
                rows={[
                  { label: 'Winning Rule Config ID', value: previewResult.winningRuleConfigId ?? '—' },
                  { label: 'Rule Source', value: previewResult.ruleSource ?? '—' },
                  { label: 'Eligibility % of Revenue', value: formatPercent(previewResult.eligibilityPercentOfRevenue) },
                  { label: 'Untrusted Borrower', value: previewResult.untrustedBorrower === true ? 'Yes' : previewResult.untrustedBorrower === false ? 'No' : '—' },
                  { label: 'Estimated Eligibility Amount', value: formatAmount(previewResult.estimatedEligibilityAmount) }
                ]}
              />
            ) : null}
          </div>
        </Modal>
      ) : null}

      {confirmDelete ? (
        <Modal title={`Delete Rule ${confirmDelete.id}?`} onClose={() => (!saving ? setConfirmDelete(null) : null)} width={540}>
          <div style={{ display: 'grid', gap: '0.85rem', marginTop: '0.75rem' }}>
            <div style={{ color: 'var(--muted)' }}>
              Zero-percent rules are valid and important. Delete this rule only if you want resolution to fall back to the next-precedence rule.
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setConfirmDelete(null)} disabled={saving}>Cancel</button>
              <button type="button" className="btn-danger" onClick={deleteRule} disabled={saving}>{saving ? 'Deleting…' : 'Delete Rule'}</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
