'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const serviceOptions = ['BILL_PAYMENTS', 'CARD'];
const rateSourceOptions = ['OUR_RATE', 'PROVIDER_RATE', 'NO_CONVERSION'];
const actionOptions = [
  'PAY_TV_SUBSCRIPTION',
  'PAY_ELECTRICITY_BILL',
  'PAY_WATER_BILL',
  'PAY_INTERNET_BILL',
  'BUY_GIFT_CARD',
  'PAY_NETFLIX',
  'FUND_CARD',
  'WITHDRAW_FROM_CARD',
  'BUY_CARD',
  'CARD_ONLINE_PAYMENT',
  'CARD_PAYMENT_REVERSAL',
  'CARD_MAINTENANCE'
].sort();

const emptyState = {
  service: '',
  action: '',
  billProductBillProviderId: '',
  cardProductCardProviderId: '',
  providerName: '',
  countryCode: '',
  sourceCurrency: '',
  targetCurrency: '',
  rateSource: 'OUR_RATE',
  providerFxRate: '',
  providerFxProvider: '',
  active: true,
  rank: 100
};

const optionalNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const uppercaseOrNull = (value) => {
  const text = String(value || '').trim().toUpperCase();
  return text || null;
};

const toPayload = (state) => ({
  service: uppercaseOrNull(state.service),
  action: uppercaseOrNull(state.action),
  billProductBillProviderId: optionalNumber(state.billProductBillProviderId),
  cardProductCardProviderId: optionalNumber(state.cardProductCardProviderId),
  providerName: uppercaseOrNull(state.providerName),
  countryCode: uppercaseOrNull(state.countryCode),
  sourceCurrency: uppercaseOrNull(state.sourceCurrency),
  targetCurrency: uppercaseOrNull(state.targetCurrency),
  rateSource: state.rateSource || 'OUR_RATE',
  providerFxRate: state.rateSource === 'PROVIDER_RATE' ? Number(state.providerFxRate) : null,
  providerFxProvider: state.providerFxProvider?.trim() ? state.providerFxProvider.trim() : null,
  active: Boolean(state.active),
  rank: state.rank === '' ? 100 : Number(state.rank)
});

const draftFromRow = (row) => ({
  service: row.service ?? '',
  action: row.action ?? '',
  billProductBillProviderId: row.billProductBillProviderId ?? '',
  cardProductCardProviderId: row.cardProductCardProviderId ?? '',
  providerName: row.providerName ?? '',
  countryCode: row.countryCode ?? '',
  sourceCurrency: row.sourceCurrency ?? '',
  targetCurrency: row.targetCurrency ?? '',
  rateSource: row.rateSource || 'OUR_RATE',
  providerFxRate: row.providerFxRate ?? '',
  providerFxProvider: row.providerFxProvider ?? '',
  active: Boolean(row.active),
  rank: row.rank ?? 100
});

const policyScope = (row) => {
  const parts = [];
  if (row?.billProductBillProviderId) parts.push(`Bill route #${row.billProductBillProviderId}`);
  if (row?.cardProductCardProviderId) parts.push(`Card route #${row.cardProductCardProviderId}`);
  if (row?.providerName) parts.push(row.providerName);
  if (row?.countryCode) parts.push(row.countryCode);
  if (row?.action) parts.push(row.action);
  return parts.length ? parts.join(' • ') : 'Generic';
};

const conversionLabel = (row) => {
  if (row?.rateSource === 'NO_CONVERSION') return 'No conversion';
  if (row?.rateSource === 'PROVIDER_RATE') return `Provider rate${row?.providerFxRate ? ` × ${row.providerFxRate}` : ''}`;
  return 'Fondeka rate';
};

const providerOptionName = (provider) =>
  String(
    provider?.name ||
    provider?.displayName ||
    provider?.billProviderName ||
    provider?.cardProviderName ||
    provider?.providerName ||
    ''
  ).trim().toUpperCase();

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
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
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700, wordBreak: 'break-word' }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

export default function ProviderFxPoliciesPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [providerOptions, setProviderOptions] = useState([]);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.providerFxPolicies.list(params);
      setRows(Array.isArray(res) ? res : res?.content || []);
    } catch (err) {
      setError(err.message || 'Failed to load provider FX policies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    const loadProviders = async () => {
      try {
        const [billRes, cardRes] = await Promise.all([
          api.billProviders.list(new URLSearchParams({ page: '0', size: '500' })),
          api.cardProviders.list(new URLSearchParams({ page: '0', size: '500' }))
        ]);
        if (cancelled) return;
        const toList = (res) => (Array.isArray(res) ? res : res?.content || []);
        const names = [...toList(billRes), ...toList(cardRes)]
          .map(providerOptionName)
          .filter(Boolean);
        setProviderOptions([...new Set(names)].sort());
      } catch {
        if (!cancelled) setProviderOptions([]);
      }
    };
    loadProviders();
    return () => {
      cancelled = true;
    };
  }, []);

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'service', label: 'Service' },
    { key: 'action', label: 'Action', render: (row) => row.action || '—' },
    { key: 'scope', label: 'Scope', render: policyScope },
    {
      key: 'pair',
      label: 'Pair',
      render: (row) => `${row.sourceCurrency || '—'} → ${row.targetCurrency || '—'}`
    },
    { key: 'rateSource', label: 'Rate source', render: conversionLabel },
    { key: 'active', label: 'Active', render: (row) => (row.active === null || row.active === undefined ? '—' : String(row.active)) },
    { key: 'rank', label: 'Rank' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={() => openDetail(row)}>View</button>
          <button type="button" className="btn-neutral" onClick={() => openEdit(row)}>Edit</button>
          <button type="button" className="btn-danger" onClick={() => setConfirmDelete(row)}>Delete</button>
        </div>
      )
    }
  ], []);

  const validateDraft = () => {
    if (!draft.service) return 'Select service.';
    if (!draft.sourceCurrency) return 'Source currency is required.';
    if (!draft.targetCurrency) return 'Target currency is required.';
    if (draft.rateSource === 'PROVIDER_RATE' && !(Number(draft.providerFxRate) > 0)) {
      return 'Provider FX rate is required for PROVIDER_RATE.';
    }
    return null;
  };

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setError(null);
    setInfo(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft(draftFromRow(row));
    setShowEdit(true);
    setError(null);
    setInfo(null);
  };

  const openDetail = (row) => {
    setSelected(row);
    setShowDetail(true);
    setError(null);
    setInfo(null);
  };

  const saveCreate = async () => {
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.providerFxPolicies.create(toPayload(draft));
      setInfo('Created provider FX policy.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to create provider FX policy.');
    }
  };

  const saveUpdate = async () => {
    if (!selected?.id) return;
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.providerFxPolicies.update(selected.id, toPayload(draft));
      setInfo(`Updated provider FX policy ${selected.id}.`);
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to update provider FX policy.');
    }
  };

  const deletePolicy = async () => {
    if (!confirmDelete?.id) return;
    setError(null);
    setInfo(null);
    try {
      await api.providerFxPolicies.remove(confirmDelete.id);
      setInfo(`Deleted provider FX policy ${confirmDelete.id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to delete provider FX policy.');
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="service">Service</label>
        <select id="service" value={draft.service} onChange={(e) => setDraft((p) => ({ ...p, service: e.target.value }))}>
          <option value="">Select service</option>
          {serviceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="action">Action</label>
        <input
          id="action"
          value={draft.action}
          list="provider-fx-policy-actions"
          onChange={(e) => setDraft((p) => ({ ...p, action: e.target.value.toUpperCase() }))}
          placeholder="Optional"
        />
        <datalist id="provider-fx-policy-actions">
          {actionOptions.map((option) => <option key={option} value={option} />)}
        </datalist>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="billProductBillProviderId">Bill product-provider ID</label>
        <input id="billProductBillProviderId" type="number" min="1" value={draft.billProductBillProviderId} onChange={(e) => setDraft((p) => ({ ...p, billProductBillProviderId: e.target.value }))} placeholder="Optional" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="cardProductCardProviderId">Card product-provider ID</label>
        <input id="cardProductCardProviderId" type="number" min="1" value={draft.cardProductCardProviderId} onChange={(e) => setDraft((p) => ({ ...p, cardProductCardProviderId: e.target.value }))} placeholder="Optional" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="providerName">Provider name</label>
        <input
          id="providerName"
          value={draft.providerName}
          list="provider-fx-policy-providers"
          onChange={(e) => setDraft((p) => ({ ...p, providerName: e.target.value.toUpperCase() }))}
          placeholder="UMEME, CGAWEB, BRIDGECARD"
        />
        <datalist id="provider-fx-policy-providers">
          {providerOptions.map((option) => <option key={option} value={option} />)}
        </datalist>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Pick an existing provider or type a provider name manually.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="countryCode">Country code</label>
        <input id="countryCode" value={draft.countryCode} onChange={(e) => setDraft((p) => ({ ...p, countryCode: e.target.value.toUpperCase() }))} placeholder="CD, COD, RW" maxLength={3} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="sourceCurrency">Source currency</label>
        <input id="sourceCurrency" value={draft.sourceCurrency} onChange={(e) => setDraft((p) => ({ ...p, sourceCurrency: e.target.value.toUpperCase() }))} placeholder="CDF" maxLength={3} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="targetCurrency">Target currency</label>
        <input id="targetCurrency" value={draft.targetCurrency} onChange={(e) => setDraft((p) => ({ ...p, targetCurrency: e.target.value.toUpperCase() }))} placeholder="USD" maxLength={3} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rateSource">Rate source</label>
        <select
          id="rateSource"
          value={draft.rateSource}
          onChange={(e) => setDraft((p) => ({ ...p, rateSource: e.target.value, providerFxRate: e.target.value === 'PROVIDER_RATE' ? p.providerFxRate : '' }))}
        >
          {rateSourceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
      {draft.rateSource === 'PROVIDER_RATE' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="providerFxRate">Provider FX rate</label>
          <input id="providerFxRate" type="number" min="0" step="0.00000001" value={draft.providerFxRate} onChange={(e) => setDraft((p) => ({ ...p, providerFxRate: e.target.value }))} placeholder="Required for PROVIDER_RATE" />
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="providerFxProvider">Provider FX provider</label>
        <input id="providerFxProvider" value={draft.providerFxProvider} onChange={(e) => setDraft((p) => ({ ...p, providerFxProvider: e.target.value }))} placeholder="Optional label" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rank">Rank</label>
        <input id="rank" type="number" value={draft.rank} onChange={(e) => setDraft((p) => ({ ...p, rank: e.target.value }))} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '40px' }}>
        <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))} />
        <span>Active</span>
      </label>
    </div>
  );

  const detailRows = [
    { label: 'ID', value: selected?.id },
    { label: 'Service', value: selected?.service },
    { label: 'Action', value: selected?.action || '—' },
    { label: 'Bill product-provider ID', value: selected?.billProductBillProviderId ?? '—' },
    { label: 'Card product-provider ID', value: selected?.cardProductCardProviderId ?? '—' },
    { label: 'Provider name', value: selected?.providerName || '—' },
    { label: 'Country code', value: selected?.countryCode || '—' },
    { label: 'Source currency', value: selected?.sourceCurrency || '—' },
    { label: 'Target currency', value: selected?.targetCurrency || '—' },
    { label: 'Rate source', value: selected?.rateSource || '—' },
    { label: 'Provider FX rate', value: selected?.providerFxRate ?? '—' },
    { label: 'Provider FX provider', value: selected?.providerFxProvider || '—' },
    { label: 'Active', value: selected?.active === null || selected?.active === undefined ? '—' : String(selected.active) },
    { label: 'Rank', value: selected?.rank ?? '—' },
    { label: 'Created at', value: selected?.createdAt || '—' },
    { label: 'Updated at', value: selected?.updatedAt || '—' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Provider FX Policies</div>
          <div style={{ color: 'var(--muted)' }}>Control provider-specific conversion behavior for bill and card provider submissions.</div>
        </div>
        <Link href="/dashboard/payments" className="btn-neutral" style={{ textDecoration: 'none' }}>
          Payments hub
        </Link>
      </div>

      <div className="card" style={{ color: 'var(--muted)', fontSize: '13px', display: 'grid', gap: '0.35rem' }}>
        <div><strong>providerCurrency</strong> is configured on the bill/card product-provider mapping and is the currency the external provider expects or prices in.</div>
        <div><strong>Provider FX policy</strong> is optional product/provider-specific FX used to build the provider quote before submission.</div>
        <div><strong>Currency product FX</strong> remains the normal app-wide FX used after that when the client asks to display in another currency.</div>
        <div>If no policy matches, the backend uses Fondeka’s normal FX rate.</div>
        <div>More specific policies win over generic policies. Rank only decides ties.</div>
        <div><strong>NO_CONVERSION</strong> keeps the customer/input amount in its original currency for provider submission.</div>
        <div><strong>PROVIDER_RATE</strong> multiplies by providerFxRate. <strong>OUR_RATE</strong> uses Fondeka’s configured FX rate.</div>
        <div>Example: Canal+ Rwanda sold to Congo can use BILL_PAYMENTS, PAY_TV_SUBSCRIPTION, CGAWEB, CD/COD, RWF → USD, PROVIDER_RATE, rate 0.001 when 1 USD = 1000 RWF.</div>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="page">Page</label>
          <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="size">Size</label>
          <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button type="button" onClick={openCreate} className="btn-success">
          Add policy
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No provider FX policies found" />

      {showCreate && (
        <Modal title="Add provider FX policy" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={saveCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit provider FX policy ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={saveUpdate} className="btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Provider FX policy ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid rows={detailRows} />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete provider FX policy <strong>{confirmDelete.id}</strong>? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={deletePolicy} className="btn-danger">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
