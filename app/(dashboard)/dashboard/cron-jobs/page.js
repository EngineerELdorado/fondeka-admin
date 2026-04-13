'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const cronDescriptions = {
  'loan.due_reminder': 'Sends loan repayment reminders on D-3, D-2, D-1, and D0 (UTC-day logic). Penalty notifications continue via penalty cron after due date.',
  'reloadly_recharge_catalog.sync': 'Worker-side scheduler that enqueues Reloadly mobile recharge catalog refresh events. Pausing it leaves cached recharge data in place but it will become stale over time.',
  'zendit_recharge_catalog.sync': 'Worker-side scheduler that enqueues Zendit mobile recharge catalog refresh events. Use manual sync on the Recharge Catalog Sync page if you need an immediate refresh.',
  'reloadly_utilities_catalog.sync': 'Worker-side scheduler that enqueues Reloadly Utilities catalog refresh events. It controls cache freshness, not customer-facing bill product visibility.',
  'zendit_utilities_catalog.sync': 'Worker-side scheduler that enqueues Zendit utility voucher catalog refresh events. Use Utility Bill Catalog Sync to enqueue an immediate refresh when needed.'
};

const getCronGroup = (key) => {
  const value = String(key || '').trim();
  if (['reloadly_recharge_catalog.sync', 'zendit_recharge_catalog.sync'].includes(value)) return 'Mobile Recharge Catalog Sync';
  if (['reloadly_utilities_catalog.sync', 'zendit_utilities_catalog.sync'].includes(value)) return 'Utility Bill Catalog Sync';
  return 'Other';
};

const normalizeList = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.content)) return res.content;
  if (Array.isArray(res?.items)) return res.items;
  return [];
};

const StatusBadge = ({ enabled }) => {
  const on = Boolean(enabled);
  const tone = on ? { bg: '#ECFDF3', fg: '#15803D', label: 'Enabled' } : { bg: '#F3F4F6', fg: '#374151', label: 'Paused' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.5rem',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 700,
        background: tone.bg,
        color: tone.fg
      }}
    >
      {tone.label}
    </span>
  );
};

export default function CronJobsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [pendingByKey, setPendingByKey] = useState({});

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.cronJobs.list();
      const list = normalizeList(res).map((item) => ({
        key: item?.key || '',
        displayName: item?.displayName || item?.key || '—',
        group: getCronGroup(item?.key),
        schedule: item?.schedule || '—',
        enabled: Boolean(item?.enabled),
        description: cronDescriptions[item?.key] || '—'
      }));
      setRows(list);
    } catch (err) {
      setRows([]);
      setError(err?.message || 'Failed to load cron jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const toggle = useCallback(async (row) => {
    if (!row?.key) return;
    const key = row.key;
    setPendingByKey((prev) => ({ ...prev, [key]: true }));
    setError(null);
    setInfo(null);
    try {
      const res = row.enabled ? await api.cronJobs.pause(key) : await api.cronJobs.unpause(key);
      if (res && typeof res === 'object' && (res.key || key)) {
        setRows((prev) =>
          prev.map((item) =>
            item.key === key
              ? {
                  ...item,
                  key: res.key || item.key,
                  displayName: res.displayName || item.displayName,
                  group: getCronGroup(res.key || item.key),
                  schedule: res.schedule || item.schedule,
                  enabled: Boolean(res.enabled),
                  description: cronDescriptions[res.key || item.key] || item.description
                }
              : item
          )
        );
      } else {
        await fetchRows();
      }
      setInfo(`${row.enabled ? 'Paused' : 'Unpaused'} ${key}.`);
    } catch (err) {
      setError(err?.message || `Failed to ${row.enabled ? 'pause' : 'unpause'} ${key}`);
    } finally {
      setPendingByKey((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  const columns = useMemo(
    () => [
      { key: 'displayName', label: 'Name' },
      { key: 'group', label: 'Group' },
      { key: 'key', label: 'Key' },
      { key: 'schedule', label: 'Schedule' },
      { key: 'description', label: 'Description' },
      {
        key: 'enabled',
        label: 'Status',
        render: (row) => <StatusBadge enabled={row.enabled} />
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <button type="button" className={row.enabled ? 'btn-danger btn-sm' : 'btn-success btn-sm'} onClick={() => toggle(row)} disabled={Boolean(pendingByKey[row.key])}>
            {pendingByKey[row.key] ? 'Updating…' : row.enabled ? 'Pause' : 'Unpause'}
          </button>
        )
      }
    ],
    [pendingByKey, toggle]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Cron Jobs</div>
          <div style={{ color: 'var(--muted)' }}>Monitor and control scheduled background jobs.</div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            Catalog sync jobs are maintenance schedulers. Pause or unpause them here, and use the dedicated sync pages when you need an immediate manual refresh.
          </div>
        </div>
        <button type="button" className="btn-neutral" onClick={fetchRows} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} emptyLabel={loading ? 'Loading cron jobs…' : 'No cron jobs found'} pageSize={50} showAccountQuickNav={false} />
    </div>
  );
}
