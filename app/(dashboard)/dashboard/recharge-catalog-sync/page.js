'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const providerOptions = ['RELOADLY', 'ZENDIT'];
const rechargeTypeOptions = ['AIRTIME', 'DATA', 'BUNDLE'];

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

export default function RechargeCatalogSyncPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [providerFilter, setProviderFilter] = useState('');
  const [rechargeTypeFilter, setRechargeTypeFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [cronEnabledFilter, setCronEnabledFilter] = useState('');
  const [pendingProviders, setPendingProviders] = useState({});

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.rechargeCatalogSync.list();
      setRows(normalizeList(res));
    } catch (err) {
      setRows([]);
      setError(err?.message || 'Failed to load recharge catalog sync status.');
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
      const res = await api.rechargeCatalogSync.trigger(providerName);
      const status = String(res?.status || '').trim().toUpperCase();
      if (status && status !== 'TRIGGERED') {
        setInfo(`${providerName} sync request returned ${status}.`);
      } else {
        setInfo(`${providerName} catalog sync triggered.`);
      }
      await fetchRows();
    } catch (err) {
      setError(err?.message || `Failed to trigger ${providerName} catalog sync.`);
    } finally {
      setPendingProviders((prev) => ({ ...prev, [providerName]: false }));
    }
  }, []);

  const filteredRows = useMemo(() => {
    const countryTerm = countryFilter.trim().toUpperCase();
    return rows.filter((row) => {
      const providerMatch = !providerFilter || String(row?.providerName || '').toUpperCase() === providerFilter;
      const rechargeTypeMatch = !rechargeTypeFilter || String(row?.rechargeType || '').toUpperCase() === rechargeTypeFilter;
      const countryMatch = !countryTerm || String(row?.countryCode || '').toUpperCase().includes(countryTerm);
      const cronEnabled = Boolean(row?.cronEnabled);
      const cronMatch =
        !cronEnabledFilter || (cronEnabledFilter === 'true' ? cronEnabled : !cronEnabled);
      return providerMatch && rechargeTypeMatch && countryMatch && cronMatch;
    });
  }, [countryFilter, cronEnabledFilter, providerFilter, rechargeTypeFilter, rows]);

  const summary = useMemo(() => {
    const total = rows.length;
    const reloadly = rows.filter((row) => String(row?.providerName || '').toUpperCase() === 'RELOADLY').length;
    const zendit = rows.filter((row) => String(row?.providerName || '').toUpperCase() === 'ZENDIT').length;
    const cronEnabled = rows.filter((row) => Boolean(row?.cronEnabled)).length;
    return { total, reloadly, zendit, cronEnabled };
  }, [rows]);

  const columns = useMemo(
    () => [
      { key: 'providerName', label: 'Provider' },
      { key: 'rechargeType', label: 'Recharge Type' },
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
              {pendingProviders[providerName] ? 'Triggering…' : 'Trigger Sync'}
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
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Recharge Catalog Sync</div>
          <div style={{ color: 'var(--muted)' }}>
            Monitor cached recharge catalogs and trigger manual refreshes for provider catalog data.
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            This screen is only for catalog cache operations. It does not manage bill product visibility or recharge provider routing.
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
              {pendingProviders[provider] ? `Triggering ${provider}…` : `Trigger ${provider}`}
            </button>
          ))}
          <Link href="/dashboard" className="btn-neutral">
            {'<- Dashboard'}
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <SummaryCard label="Total Cached Slices" value={summary.total} />
        <SummaryCard label="Reloadly Slices" value={summary.reloadly} tone="reloadly" />
        <SummaryCard label="Zendit Slices" value={summary.zendit} tone="zendit" />
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
          <label htmlFor="rechargeTypeFilter">Recharge Type</label>
          <select id="rechargeTypeFilter" value={rechargeTypeFilter} onChange={(e) => setRechargeTypeFilter(e.target.value)}>
            <option value="">All</option>
            {rechargeTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
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
              setRechargeTypeFilter('');
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
        emptyLabel={loading ? 'Loading recharge catalog sync status…' : 'No recharge catalog slices found'}
        pageSize={50}
        showAccountQuickNav={false}
      />
    </div>
  );
}
