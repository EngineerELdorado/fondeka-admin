'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const providerOptions = ['RELOADLY_UTILITIES', 'ZENDIT'];

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const normalizeList = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.content)) return res.content;
  if (Array.isArray(res?.items)) return res.items;
  return [];
};

const StatusBadge = ({ enabled }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.2rem 0.5rem',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 700,
      background: enabled ? '#ECFDF3' : '#F3F4F6',
      color: enabled ? '#15803D' : '#374151'
    }}
  >
    {enabled ? 'Enabled' : 'Disabled'}
  </span>
);

const SummaryCard = ({ label, value, tone = 'default' }) => {
  const tones = {
    default: { border: 'var(--border)', bg: 'var(--surface)' },
    reloadly: { border: '#bfdbfe', bg: '#eff6ff' },
    zendit: { border: '#bbf7d0', bg: '#f0fdf4' },
    cron: { border: '#fde68a', bg: '#fffbeb' }
  };
  const current = tones[tone] || tones.default;
  return (
    <div className="card" style={{ borderColor: current.border, background: current.bg, display: 'grid', gap: '0.2rem' }}>
      <div style={{ color: 'var(--muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 800 }}>{value}</div>
    </div>
  );
};

export default function UtilityBillCatalogSyncPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [providerFilter, setProviderFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [cronEnabledFilter, setCronEnabledFilter] = useState('');
  const [pendingProviders, setPendingProviders] = useState({});

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.utilityBillCatalogSync.list();
      setRows(normalizeList(res));
    } catch (err) {
      setRows([]);
      setError(err?.message || 'Failed to load utility bill catalog sync status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const handleTrigger = useCallback(async (providerName) => {
    if (!providerName) return;
    setPendingProviders((prev) => ({ ...prev, [providerName]: true }));
    setError(null);
    setInfo(null);
    try {
      const res = await api.utilityBillCatalogSync.trigger(providerName);
      const status = String(res?.status || '').trim().toUpperCase();
      if (status && status !== 'ENQUEUED') {
        setInfo(`${providerName} sync request returned ${status}.`);
      } else {
        setInfo(`${providerName} utility catalog sync enqueued.`);
      }
      await fetchRows();
    } catch (err) {
      setError(err?.message || `Failed to enqueue ${providerName} utility catalog sync.`);
    } finally {
      setPendingProviders((prev) => ({ ...prev, [providerName]: false }));
    }
  }, []);

  const filteredRows = useMemo(() => {
    const countryTerm = countryFilter.trim().toUpperCase();
    return rows.filter((row) => {
      const providerMatch = !providerFilter || String(row?.providerName || '').toUpperCase() === providerFilter;
      const countryMatch = !countryTerm || String(row?.countryCode || '').toUpperCase().includes(countryTerm);
      const cronEnabled = Boolean(row?.cronEnabled);
      const cronMatch = !cronEnabledFilter || (cronEnabledFilter === 'true' ? cronEnabled : !cronEnabled);
      return providerMatch && countryMatch && cronMatch;
    });
  }, [countryFilter, cronEnabledFilter, providerFilter, rows]);

  const summary = useMemo(() => {
    const total = rows.length;
    const reloadly = rows.filter((row) => String(row?.providerName || '').toUpperCase() === 'RELOADLY_UTILITIES').length;
    const zendit = rows.filter((row) => String(row?.providerName || '').toUpperCase() === 'ZENDIT').length;
    const cronEnabled = rows.filter((row) => Boolean(row?.cronEnabled)).length;
    return { total, reloadly, zendit, cronEnabled };
  }, [rows]);

  const columns = useMemo(
    () => [
      { key: 'providerName', label: 'Provider' },
      { key: 'countryCode', label: 'Country', render: (row) => row.countryCode || '—' },
      { key: 'itemCount', label: 'Cached Items' },
      { key: 'lastSyncedAt', label: 'Last Synced', render: (row) => formatDateTime(row.lastSyncedAt) },
      { key: 'cronJobKey', label: 'Cron Key', render: (row) => row.cronJobKey || '—' },
      { key: 'cronEnabled', label: 'Cron Enabled', render: (row) => <StatusBadge enabled={Boolean(row.cronEnabled)} /> },
      {
        key: 'actions',
        label: 'Action',
        render: (row) => {
          const providerName = String(row?.providerName || '').toUpperCase();
          return (
            <button
              type="button"
              className="btn-neutral btn-sm"
              onClick={() => handleTrigger(providerName)}
              disabled={Boolean(pendingProviders[providerName])}
            >
              {pendingProviders[providerName] ? 'Enqueuing…' : 'Trigger Sync'}
            </button>
          );
        }
      }
    ],
    [handleTrigger, pendingProviders]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Utility Bill Catalog Sync</div>
          <div style={{ color: 'var(--muted)' }}>
            Monitor cached utility catalog slices and manually enqueue sync events for Reloadly Utilities and Zendit.
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Triggering from this page enqueues an outbox event. The worker performs the real sync asynchronously. Use Utility Bill Catalog to inspect actual synced items afterward.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {providerOptions.map((provider) => (
            <button
              key={provider}
              type="button"
              className="btn-primary"
              onClick={() => handleTrigger(provider)}
              disabled={Boolean(pendingProviders[provider])}
            >
              {pendingProviders[provider] ? `Enqueuing ${provider}…` : provider === 'RELOADLY_UTILITIES' ? 'Sync Reloadly Utilities' : 'Sync Zendit Utilities'}
            </button>
          ))}
          <Link href="/dashboard/bills" className="btn-neutral">
            {'<- Bills hub'}
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <SummaryCard label="Total Cached Slices" value={summary.total} />
        <SummaryCard label="Reloadly Utilities" value={summary.reloadly} tone="reloadly" />
        <SummaryCard label="Zendit Utilities" value={summary.zendit} tone="zendit" />
        <SummaryCard label="Cron Enabled" value={summary.cronEnabled} tone="cron" />
      </div>

      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="providerFilter">Provider</label>
          <select id="providerFilter" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
            <option value="">All</option>
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="countryFilter">Country</label>
          <input id="countryFilter" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value.toUpperCase())} placeholder="CD" maxLength={2} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="cronEnabledFilter">Cron Enabled</label>
          <select id="cronEnabledFilter" value={cronEnabledFilter} onChange={(e) => setCronEnabledFilter(e.target.value)}>
            <option value="">All</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={fetchRows} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type="button"
            className="btn-neutral"
            onClick={() => {
              setProviderFilter('');
              setCountryFilter('');
              setCronEnabledFilter('');
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
        emptyLabel={loading ? 'Loading utility bill catalog sync status…' : 'No utility bill catalog sync slices found'}
        pageSize={50}
        showAccountQuickNav={false}
      />
    </div>
  );
}
