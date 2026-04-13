'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const providerOptions = ['RELOADLY', 'ZENDIT'];
const rechargeTypeOptions = ['AIRTIME', 'DATA', 'BUNDLE'];
const statusOptions = ['ACTIVE', 'INACTIVE', 'AVAILABLE', 'UNAVAILABLE'];
const priceTypeOptions = ['FIXED', 'RANGE', 'OPEN_RANGE'];
const denominationTypeOptions = ['FIXED', 'RANGE'];
const sortOptions = [
  { value: '', label: 'Default' },
  { value: 'lastSyncedAt,desc', label: 'Last synced newest' },
  { value: 'lastSyncedAt,asc', label: 'Last synced oldest' },
  { value: 'senderAmount,asc', label: 'Sender amount lowest' },
  { value: 'senderAmount,desc', label: 'Sender amount highest' }
];

const emptyFilters = {
  providerName: '',
  type: '',
  countryCode: '',
  operatorName: '',
  minVoiceMinutes: '',
  minSmsCount: '',
  status: '',
  priceType: '',
  denominationType: '',
  searchText: '',
  sort: ''
};

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
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const matchesSearchText = (row, searchText) => {
  const term = String(searchText || '').trim().toLowerCase();
  if (!term) return true;
  return [row?.displayBenefits, row?.notesShort, row?.notes, row?.description]
    .filter((value) => value !== null && value !== undefined)
    .some((value) => String(value).toLowerCase().includes(term));
};

export default function RechargeCatalogPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [pageMeta, setPageMeta] = useState({ totalItems: null, totalPages: null });
  const [filters, setFilters] = useState(emptyFilters);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      ['providerName', 'type', 'countryCode', 'operatorName', 'minVoiceMinutes', 'minSmsCount', 'sort'].forEach((key) => {
        const value = filters[key];
        if (value !== '' && value !== null && value !== undefined) params.set(key, String(value));
      });
      const res = await api.rechargeCatalog.list(params);
      const list = Array.isArray(res) ? res : res?.items || res?.content || [];
      setRows(list || []);
      setPageMeta({
        totalItems: Number.isFinite(res?.totalItems) ? Number(res.totalItems) : Array.isArray(list) ? list.length : null,
        totalPages: Number.isFinite(res?.totalPages) ? Number(res.totalPages) : null
      });
    } catch (err) {
      setRows([]);
      setPageMeta({ totalItems: null, totalPages: null });
      setError(err?.message || 'Failed to load recharge catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, filters.providerName, filters.type, filters.countryCode, filters.operatorName, filters.minVoiceMinutes, filters.minSmsCount, filters.sort]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadCountries = async () => {
      try {
        const res = await api.countries.list(new URLSearchParams({ page: '0', size: '250' }));
        const list = Array.isArray(res) ? res : res?.content || [];
        setCountries(list || []);
      } catch {
        setCountries([]);
      }
    };
    loadCountries();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const statusMatch = !filters.status || String(row?.status || '').toUpperCase() === filters.status;
      const priceTypeMatch = !filters.priceType || String(row?.priceType || '').toUpperCase() === filters.priceType;
      const denominationTypeMatch = !filters.denominationType || String(row?.denominationType || '').toUpperCase() === filters.denominationType;
      return statusMatch && priceTypeMatch && denominationTypeMatch && matchesSearchText(row, filters.searchText);
    });
  }, [filters.denominationType, filters.priceType, filters.searchText, filters.status, rows]);

  const openDetail = async (row) => {
    const offerId = row?.offerId;
    if (!offerId) return;
    setDetailLoading(true);
    setError(null);
    setInfo(null);
    try {
      const data = await api.rechargeCatalog.get(offerId);
      setSelected(data || row);
      setShowDetail(true);
    } catch (err) {
      setError(err?.message || `Failed to load recharge catalog offer ${offerId}.`);
    } finally {
      setDetailLoading(false);
    }
  };

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size && rows.length > 0 : page + 1 < pageMeta.totalPages;

  const columns = useMemo(
    () => [
      { key: 'providerName', label: 'Provider' },
      { key: 'type', label: 'Type' },
      { key: 'countryCode', label: 'Country' },
      { key: 'operatorName', label: 'Operator' },
      { key: 'displayValue', label: 'Display Value', render: (row) => row.displayValue || '—' },
      { key: 'displayBenefits', label: 'Display Benefits', render: (row) => row.displayBenefits || '—' },
      { key: 'priceType', label: 'Price Type', render: (row) => row.priceType || '—' },
      { key: 'denominationType', label: 'Denomination Type', render: (row) => row.denominationType || '—' },
      { key: 'status', label: 'Status', render: (row) => row.status || '—' },
      { key: 'lastSyncedAt', label: 'Last Synced', render: (row) => formatDateTime(row.lastSyncedAt) },
      {
        key: 'actions',
        label: 'Action',
        render: (row) => (
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral btn-sm" disabled={detailLoading}>
            View details
          </button>
        )
      }
    ],
    [detailLoading]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Recharge Catalog</div>
          <div style={{ color: 'var(--muted)' }}>
            Inspect the actual cached recharge offers in Redis. Use this to verify market availability and compare provider catalogs.
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            This page shows cached offers. Use Recharge Catalog Sync for freshness and manual refresh, and Recharge Provider Routing for fulfillment selection.
          </div>
        </div>
        <Link href="/dashboard" className="btn-neutral">
          {'<- Dashboard'}
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontWeight: 700 }}>Operational explorer</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Backend filters currently supported here: Provider, Type, Country, Operator, Minimum voice minutes, Minimum SMS count, Page, Size, and Sort.
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Status, Price Type, Denomination Type, and text search are still applied client-side on the current page.
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="providerName">Provider</label>
            <select id="providerName" value={filters.providerName} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, providerName: e.target.value })); }}>
              <option value="">All</option>
              {providerOptions.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="type">Recharge Type</label>
            <select id="type" value={filters.type} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, type: e.target.value })); }}>
              <option value="">All</option>
              {rechargeTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="countryCode">Country</label>
            <select id="countryCode" value={filters.countryCode} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, countryCode: e.target.value })); }}>
              <option value="">All</option>
              {countries.map((country) => {
                const code = country.alpha2Code || country.countryCode || '';
                if (!code) return null;
                return (
                  <option key={country.id || code} value={code}>
                    {country.name || code} ({code})
                  </option>
                );
              })}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="operatorName">Operator name</label>
            <input
              id="operatorName"
              value={filters.operatorName}
              onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, operatorName: e.target.value })); }}
              placeholder="Vodacom"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="sort">Sort</label>
            <select id="sort" value={filters.sort} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, sort: e.target.value })); }}>
              {sortOptions.map((option) => (
                <option key={option.value || 'default'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="minVoiceMinutes">Minimum voice minutes</label>
            <input
              id="minVoiceMinutes"
              type="number"
              min={0}
              step={1}
              value={filters.minVoiceMinutes}
              onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, minVoiceMinutes: e.target.value })); }}
              placeholder="100"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="minSmsCount">Minimum SMS count</label>
            <input
              id="minSmsCount"
              type="number"
              min={0}
              step={1}
              value={filters.minSmsCount}
              onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, minSmsCount: e.target.value })); }}
              placeholder="100"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="status">Status</label>
            <select id="status" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
              <option value="">All</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="priceType">Price type</label>
            <select id="priceType" value={filters.priceType} onChange={(e) => setFilters((p) => ({ ...p, priceType: e.target.value }))}>
              <option value="">All</option>
              {priceTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="denominationType">Denomination type</label>
            <select
              id="denominationType"
              value={filters.denominationType}
              onChange={(e) => setFilters((p) => ({ ...p, denominationType: e.target.value }))}
            >
              <option value="">All</option>
              {denominationTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="searchText">Search text</label>
            <input
              id="searchText"
              value={filters.searchText}
              onChange={(e) => setFilters((p) => ({ ...p, searchText: e.target.value }))}
              placeholder="Benefits, notes, description"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="page">Page</label>
              <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Math.max(0, Number(e.target.value) || 0))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="size">Size</label>
              <input
                id="size"
                type="number"
                min={1}
                max={200}
                value={size}
                onChange={(e) => {
                  const nextSize = Math.max(1, Number(e.target.value) || 1);
                  setSize(nextSize);
                  setPage(0);
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={fetchRows} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            className="btn-neutral"
            onClick={() => {
              setPage(0);
              setSize(20);
              setFilters(emptyFilters);
            }}
          >
            Clear filters
          </button>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable
        columns={columns}
        rows={filteredRows}
        emptyLabel={loading ? 'Loading recharge catalog…' : 'No cached recharge offers found'}
        page={page}
        pageSize={size}
        totalPages={pageMeta.totalPages}
        totalElements={pageMeta.totalItems}
        onPageChange={setPage}
        canPrev={canPrev}
        canNext={canNext}
        showAccountQuickNav={false}
      />

      {showDetail && selected && (
        <Modal title={`Recharge offer ${selected.offerId || ''}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'Provider', value: formatValue(selected.providerName) },
              { label: 'Type', value: formatValue(selected.type) },
              { label: 'Country', value: formatValue(selected.countryCode) },
              { label: 'Offer ID', value: formatValue(selected.offerId) },
              { label: 'Operator ID', value: formatValue(selected.operatorId) },
              { label: 'Operator Name', value: formatValue(selected.operatorName) },
              { label: 'Price Type', value: formatValue(selected.priceType) },
              { label: 'Status', value: formatValue(selected.status) },
              { label: 'Denomination Type', value: formatValue(selected.denominationType) },
              { label: 'Sender Amount', value: formatValue(selected.senderAmount) },
              { label: 'Sender Currency', value: formatValue(selected.senderCurrencyCode) },
              { label: 'Destination Amount', value: formatValue(selected.destinationAmount) },
              { label: 'Destination Currency', value: formatValue(selected.destinationCurrencyCode) },
              { label: 'Display Value', value: formatValue(selected.displayValue) },
              { label: 'Display Benefits', value: formatValue(selected.displayBenefits) },
              { label: 'Notes Short', value: formatValue(selected.notesShort) },
              { label: 'Notes', value: formatValue(selected.notes) },
              { label: 'Benefits', value: formatValue(selected.benefits) },
              { label: 'Description', value: formatValue(selected.description) },
              { label: 'Suggested', value: formatValue(selected.suggested) },
              { label: 'Last Synced', value: formatDateTime(selected.lastSyncedAt) }
            ]}
          />
        </Modal>
      )}
    </div>
  );
}
