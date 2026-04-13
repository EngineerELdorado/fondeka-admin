'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const providerOptions = ['RELOADLY_UTILITIES', 'ZENDIT'];
const serviceTypeOptions = ['PREPAID', 'POSTPAID'];
const utilityTypeOptions = ['ELECTRICITY', 'WATER', 'TV', 'INTERNET'];
const denominationTypeOptions = ['FIXED', 'RANGE'];
const priceTypeOptions = ['FIXED', 'RANGE', 'OPEN_RANGE'];
const requiresInvoiceOptions = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Required' },
  { value: 'false', label: 'Not required' }
];
const sortOptions = [
  { value: '', label: 'Default' },
  { value: 'fixedAmount,asc', label: 'Fixed amount lowest' },
  { value: 'fixedAmount,desc', label: 'Fixed amount highest' }
];

const emptyFilters = {
  providerName: '',
  countryCode: '',
  serviceType: '',
  utilityType: '',
  denominationType: '',
  priceType: '',
  productType: '',
  subType: '',
  requiresInvoice: '',
  currency: '',
  brand: '',
  brandName: '',
  displayName: '',
  q: '',
  minRequiredFieldCount: '',
  requiredField: '',
  minFixedAmountCount: '',
  minAmount: '',
  maxAmount: '',
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
        <div style={{ fontWeight: 700, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{row.value ?? '—'}</div>
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

const formatAmountShape = (row) => {
  const fixedAmount = row?.fixedAmount;
  const minAmount = row?.minAmount;
  const maxAmount = row?.maxAmount;
  const currency = row?.currency;
  if (fixedAmount !== null && fixedAmount !== undefined && fixedAmount !== '') {
    return `${fixedAmount}${currency ? ` ${currency}` : ''}`;
  }
  if (minAmount !== null && minAmount !== undefined && maxAmount !== null && maxAmount !== undefined && (minAmount !== '' || maxAmount !== '')) {
    return `${minAmount ?? '—'} - ${maxAmount ?? '—'}${currency ? ` ${currency}` : ''}`;
  }
  return '—';
};

export default function UtilityBillCatalogPage() {
  const [rows, setRows] = useState([]);
  const [countries, setCountries] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [pageMeta, setPageMeta] = useState({ totalItems: null, totalPages: null });
  const [filters, setFilters] = useState(emptyFilters);
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
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) params.set(key, String(value));
      });
      const res = await api.utilityBillCatalog.list(params);
      const list = Array.isArray(res) ? res : res?.items || res?.content || [];
      setRows(list || []);
      setPageMeta({
        totalItems: Number.isFinite(res?.totalItems) ? Number(res.totalItems) : Array.isArray(list) ? list.length : null,
        totalPages: Number.isFinite(res?.totalPages) ? Number(res.totalPages) : null
      });
    } catch (err) {
      setRows([]);
      setPageMeta({ totalItems: null, totalPages: null });
      setError(err?.message || 'Failed to load utility bill catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, filters]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const openDetail = async (row) => {
    const id = row?.id;
    if (!id) return;
    setDetailLoading(true);
    setError(null);
    setInfo(null);
    try {
      const data = await api.utilityBillCatalog.get(id);
      setSelected(data || row);
      setShowDetail(true);
    } catch (err) {
      setError(err?.message || `Failed to load utility bill catalog item ${id}.`);
    } finally {
      setDetailLoading(false);
    }
  };

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size && rows.length > 0 : page + 1 < pageMeta.totalPages;

  const columns = useMemo(
    () => [
      { key: 'providerName', label: 'Provider' },
      { key: 'countryCode', label: 'Country', render: (row) => row.countryCode || row.countryName || '—' },
      { key: 'displayName', label: 'Display Name', render: (row) => row.displayName || '—' },
      { key: 'brand', label: 'Brand / Biller', render: (row) => row.brandName || row.brand || '—' },
      { key: 'serviceType', label: 'Service Type', render: (row) => row.serviceType || '—' },
      { key: 'utilityType', label: 'Utility Type', render: (row) => row.utilityType || row.subType || '—' },
      { key: 'denominationType', label: 'Denomination Type', render: (row) => row.denominationType || '—' },
      { key: 'currency', label: 'Currency', render: (row) => row.currency || '—' },
      { key: 'amountShape', label: 'Fixed Amount / Range', render: (row) => formatAmountShape(row) },
      { key: 'requiresInvoice', label: 'Requires Invoice', render: (row) => (row.requiresInvoice ? 'Yes' : 'No') },
      { key: 'requiredFields', label: 'Required Fields', render: (row) => Array.isArray(row.requiredFields) && row.requiredFields.length ? row.requiredFields.join(', ') : '—' },
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
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Utility Bill Catalog</div>
          <div style={{ color: 'var(--muted)' }}>
            Inspect cached provider catalog items for Reloadly Utilities and Zendit voucher offers without calling providers live.
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Use this page to confirm what the provider catalog contains. Use sync pages for freshness and bill product mappings to expose items to customers.
          </div>
        </div>
        <Link href="/dashboard/bills" className="btn-neutral">
          {'<- Bills hub'}
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontWeight: 700 }}>Operational explorer</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          This explorer shows cached provider items, not `bill_products` rows. Use it when ops needs to answer whether a provider actually has a biller or voucher in a given market.
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
            <label htmlFor="q">Search text</label>
            <input id="q" value={filters.q} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, q: e.target.value })); }} placeholder="Search biller, brand, offer text" />
          </div>
          <div style={{ display: 'flex', alignItems: 'end', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral" onClick={fetchRows} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="serviceType">Service Type</label>
            <select id="serviceType" value={filters.serviceType} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, serviceType: e.target.value })); }}>
              <option value="">All</option>
              {serviceTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="utilityType">Utility Type</label>
            <select id="utilityType" value={filters.utilityType} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, utilityType: e.target.value })); }}>
              <option value="">All</option>
              {utilityTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="denominationType">Denomination Type</label>
            <select id="denominationType" value={filters.denominationType} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, denominationType: e.target.value })); }}>
              <option value="">All</option>
              {denominationTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="priceType">Price Type</label>
            <select id="priceType" value={filters.priceType} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, priceType: e.target.value })); }}>
              <option value="">All</option>
              {priceTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="productType">Product Type</label>
            <input id="productType" value={filters.productType} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, productType: e.target.value })); }} placeholder="Voucher type" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="subType">Subtype</label>
            <input id="subType" value={filters.subType} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, subType: e.target.value })); }} placeholder="Electricity" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="currency">Currency</label>
            <input id="currency" value={filters.currency} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, currency: e.target.value.toUpperCase() })); }} placeholder="XAF" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="requiresInvoice">Requires Invoice</label>
            <select id="requiresInvoice" value={filters.requiresInvoice} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, requiresInvoice: e.target.value })); }}>
              {requiresInvoiceOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="minRequiredFieldCount">Min Required Fields</label>
            <input id="minRequiredFieldCount" type="number" min={0} step={1} value={filters.minRequiredFieldCount} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, minRequiredFieldCount: e.target.value })); }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="requiredField">Required Field</label>
            <input id="requiredField" value={filters.requiredField} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, requiredField: e.target.value })); }} placeholder="accountNumber" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="brand">Brand</label>
            <input id="brand" value={filters.brand} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, brand: e.target.value })); }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="brandName">Brand Name</label>
            <input id="brandName" value={filters.brandName} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, brandName: e.target.value })); }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="displayName">Display Name</label>
            <input id="displayName" value={filters.displayName} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, displayName: e.target.value })); }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="minAmount">Min Amount</label>
            <input id="minAmount" type="number" min={0} step="0.01" value={filters.minAmount} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, minAmount: e.target.value })); }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="maxAmount">Max Amount</label>
            <input id="maxAmount" type="number" min={0} step="0.01" value={filters.maxAmount} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, maxAmount: e.target.value })); }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="minFixedAmountCount">Min Fixed Amount Count</label>
            <input id="minFixedAmountCount" type="number" min={0} step={1} value={filters.minFixedAmountCount} onChange={(e) => { setPage(0); setFilters((p) => ({ ...p, minFixedAmountCount: e.target.value })); }} />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="page">Page</label>
              <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Math.max(0, Number(e.target.value) || 0))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="size">Size</label>
              <input id="size" type="number" min={1} max={200} value={size} onChange={(e) => { const next = Math.max(1, Number(e.target.value) || 1); setSize(next); setPage(0); }} />
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
        rows={rows}
        emptyLabel={loading ? 'Loading utility bill catalog…' : 'No cached utility catalog items found'}
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
        <Modal title={`Utility catalog item ${selected.id || ''}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: formatValue(selected.id) },
              { label: 'Provider', value: formatValue(selected.providerName) },
              { label: 'Provider Catalog ID', value: formatValue(selected.providerCatalogId) },
              { label: 'Item Type', value: formatValue(selected.itemType) },
              { label: 'Country Code', value: formatValue(selected.countryCode) },
              { label: 'Country Name', value: formatValue(selected.countryName) },
              { label: 'Display Name', value: formatValue(selected.displayName) },
              { label: 'Description', value: formatValue(selected.description) },
              { label: 'Brand', value: formatValue(selected.brand) },
              { label: 'Brand Name', value: formatValue(selected.brandName) },
              { label: 'Service Type', value: formatValue(selected.serviceType) },
              { label: 'Utility Type', value: formatValue(selected.utilityType) },
              { label: 'Denomination Type', value: formatValue(selected.denominationType) },
              { label: 'Price Type', value: formatValue(selected.priceType) },
              { label: 'Product Type', value: formatValue(selected.productType) },
              { label: 'Currency', value: formatValue(selected.currency) },
              { label: 'Min Amount', value: formatValue(selected.minAmount) },
              { label: 'Max Amount', value: formatValue(selected.maxAmount) },
              { label: 'Fixed Amount', value: formatValue(selected.fixedAmount) },
              { label: 'Fixed Amount Count', value: formatValue(selected.fixedAmountCount) },
              { label: 'Requires Invoice', value: selected.requiresInvoice ? 'Yes' : 'No' },
              { label: 'Required Field Count', value: formatValue(selected.requiredFieldCount) },
              { label: 'Required Fields', value: formatValue(selected.requiredFields) },
              { label: 'Sub Types', value: formatValue(selected.subTypes) },
              { label: 'Last Synced', value: formatDateTime(selected.lastSyncedAt) }
            ]}
          />
        </Modal>
      )}
    </div>
  );
}
