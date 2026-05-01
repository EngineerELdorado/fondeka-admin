'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const initialFilters = {
  claimed: 'false',
  platform: '',
  preferredLanguage: '',
  country: '',
  deviceId: '',
  hasPushToken: ''
};

const statusBadge = (label, { bg, fg }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.2rem 0.5rem',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 700,
      background: bg,
      color: fg
    }}
  >
    {label}
  </span>
);

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const pickCountry = (row) => row?.lastSeenCountry || row?.lastSeenCountryClient || '—';

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button
          type="button"
          onClick={onClose}
          style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}
        >
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div
        key={row.label}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.15rem',
          padding: '0.6rem',
          border: '1px solid var(--border)',
          borderRadius: '10px'
        }}
      >
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

export default function NotificationAnonymousInstallsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [meta, setMeta] = useState({ totalElements: null, totalPages: null, hasNext: false });
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(size)
      });
      Object.entries(appliedFilters).forEach(([key, value]) => {
        const trimmed = String(value ?? '').trim();
        if (!trimmed) return;
        params.set(key, trimmed);
      });
      const res = await api.notifications.listAnonymousInstalls(params);
      const installs = Array.isArray(res?.installs) ? res.installs : [];
      setRows(installs);
      setMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null,
        hasNext: Boolean(res?.hasNext)
      });
    } catch (err) {
      setRows([]);
      setMeta({ totalElements: null, totalPages: null, hasNext: false });
      setError(err?.message || 'Failed to load anonymous installs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(
    () => [
      { key: 'platform', label: 'Platform', render: (row) => String(row?.platform || '—').toUpperCase() },
      { key: 'deviceName', label: 'Device name', render: (row) => row?.deviceName || '—' },
      { key: 'preferredLanguage', label: 'Language', render: (row) => row?.preferredLanguage || '—' },
      { key: 'country', label: 'Country', render: (row) => pickCountry(row) },
      {
        key: 'hasPushToken',
        label: 'Push status',
        render: (row) =>
          row?.hasPushToken
            ? statusBadge('Push Ready', { bg: '#ECFDF3', fg: '#15803D' })
            : statusBadge('No Token', { bg: '#F3F4F6', fg: '#374151' })
      },
      { key: 'pushTokenType', label: 'Push token type', render: (row) => row?.pushTokenType || '—' },
      {
        key: 'claimed',
        label: 'Claimed',
        render: (row) =>
          row?.claimed
            ? statusBadge('Claimed', { bg: '#EFF6FF', fg: '#1D4ED8' })
            : statusBadge('Unclaimed', { bg: '#FEF2F2', fg: '#B91C1C' })
      },
      { key: 'claimedAccountId', label: 'Claimed account', render: (row) => row?.claimedAccountId ?? '—' },
      { key: 'lastSeenAt', label: 'Last seen', render: (row) => formatDateTime(row?.lastSeenAt) },
      { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row?.createdAt) },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <button
            type="button"
            className="btn-neutral"
            onClick={() => {
              setSelected(row);
              setShowDetail(true);
            }}
          >
            View
          </button>
        )
      }
    ],
    []
  );

  const activeFilterCount = useMemo(
    () => Object.values(appliedFilters).filter((value) => String(value ?? '').trim() !== '').length,
    [appliedFilters]
  );

  const anonymousCampaignHref = useMemo(() => {
    const params = new URLSearchParams();
    if (String(appliedFilters.platform || '').trim()) params.set('platform', String(appliedFilters.platform).trim());
    if (String(appliedFilters.preferredLanguage || '').trim()) params.set('preferredLanguage', String(appliedFilters.preferredLanguage).trim());
    if (String(appliedFilters.country || '').trim()) params.set('country', String(appliedFilters.country).trim());
    const query = params.toString();
    return query ? `/dashboard/notification-anonymous-push-campaigns?${query}` : '/dashboard/notification-anonymous-push-campaigns';
  }, [appliedFilters]);

  const applyFilters = () => {
    setPage(0);
    setAppliedFilters(filters);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: '0.2rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Anonymous Installs</div>
          <div style={{ color: 'var(--muted)' }}>
            Browse pre-signup installs seen by backend, with claim state and push reachability.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link
            href={anonymousCampaignHref}
            style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}
          >
            Anonymous push campaign
          </Link>
          <Link
            href="/dashboard/notification-push-campaigns"
            style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}
          >
            Open push campaigns
          </Link>
          <button type="button" className="btn-primary" onClick={fetchRows} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '0.2rem' }}>
            <div style={{ fontWeight: 800 }}>Filters</div>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Default view is unclaimed installs so the active pre-signup audience is visible first.
            </div>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>{activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="claimed">Claimed status</label>
            <select id="claimed" value={filters.claimed} onChange={(e) => setFilters((prev) => ({ ...prev, claimed: e.target.value }))}>
              <option value="">All</option>
              <option value="false">Unclaimed</option>
              <option value="true">Claimed</option>
            </select>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="platform">Platform</label>
            <select id="platform" value={filters.platform} onChange={(e) => setFilters((prev) => ({ ...prev, platform: e.target.value }))}>
              <option value="">All</option>
              <option value="ios">iOS</option>
              <option value="android">Android</option>
            </select>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="preferredLanguage">Language</label>
            <input
              id="preferredLanguage"
              value={filters.preferredLanguage}
              onChange={(e) => setFilters((prev) => ({ ...prev, preferredLanguage: e.target.value }))}
              placeholder="en"
            />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="country">Country</label>
            <input id="country" value={filters.country} onChange={(e) => setFilters((prev) => ({ ...prev, country: e.target.value }))} placeholder="CD" />
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="hasPushToken">Has push token</label>
            <select id="hasPushToken" value={filters.hasPushToken} onChange={(e) => setFilters((prev) => ({ ...prev, hasPushToken: e.target.value }))}>
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <label htmlFor="deviceId">Device search</label>
            <input
              id="deviceId"
              value={filters.deviceId}
              onChange={(e) => setFilters((prev) => ({ ...prev, deviceId: e.target.value }))}
              placeholder="ios-4d2f8f0c"
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={applyFilters} disabled={loading}>
            Apply filters
          </button>
          <button type="button" className="btn-neutral" onClick={resetFilters} disabled={loading}>
            Reset
          </button>
        </div>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      <DataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={size}
        totalPages={meta.totalPages}
        totalElements={meta.totalElements}
        canPrev={page > 0}
        canNext={meta.hasNext}
        onPageChange={setPage}
        emptyLabel={loading ? 'Loading installs…' : 'No anonymous installs found'}
        showAccountQuickNav={false}
      />

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="size">Page size</label>
          <input
            id="size"
            type="number"
            min={1}
            value={size}
            onChange={(e) => {
              const next = Math.max(1, Number(e.target.value) || 20);
              setSize(next);
              setPage(0);
            }}
          />
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Claimed = already linked to an authenticated account flow. Unclaimed = still part of the anonymous acquisition audience.
        </div>
      </div>

      {showDetail && selected && (
        <Modal title={`Anonymous install ${selected.deviceId || selected.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'Install ID', value: selected.id },
              { label: 'Device ID', value: selected.deviceId },
              { label: 'Platform', value: selected.platform },
              { label: 'Device name', value: selected.deviceName || '—' },
              { label: 'Language', value: selected.preferredLanguage || '—' },
              { label: 'Push token type', value: selected.pushTokenType || '—' },
              { label: 'Push token', value: selected.pushToken || '—' },
              { label: 'Has push token', value: selected.hasPushToken ? 'Yes' : 'No' },
              { label: 'Last seen IP', value: selected.lastSeenIp || '—' },
              { label: 'Last seen user agent', value: selected.lastSeenUserAgent || '—' },
              { label: 'Server country', value: selected.lastSeenCountry || '—' },
              { label: 'Client country', value: selected.lastSeenCountryClient || '—' },
              { label: 'Last seen at', value: formatDateTime(selected.lastSeenAt) },
              { label: 'Claimed', value: selected.claimed ? 'Yes' : 'No' },
              { label: 'Claimed at', value: formatDateTime(selected.claimedAt) },
              { label: 'Claimed account ID', value: selected.claimedAccountId ?? '—' },
              { label: 'Created at', value: formatDateTime(selected.createdAt) },
              { label: 'Updated at', value: formatDateTime(selected.updatedAt) }
            ]}
          />
        </Modal>
      )}
    </div>
  );
}
