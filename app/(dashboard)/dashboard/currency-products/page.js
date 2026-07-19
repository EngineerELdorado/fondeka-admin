'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const currencyOptions = ['USD', 'CDF', 'EUR', 'KES', 'GHS', 'XAF'];
const rateProviderOptions = ['MANUAL', 'MAPLERAD'];

const emptyDraft = {
  currency: '',
  displayName: '',
  logoUrl: '',
  active: true,
  walletEnabled: true,
  legacyBalanceBacked: false,
  baseCurrency: 'USD',
  rate: '',
  collectionMarginPercent: '',
  payoutMarginPercent: '',
  rateProvider: 'MANUAL',
  rateFetchedAt: ''
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={{ gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
          x
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
        <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{row.value ?? '-'}</div>
      </div>
    ))}
  </div>
);

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatBool = (value) => (value ? 'Yes' : 'No');

const formatPercent = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  return `${value}%`;
};

const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const upperTrim = (value) => String(value || '').trim().toUpperCase();

const nullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export default function CurrencyProductsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.currencyProducts.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err.message || 'Failed to load currency products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateDraft = () => {
    const currency = upperTrim(draft.currency);
    const baseCurrency = upperTrim(draft.baseCurrency);
    const rate = Number(draft.rate);
    const collectionMarginPercent = nullableNumber(draft.collectionMarginPercent);
    const payoutMarginPercent = nullableNumber(draft.payoutMarginPercent);
    if (!currency) return 'Currency is required.';
    if (!draft.displayName.trim()) return 'Display name is required.';
    if (!baseCurrency) return 'Base currency is required.';
    if (!Number.isFinite(rate) || rate <= 0) return 'Rate must be a positive number.';
    if (draft.collectionMarginPercent !== '' && (collectionMarginPercent === null || collectionMarginPercent < 0)) return 'Collection margin must be zero or a positive number.';
    if (draft.payoutMarginPercent !== '' && (payoutMarginPercent === null || payoutMarginPercent < 0)) return 'Payout margin must be zero or a positive number.';
    if (!upperTrim(draft.rateProvider)) return 'Rate provider is required.';
    if (draft.rateFetchedAt && !toIsoOrNull(draft.rateFetchedAt)) return 'Rate fetched at must be a valid date and time.';
    return null;
  };

  const buildPayload = () => ({
    currency: upperTrim(draft.currency),
    displayName: draft.displayName.trim(),
    logoUrl: draft.logoUrl.trim() || null,
    active: Boolean(draft.active),
    walletEnabled: Boolean(draft.walletEnabled),
    legacyBalanceBacked: Boolean(draft.legacyBalanceBacked),
    baseCurrency: upperTrim(draft.baseCurrency),
    rate: Number(draft.rate),
    collectionMarginPercent: nullableNumber(draft.collectionMarginPercent),
    payoutMarginPercent: nullableNumber(draft.payoutMarginPercent),
    rateProvider: upperTrim(draft.rateProvider),
    rateFetchedAt: toIsoOrNull(draft.rateFetchedAt)
  });

  const openCreate = () => {
    setDraft({ ...emptyDraft, rateFetchedAt: toDateTimeLocal(new Date().toISOString()) });
    setSelected(null);
    setShowCreate(true);
    setError(null);
    setInfo(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      currency: row.currency ?? '',
      displayName: row.displayName ?? '',
      logoUrl: row.logoUrl ?? '',
      active: row.active ?? true,
      walletEnabled: row.walletEnabled ?? true,
      legacyBalanceBacked: row.legacyBalanceBacked ?? false,
      baseCurrency: row.baseCurrency ?? 'USD',
      rate: row.rate ?? '',
      collectionMarginPercent: row.collectionMarginPercent ?? '',
      payoutMarginPercent: row.payoutMarginPercent ?? '',
      rateProvider: row.rateProvider ?? 'MANUAL',
      rateFetchedAt: toDateTimeLocal(row.rateFetchedAt)
    });
    setShowEdit(true);
    setError(null);
    setInfo(null);
  };

  const openDetail = async (row) => {
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      const data = await api.currencyProducts.get(row.id);
      setSelected(data || row);
      setShowDetail(true);
    } catch (err) {
      setError(err.message || `Failed to load currency product ${row.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async () => {
    const message = validateDraft();
    if (message) {
      setError(message);
      return;
    }
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.currencyProducts.create(buildPayload());
      setInfo('Created currency product.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to create currency product.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    const message = validateDraft();
    if (message) {
      setError(message);
      return;
    }
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.currencyProducts.update(selected.id, buildPayload());
      setInfo(`Updated currency product ${selected.id}.`);
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to update currency product ${selected.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete?.id) return;
    const id = confirmDelete.id;
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.currencyProducts.remove(id);
      setInfo(`Deleted currency product ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to delete currency product ${id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async (row) => {
    if (!row?.id) return;
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.currencyProducts.update(row.id, {
        currency: row.currency,
        displayName: row.displayName,
        active: false
      });
      setInfo(`Deactivated currency product ${row.currency || row.id}.`);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to deactivate currency product ${row.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size : page + 1 < pageMeta.totalPages;

  const columns = [
    {
      key: 'currency',
      label: 'Currency',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {row.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.logoUrl} alt="" width={28} height={28} style={{ borderRadius: '999px', objectFit: 'cover', border: '1px solid var(--border)' }} />
          ) : null}
          <strong>{row.currency || '-'}</strong>
        </div>
      )
    },
    { key: 'displayName', label: 'Display name' },
    { key: 'rate', label: 'Rate' },
    { key: 'baseCurrency', label: 'Base' },
    { key: 'collectionMarginPercent', label: 'Collection margin', render: (row) => formatPercent(row.collectionMarginPercent) },
    { key: 'payoutMarginPercent', label: 'Payout margin', render: (row) => formatPercent(row.payoutMarginPercent) },
    { key: 'walletEnabled', label: 'Wallet', render: (row) => formatBool(row.walletEnabled) },
    { key: 'active', label: 'Active', render: (row) => formatBool(row.active) },
    { key: 'rateProvider', label: 'Provider', hideOnMobile: true },
    { key: 'rateFetchedAt', label: 'Rate fetched', hideOnMobile: true, render: (row) => formatDateTime(row.rateFetchedAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral" disabled={actionLoading}>View</button>
          <button type="button" onClick={() => openEdit(row)} className="btn-neutral" disabled={actionLoading}>Edit</button>
          {row.active ? <button type="button" onClick={() => handleDeactivate(row)} className="btn-neutral" disabled={actionLoading}>Deactivate</button> : null}
          <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger" disabled={actionLoading}>Delete</button>
        </div>
      )
    }
  ];

  const renderCurrencyInput = (id, label, value, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label htmlFor={id}>{label}</label>
      <input id={id} list="currencyProductCurrencyOptions" value={value} onChange={onChange} onBlur={onChange} />
    </div>
  );

  const renderCheckbox = (id, label, checked, onChange) => (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: '38px' }}>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      {renderCurrencyInput('currency', 'Currency', draft.currency, (e) => setDraft((p) => ({ ...p, currency: e.target.value.toUpperCase() })))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="displayName">Display name</label>
        <input id="displayName" value={draft.displayName} onChange={(e) => setDraft((p) => ({ ...p, displayName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="logoUrl">Logo URL</label>
        <input id="logoUrl" type="url" value={draft.logoUrl} onChange={(e) => setDraft((p) => ({ ...p, logoUrl: e.target.value }))} placeholder="https://..." />
      </div>
      {renderCurrencyInput('baseCurrency', 'Base currency', draft.baseCurrency, (e) => setDraft((p) => ({ ...p, baseCurrency: e.target.value.toUpperCase() })))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rate">Rate</label>
        <input id="rate" type="number" min="0" step="0.000001" value={draft.rate} onChange={(e) => setDraft((p) => ({ ...p, rate: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="collectionMarginPercent">Collection margin %</label>
        <input id="collectionMarginPercent" type="number" min="0" step="0.01" value={draft.collectionMarginPercent} onChange={(e) => setDraft((p) => ({ ...p, collectionMarginPercent: e.target.value }))} placeholder="0" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="payoutMarginPercent">Payout margin %</label>
        <input id="payoutMarginPercent" type="number" min="0" step="0.01" value={draft.payoutMarginPercent} onChange={(e) => setDraft((p) => ({ ...p, payoutMarginPercent: e.target.value }))} placeholder="0" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rateProvider">Rate provider</label>
        <input id="rateProvider" list="currencyProductRateProviderOptions" value={draft.rateProvider} onChange={(e) => setDraft((p) => ({ ...p, rateProvider: e.target.value.toUpperCase() }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rateFetchedAt">Rate fetched at</label>
        <input id="rateFetchedAt" type="datetime-local" value={draft.rateFetchedAt} onChange={(e) => setDraft((p) => ({ ...p, rateFetchedAt: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {renderCheckbox('active', 'Active', draft.active, (e) => setDraft((p) => ({ ...p, active: e.target.checked })))}
        {renderCheckbox('walletEnabled', 'Wallet enabled', draft.walletEnabled, (e) => setDraft((p) => ({ ...p, walletEnabled: e.target.checked })))}
        {renderCheckbox('legacyBalanceBacked', 'Legacy balance backed', draft.legacyBalanceBacked, (e) => setDraft((p) => ({ ...p, legacyBalanceBacked: e.target.checked })))}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <datalist id="currencyProductCurrencyOptions">
        {currencyOptions.map((currency) => <option key={currency} value={currency} />)}
      </datalist>
      <datalist id="currencyProductRateProviderOptions">
        {rateProviderOptions.map((provider) => <option key={provider} value={provider} />)}
      </datalist>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Currency Products</div>
          <div style={{ color: 'var(--muted)' }}>Manage fiat currency products, wallet availability, and manual rates.</div>
        </div>
        <Link href="/dashboard" className="btn-neutral">
          {'<- Dashboard'}
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>Products</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={fetchRows} disabled={loading || actionLoading} className="btn-neutral btn-sm">
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button type="button" onClick={openCreate} disabled={actionLoading} className="btn-success btn-sm">
              Create product
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="page">Page</label>
            <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Math.max(0, Number(e.target.value) || 0))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="size">Size</label>
            <input id="size" type="number" min={1} max={200} value={size} onChange={(e) => { setSize(Math.max(1, Number(e.target.value) || 1)); setPage(0); }} />
          </div>
        </div>

        {pageMeta.totalElements !== null && (
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {pageMeta.totalElements} products total{pageMeta.totalPages !== null && pageMeta.totalPages > 0 ? ` | page ${page + 1}/${pageMeta.totalPages}` : ''}
          </span>
        )}
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={size}
        totalPages={pageMeta.totalPages}
        totalElements={pageMeta.totalElements}
        onPageChange={setPage}
        canPrev={canPrev}
        canNext={canNext}
        emptyLabel="No currency products found"
        showAccountQuickNav={false}
      />

      {showCreate && (
        <Modal title="Create currency product" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral" disabled={actionLoading}>Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success" disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Create'}</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit currency product ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral" disabled={actionLoading}>Cancel</button>
            <button type="button" onClick={handleUpdate} className="btn-primary" disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Currency product ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Currency', value: selected?.currency },
              { label: 'Display name', value: selected?.displayName },
              { label: 'Logo URL', value: selected?.logoUrl },
              { label: 'Active', value: formatBool(selected?.active) },
              { label: 'Wallet enabled', value: formatBool(selected?.walletEnabled) },
              { label: 'Legacy balance backed', value: formatBool(selected?.legacyBalanceBacked) },
              { label: 'Base currency', value: selected?.baseCurrency },
              { label: 'Rate', value: selected?.rate },
              { label: 'Collection margin', value: formatPercent(selected?.collectionMarginPercent) },
              { label: 'Payout margin', value: formatPercent(selected?.payoutMarginPercent) },
              { label: 'Rate provider', value: selected?.rateProvider },
              { label: 'Rate fetched at', value: formatDateTime(selected?.rateFetchedAt) },
              { label: 'Created at', value: formatDateTime(selected?.createdAt) },
              { label: 'Updated at', value: formatDateTime(selected?.updatedAt) }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete currency product <strong>{confirmDelete.currency || confirmDelete.id}</strong>? This cannot be undone and may fail when wallets or fee configs reference it. Deactivate the product when you only need to hide it from clients.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral" disabled={actionLoading}>Cancel</button>
            {confirmDelete.active ? <button type="button" onClick={() => { handleDeactivate(confirmDelete); setConfirmDelete(null); }} className="btn-neutral" disabled={actionLoading}>Deactivate instead</button> : null}
            <button type="button" onClick={handleDelete} className="btn-danger" disabled={actionLoading}>{actionLoading ? 'Deleting...' : 'Delete'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
