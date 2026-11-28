'use client';

import { regulatorVisibleFields } from '@/lib/regulator-presentation';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RegulatorRecord, PresentationLink as Link } from '@/components/RegulatorPresentation';
import { DataTable } from '@/components/DataTable';
import TableText from '@/components/TableCell';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { livePaymentMode, livePaymentSettingsAvailable } from '@/lib/business-live-payments';
import { SandboxHistoryLink } from '@/components/business-api-sandbox/Common';

import { useLocale } from '@/contexts/LocaleContext';
import { CatalogPagination, ReviewBadge } from '@/components/commerce/Catalog';
import { commercePage } from '@/lib/commerce-review';
import styles from '@/components/commerce/CommerceWorkspace.module.css';

const OPERATIONAL_STATUSES = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'CLOSED'];
const KYB_STATUSES = ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'REQUIRES_INFORMATION'];
const emptyFilters = { email: '', accountId: '', status: '', kybStatus: '' };

const normalizeGroups = (value) => {
  if (Array.isArray(value)) return value.map((group) => String(group).trim().toUpperCase()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((group) => group.trim().toUpperCase()).filter(Boolean);
  return [];
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const formatStatus = (value) => String(value || '—')
  .toLowerCase()
  .split('_')
  .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : '')
  .join(' ');

const StatusBadge = ({ value }) => <ReviewBadge tone={['ACTIVE', 'APPROVED'].includes(value) ? 'success' : ['CLOSED', 'REJECTED'].includes(value) ? 'danger' : ['PENDING', 'REQUIRES_INFORMATION', 'SUSPENDED'].includes(value) ? 'warning' : 'neutral'}>{formatStatus(value)}</ReviewBadge>;

const LivePaymentSummary = ({ business, canManage = false }) => {
  const available = livePaymentSettingsAvailable(business);
  const status = available ? business.apiLivePaymentsEnabled ? 'Enabled' : 'Disabled' : 'Status unavailable';
  const source = available ? livePaymentMode(business) === 'inherit' ? 'Global default' : 'Business override' : 'Refresh to check';
  const summary = <span style={{ color: !available ? 'var(--muted)' : business.apiLivePaymentsEnabled ? '#15803d' : '#b45309' }}>{status} · {source}</span>;
  return business?.id != null
    ? <Link href={`/dashboard/businesses/${encodeURIComponent(business.id)}#business-live-payments-title`} title={`${canManage ? 'Manage' : 'View'} LIVE API payments: ${status} · ${source}`}>{summary}</Link>
    : summary;
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} className="btn-neutral" aria-label="Close">×</button>
      </div>
      {children}
    </div>
  </div>
);

const DetailGrid = ({ rows }) => { const { enableRegulatorMode } = useAuth(); return (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '0.65rem' }}>
    {regulatorVisibleFields(rows, enableRegulatorMode).map((row) => (
      <div key={row.label} style={{ display: 'grid', gap: '0.15rem', padding: '0.7rem', border: '1px solid var(--border)', borderRadius: '10px', minWidth: 0 }}>
        <span style={{ color: 'var(--muted)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</span>
        <span style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{row.value ?? '—'}</span>
      </div>
    ))}
  </div>); };

export default function BusinessesPage() {
  const { session } = useAuth();
  const { locale } = useLocale();
  const [view, setView] = useState('cards');
  const request = useRef(0);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(null);

  const adminGroups = useMemo(() => {
    const access = session?.tokens?.accessToken?.payload || {};
    const id = session?.tokens?.idToken?.payload || {};
    return Array.from(new Set([
      ...normalizeGroups(access?.['cognito:groups'] || access?.groups),
      ...normalizeGroups(id?.['cognito:groups'] || id?.groups)
    ]));
  }, [session]);
  const canUpdate = adminGroups.includes('ADMIN') || adminGroups.includes('SUPER_ADMIN');

  const invalidate = useCallback(() => { request.current++; }, []);
  const fetchRows = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError(null);
    setRows([]);
    try {
      const query = new URLSearchParams({ page: String(page), size: String(size) });
      Object.entries(appliedFilters).forEach(([key, value]) => {
        const normalized = String(value ?? '').trim();
        if (normalized) query.set(key, normalized);
      });
      const response = await api.businesses.list(query);
      if (id !== request.current) return;
      const parsed = commercePage(response);
      setRows(parsed.rows); setPageMeta(parsed);
    } catch (err) {
      if (id !== request.current) return;
      setRows([]);
      setPageMeta({ totalElements: null, totalPages: null });
      setError(err?.message || 'Failed to load businesses.');
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [appliedFilters, page, size]);

  useEffect(() => {
    fetchRows();
    return invalidate;
  }, [fetchRows, invalidate]);

  const openDetails = useCallback(async (row) => {
    if (!row?.id) return;
    setDetailLoadingId(row.id);
    setError(null);
    try {
      const response = await api.businesses.get(row.id);
      setDetails(response);
      setRows((previous) => previous.map((business) => String(business.id) === String(response.id) ? response : business));
    } catch (err) {
      setError(err?.message || `Failed to load business ${row.id}.`);
    } finally {
      setDetailLoadingId(null);
    }
  }, []);

  const columns = useMemo(() => [
    {
      key: 'business',
      label: 'Business',
      priority: 0,
      render: (row) => <Link href={`/dashboard/businesses/${encodeURIComponent(row.id)}`} title={row.name || undefined} style={{ fontWeight: 700 }}><TableText value={row.name || `Business ${row.id}`} label="Business" expandable={false} /></Link>
    },
    {
      key: 'account',
      label: 'Owner account',
      render: (row) => <Link href={`/dashboard/accounts/accounts/${encodeURIComponent(row.ownerAccountId)}`} title={row.ownerAccountEmail || undefined}>
        {row.ownerAccountReference || `Account ${row.ownerAccountId}`}
      </Link>
    },
    { key: 'status', label: 'Operational status', render: (row) => <StatusBadge value={row.status} /> },
    { key: 'kybStatus', label: 'KYB status', render: (row) => <StatusBadge value={row.kybStatus} /> },
    {
      key: 'apiLivePaymentsEnabled', label: 'LIVE API payments', priority: 0, width: '19rem', render: (row) => <LivePaymentSummary business={row} canManage={canUpdate} />
    },
    { key: 'countryCode', label: 'Country', render: (row) => row.countryCode || '—' },
    { key: 'defaultBusiness', label: 'Default', render: (row) => row.defaultBusiness ? 'Yes' : 'No' },
    { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          <button type="button" className="btn-neutral btn-sm" onClick={() => openDetails(row)} disabled={detailLoadingId !== null}>
            {Number(detailLoadingId) === Number(row.id) ? 'Loading…' : 'Quick view'}
          </button>
          <Link href={`/dashboard/businesses/${encodeURIComponent(row.id)}`} className="btn-neutral btn-sm" style={{ textDecoration: 'none' }}>Details & credentials</Link>
        </div>
      )
    }
  ], [canUpdate, detailLoadingId, openDetails]);

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(0);
    setAppliedFilters({
      email: filters.email.trim(),
      accountId: filters.accountId.trim(),
      status: filters.status,
      kybStatus: filters.kybStatus
    });
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(0);
  };

  return (
    <div className={styles.workspace}>
      <div className="card" style={{ display: 'grid', gap: '0.6rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Businesses</h1>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)' }}>
            A workspace for each business: storefronts, verification records and API access.
          </p>
        </div>
        <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'var(--accent-soft)', color: 'var(--text)', fontSize: '13px' }}>
          <strong>Compatibility phase:</strong> operational and KYB statuses are metadata only. They do not suspend owner accounts, disable stores, block payments, approve personal KYC, or trigger customer notifications.
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <SandboxHistoryLink />
          <Link href="/dashboard/businesses/plans" className="btn-neutral" style={{ textDecoration: 'none' }}>Business Tools plans</Link>
          <Link href="/dashboard/businesses/migration" className="btn-neutral" style={{ textDecoration: 'none' }}>Migration console</Link>
          <Link href="/dashboard/payment-requests" className="btn-neutral" style={{ textDecoration: 'none' }}>Payment Requests</Link>
          <Link href="/dashboard/commerce/stores" className="btn-neutral" style={{ textDecoration: 'none' }}>Commerce stores</Link>
          <button type="button" className="btn-neutral" disabled={loading} onClick={fetchRows}>{loading ? 'Refreshing…' : 'Refresh businesses'}</button>
        </div>
      </div>

      <details className={styles.details}><summary>Find a business & advanced filters</summary><form onSubmit={applyFilters} style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ fontWeight: 800 }}>Filters</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Owner email</span>
            <input value={filters.email} maxLength={254} placeholder="owner@example.com" onChange={(event) => setFilters((previous) => ({ ...previous, email: event.target.value }))} />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Owner account ID</span>
            <input type="number" min="1" value={filters.accountId} onChange={(event) => setFilters((previous) => ({ ...previous, accountId: event.target.value }))} />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Operational status</span>
            <select value={filters.status} onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}>
              <option value="">All statuses</option>
              {OPERATIONAL_STATUSES.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>KYB status</span>
            <select value={filters.kybStatus} onChange={(event) => setFilters((previous) => ({ ...previous, kybStatus: event.target.value }))}>
              <option value="">All statuses</option>
              {KYB_STATUSES.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span>Page size</span>
            <select value={size} onChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}>
              {[10, 20, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button type="button" className="btn-neutral" onClick={clearFilters}>Clear</button>
          <button type="submit" className="btn-primary">Apply filters</button>
        </div>
      </form></details>

      {error ? <div className="card" style={{ color: '#B91C1C', fontWeight: 700 }}>{error}</div> : null}

      <div className={styles.toolbar}>
        <div className={styles.actions} role="group" aria-label="Business review queues">{[['', 'All businesses'], ['PENDING', 'KYB pending'], ['REQUIRES_INFORMATION', 'Needs information'], ['APPROVED', 'KYB approved']].map(([value, label]) => <button type="button" key={value} className={styles.filterChip} aria-pressed={appliedFilters.kybStatus === value} onClick={() => { setFilters((current) => ({ ...current, kybStatus: value })); setAppliedFilters((current) => ({ ...current, kybStatus: value })); setPage(0); }}>{label}</button>)}</div>
        <div className={styles.segmented}><button type="button" aria-pressed={view === 'cards'} onClick={() => setView('cards')}>Workspaces</button><button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Table</button></div>
      </div>
      {view === 'cards' ? <>
        {loading ? <div className={styles.empty} role="status">Loading businesses…</div> : error ? null : rows.length === 0 ? <div className={styles.empty}><h3>No businesses in this view</h3><p>Choose another queue or adjust your filters.</p></div> : <div className={styles.businessGrid}>{rows.map((business) => <RegulatorRecord key={business.id} record={business}><article className={styles.businessCard}>
          <div className={styles.heading}><div className={styles.actions}><span className={styles.businessAvatar}>{String(business.name || 'B').slice(0, 2).toUpperCase()}</span><div><h2><Link href={`/dashboard/businesses/${encodeURIComponent(business.id)}`}>{business.name || `Business ${business.id}`}</Link></h2><small className={styles.muted}>{business.legalName || `Business #${business.id}`} · {business.countryCode || '—'}</small></div></div>{business.defaultBusiness ? <ReviewBadge>Default</ReviewBadge> : null}</div>
          <div className={styles.businessSteps}><div data-ready={business.status === 'ACTIVE'}><small>Operational</small><strong>{formatStatus(business.status)}</strong></div><div data-ready={business.kybStatus === 'APPROVED'}><small>KYB</small><strong>{formatStatus(business.kybStatus)}</strong></div><div data-ready={livePaymentSettingsAvailable(business) && business.apiLivePaymentsEnabled}><small>LIVE API</small><strong>{livePaymentSettingsAvailable(business) ? business.apiLivePaymentsEnabled ? 'Enabled' : 'Disabled' : 'Unavailable'}</strong></div></div>
          <div className={styles.productMeta}><Link href={`/dashboard/accounts/accounts/${encodeURIComponent(business.ownerAccountId)}`}>{business.ownerAccountEmail || business.ownerAccountReference || `Account ${business.ownerAccountId}`}</Link><span>{formatDateTime(business.createdAt)}</span></div>
          <div className={styles.cardFooter}><Link href={`/dashboard/businesses/${encodeURIComponent(business.id)}`} className="btn-primary btn-sm">Open workspace</Link><button type="button" className="btn-neutral btn-sm" disabled={detailLoadingId !== null} onClick={() => openDetails(business)}>Quick view</button></div>
        </article></RegulatorRecord>)}</div>}
        <CatalogPagination {...pageMeta} page={page} size={size} rowCount={rows.length} busy={loading} onPageChange={setPage} locale={locale} />
      </> : (<DataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={size}
        totalElements={pageMeta.totalElements}
        totalPages={pageMeta.totalPages}
        canPrev={page > 0}
        canNext={pageMeta.totalPages !== null ? page + 1 < pageMeta.totalPages : rows.length === size}
        onPageChange={setPage}
        showIndex={false}
        showAccountQuickNav={false}
        emptyLabel={loading ? 'Loading businesses…' : 'No businesses match these filters.'}
      />)}


      {details ? (
        <Modal title={`Business ${details.id}`} onClose={() => setDetails(null)}>
          <DetailGrid rows={[
            { label: 'Name', value: details.name },
            { label: 'Legal name', value: details.legalName },
            { label: 'Owner reference', value: details.ownerAccountReference },
            { label: 'Owner email', value: details.ownerAccountEmail },
            { label: 'Country', value: details.countryCode },
            { label: 'Registration number', value: details.registrationNumber },
            { label: 'Operational status', value: <StatusBadge value={details.status} /> },
            { label: 'KYB status', value: <StatusBadge value={details.kybStatus} /> },
            { label: 'LIVE API payments', value: <LivePaymentSummary business={details} canManage={canUpdate} /> },
            { label: 'Default business', value: details.defaultBusiness ? 'Yes' : 'No' },
            { label: 'Created', value: formatDateTime(details.createdAt) },
            { label: 'Updated', value: formatDateTime(details.updatedAt) }
          ]} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link href={`/dashboard/businesses/${encodeURIComponent(details.id)}`} className="btn-neutral" style={{ textDecoration: 'none' }}>Details & credentials</Link>
            </div>
          </div>
        </Modal>
      ) : null}

    </div>
  );
}
