'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

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
        schedule: item?.schedule || '—',
        enabled: Boolean(item?.enabled)
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
          prev.map((item) => (item.key === key ? { ...item, key: res.key || item.key, displayName: res.displayName || item.displayName, schedule: res.schedule || item.schedule, enabled: Boolean(res.enabled) } : item))
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
      { key: 'key', label: 'Key' },
      { key: 'schedule', label: 'Schedule' },
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
