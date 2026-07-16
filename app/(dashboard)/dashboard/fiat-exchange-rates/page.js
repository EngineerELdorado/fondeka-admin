'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const providerOptions = ['MAPLERAD'];
const currencyOptions = ['USD', 'KES', 'GHS', 'XAF', 'CDF', 'EUR'];

const emptyFilters = {
  provider: '',
  sourceCurrency: '',
  targetCurrency: '',
  fetchedFrom: '',
  fetchedTo: '',
  q: ''
};

const emptyDraft = {
  provider: 'MAPLERAD',
  sourceCurrency: 'USD',
  targetCurrency: '',
  rate: '',
  fetchedAt: '',
  rawPayload: ''
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
        <div style={{ fontWeight: 700, overflowWrap: 'anywhere', whiteSpace: row.pre ? 'pre-wrap' : 'normal' }}>{row.value ?? '-'}</div>
      </div>
    ))}
  </div>
);

const FilterChip = ({ label, onClear }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.6rem', background: 'var(--muted-bg, #f3f4f6)', borderRadius: '999px', fontSize: '13px', color: 'var(--text)' }}>
    {label}
    <button type="button" onClick={onClear} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }} aria-label={`Clear ${label}`}>
      x
    </button>
  </span>
);

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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

export default function FiatExchangeRatesPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
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
  const [syncingMaplerad, setSyncingMaplerad] = useState(false);

  const activeFilterChips = useMemo(() => {
    const chips = [];
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
      const labels = {
        provider: 'Provider',
        sourceCurrency: 'Source',
        targetCurrency: 'Target',
        fetchedFrom: 'Fetched from',
        fetchedTo: 'Fetched to',
        q: 'Search'
      };
      chips.push({ key, label: `${labels[key]}: ${value}` });
    });
    return chips;
  }, [appliedFilters]);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        if (key === 'fetchedFrom' || key === 'fetchedTo') {
          const iso = toIsoOrNull(value);
          if (iso) params.set(key, iso);
          return;
        }
        params.set(key, String(value).trim());
      });
      const res = await api.fiatExchangeRates.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err.message || 'Failed to load fiat FX rates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateDraft = () => {
    const provider = upperTrim(draft.provider);
    const sourceCurrency = upperTrim(draft.sourceCurrency);
    const targetCurrency = upperTrim(draft.targetCurrency);
    const rate = Number(draft.rate);
    if (!provider) return 'Provider is required.';
    if (!sourceCurrency) return 'Source currency is required.';
    if (!targetCurrency) return 'Target currency is required.';
    if (sourceCurrency === targetCurrency) return 'Source and target currency cannot be the same.';
    if (!Number.isFinite(rate) || rate <= 0) return 'Rate must be a positive number.';
    if (!toIsoOrNull(draft.fetchedAt)) return 'Fetched at must be a valid date and time.';
    const duplicate = rows.find((row) => (
      row.id !== selected?.id
      && upperTrim(row.provider) === provider
      && upperTrim(row.sourceCurrency) === sourceCurrency
      && upperTrim(row.targetCurrency) === targetCurrency
    ));
    if (duplicate) return `A rate already exists for ${provider} ${sourceCurrency}/${targetCurrency}.`;
    return null;
  };

  const buildPayload = () => ({
    provider: upperTrim(draft.provider),
    sourceCurrency: upperTrim(draft.sourceCurrency),
    targetCurrency: upperTrim(draft.targetCurrency),
    rate: Number(draft.rate),
    fetchedAt: toIsoOrNull(draft.fetchedAt),
    rawPayload: draft.rawPayload.trim() || null
  });

  const openCreate = () => {
    setDraft({ ...emptyDraft, fetchedAt: toDateTimeLocal(new Date().toISOString()) });
    setSelected(null);
    setShowCreate(true);
    setError(null);
    setInfo(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      provider: row.provider ?? '',
      sourceCurrency: row.sourceCurrency ?? '',
      targetCurrency: row.targetCurrency ?? '',
      rate: row.rate ?? '',
      fetchedAt: toDateTimeLocal(row.fetchedAt),
      rawPayload: row.rawPayload ?? ''
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
      const data = await api.fiatExchangeRates.get(row.id);
      setSelected(data || row);
      setShowDetail(true);
    } catch (err) {
      setError(err.message || `Failed to load fiat FX rate ${row.id}.`);
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
      await api.fiatExchangeRates.create(buildPayload());
      setInfo('Created fiat FX rate.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to create fiat FX rate.');
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
      await api.fiatExchangeRates.update(selected.id, buildPayload());
      setInfo(`Updated fiat FX rate ${selected.id}.`);
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to update fiat FX rate ${selected.id}.`);
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
      await api.fiatExchangeRates.remove(id);
      setInfo(`Deleted fiat FX rate ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to delete fiat FX rate ${id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncMaplerad = async () => {
    setSyncingMaplerad(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.fiatExchangeRates.syncMaplerad();
      const refreshed = Number.isFinite(res?.refreshed) ? res.refreshed : 0;
      const triggeredAt = res?.triggeredAt ? ` at ${formatDateTime(res.triggeredAt)}` : '';
      setInfo(`Maplerad FX sync refreshed ${refreshed} default pair${refreshed === 1 ? '' : 's'}${triggeredAt}.`);
      await fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to sync Maplerad FX rates.');
    } finally {
      setSyncingMaplerad(false);
    }
  };

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size : page + 1 < pageMeta.totalPages;

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'provider', label: 'Provider' },
    { key: 'pair', label: 'Pair', render: (row) => `${row.sourceCurrency || '-'} / ${row.targetCurrency || '-'}` },
    { key: 'rate', label: 'Rate' },
    { key: 'fetchedAt', label: 'Fetched at', render: (row) => formatDateTime(row.fetchedAt) },
    { key: 'updatedAt', label: 'Updated at', hideOnMobile: true, render: (row) => formatDateTime(row.updatedAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral" disabled={actionLoading}>View</button>
          <button type="button" onClick={() => openEdit(row)} className="btn-neutral" disabled={actionLoading}>Edit</button>
          <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger" disabled={actionLoading}>Delete</button>
        </div>
      )
    }
  ], [actionLoading]);

  const renderCurrencyInput = (id, label, value, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label htmlFor={id}>{label}</label>
      <input id={id} list="fiatCurrencyOptions" value={value} onChange={onChange} onBlur={onChange} />
    </div>
  );

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="provider">Provider</label>
        <input id="provider" list="fiatProviderOptions" value={draft.provider} onChange={(e) => setDraft((p) => ({ ...p, provider: e.target.value.toUpperCase() }))} />
      </div>
      {renderCurrencyInput('sourceCurrency', 'Source currency', draft.sourceCurrency, (e) => setDraft((p) => ({ ...p, sourceCurrency: e.target.value.toUpperCase() })))}
      {renderCurrencyInput('targetCurrency', 'Target currency', draft.targetCurrency, (e) => setDraft((p) => ({ ...p, targetCurrency: e.target.value.toUpperCase() })))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rate">Rate</label>
        <input id="rate" type="number" min="0" step="0.000001" value={draft.rate} onChange={(e) => setDraft((p) => ({ ...p, rate: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="fetchedAt">Fetched at</label>
        <input id="fetchedAt" type="datetime-local" value={draft.fetchedAt} onChange={(e) => setDraft((p) => ({ ...p, fetchedAt: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: '1 / -1' }}>
        <label htmlFor="rawPayload">Raw payload</label>
        <textarea id="rawPayload" rows={5} value={draft.rawPayload} onChange={(e) => setDraft((p) => ({ ...p, rawPayload: e.target.value }))} placeholder='{"source":"manual-admin"}' />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <datalist id="fiatProviderOptions">
        {providerOptions.map((provider) => <option key={provider} value={provider} />)}
      </datalist>
      <datalist id="fiatCurrencyOptions">
        {currencyOptions.map((currency) => <option key={currency} value={currency} />)}
      </datalist>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Fiat FX Rates</div>
          <div style={{ color: 'var(--muted)' }}>Manage provider fiat exchange rates by currency pair.</div>
        </div>
        <Link href="/dashboard" className="btn-neutral">
          {'<- Dashboard'}
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>Filters</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
            <button type="button" onClick={fetchRows} disabled={loading || actionLoading} className="btn-neutral btn-sm">
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button type="button" onClick={handleSyncMaplerad} disabled={loading || actionLoading || syncingMaplerad} className="btn-primary btn-sm">
              {syncingMaplerad ? 'Syncing Maplerad...' : 'Sync Maplerad'}
            </button>
            <button type="button" onClick={openCreate} disabled={actionLoading} className="btn-success btn-sm">
              Create rate
            </button>
          </div>
        </div>

        {activeFilterChips.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {activeFilterChips.map((chip) => (
              <FilterChip
                key={chip.key}
                label={chip.label}
                onClear={() => {
                  const next = { ...appliedFilters, [chip.key]: '' };
                  setAppliedFilters(next);
                  setFilters(next);
                  setPage(0);
                }}
              />
            ))}
          </div>
        )}

        {showFilters && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterProvider">Provider</label>
                <input id="filterProvider" list="fiatProviderOptions" value={filters.provider} onChange={(e) => setFilters((p) => ({ ...p, provider: e.target.value.toUpperCase() }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterSourceCurrency">Source currency</label>
                <input id="filterSourceCurrency" list="fiatCurrencyOptions" value={filters.sourceCurrency} onChange={(e) => setFilters((p) => ({ ...p, sourceCurrency: e.target.value.toUpperCase() }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterTargetCurrency">Target currency</label>
                <input id="filterTargetCurrency" list="fiatCurrencyOptions" value={filters.targetCurrency} onChange={(e) => setFilters((p) => ({ ...p, targetCurrency: e.target.value.toUpperCase() }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterFetchedFrom">Fetched from</label>
                <input id="filterFetchedFrom" type="datetime-local" value={filters.fetchedFrom} onChange={(e) => setFilters((p) => ({ ...p, fetchedFrom: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterFetchedTo">Fetched to</label>
                <input id="filterFetchedTo" type="datetime-local" value={filters.fetchedTo} onChange={(e) => setFilters((p) => ({ ...p, fetchedTo: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="filterQ">Search</label>
                <input id="filterQ" value={filters.q} onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="page">Page</label>
                <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Math.max(0, Number(e.target.value) || 0))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="size">Size</label>
                <input id="size" type="number" min={1} max={200} value={size} onChange={(e) => { setSize(Math.max(1, Number(e.target.value) || 1)); setPage(0); }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={() => { setAppliedFilters(filters); setPage(0); }} disabled={loading} className="btn-primary">
                {loading ? 'Loading...' : 'Apply'}
              </button>
              <button type="button" onClick={() => { setFilters(emptyFilters); setAppliedFilters(emptyFilters); setPage(0); }} disabled={loading} className="btn-neutral">
                Reset
              </button>
            </div>
          </>
        )}

        {pageMeta.totalElements !== null && (
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {pageMeta.totalElements} rates total{pageMeta.totalPages !== null && pageMeta.totalPages > 0 ? ` | page ${page + 1}/${pageMeta.totalPages}` : ''}
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
        emptyLabel="No fiat FX rates found"
        showAccountQuickNav={false}
      />

      {showCreate && (
        <Modal title="Create fiat FX rate" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral" disabled={actionLoading}>Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success" disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Create'}</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit fiat FX rate ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral" disabled={actionLoading}>Cancel</button>
            <button type="button" onClick={handleUpdate} className="btn-primary" disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Fiat FX rate ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Provider', value: selected?.provider },
              { label: 'Source currency', value: selected?.sourceCurrency },
              { label: 'Target currency', value: selected?.targetCurrency },
              { label: 'Rate', value: selected?.rate },
              { label: 'Fetched at', value: formatDateTime(selected?.fetchedAt) },
              { label: 'Created at', value: formatDateTime(selected?.createdAt) },
              { label: 'Updated at', value: formatDateTime(selected?.updatedAt) },
              { label: 'Raw payload', value: selected?.rawPayload, pre: true }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete fiat FX rate <strong>{confirmDelete.id}</strong> ({confirmDelete.provider} {confirmDelete.sourceCurrency}/{confirmDelete.targetCurrency})? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral" disabled={actionLoading}>Cancel</button>
            <button type="button" onClick={handleDelete} className="btn-danger" disabled={actionLoading}>{actionLoading ? 'Deleting...' : 'Delete'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
