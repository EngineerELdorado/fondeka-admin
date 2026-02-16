'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const statusOptions = ['TRUSTED', 'PENDING_REPLACEMENT', 'REVOKED', 'REJECTED'];
const platformOptions = ['ios', 'android'];
const sortByOptions = ['createdAt', 'lastSeenAt', 'status', 'deviceId', 'platform'];
const languageOptions = ['en', 'fr'];

const emptyFilters = {
  accountId: '',
  deviceId: '',
  status: '',
  platform: '',
  deviceName: '',
  userRef: '',
  userId: '',
  userEmail: '',
  userPhone: '',
  sortBy: 'createdAt',
  sortDir: 'desc'
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
          <div style={{ fontWeight: 900, fontSize: '15px' }}>{title}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Fondeka Admin</div>
        </div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
          ×
        </button>
      </div>
      {children}
    </div>
  </div>
);

const StatusBadge = ({ value }) => {
  if (!value) return '—';
  const raw = String(value).toUpperCase();
  const val = raw === 'PENDING_REPLACEMENT' ? 'PENDING' : raw;
  const tone =
    val === 'TRUSTED'
      ? { bg: '#ECFDF3', fg: '#15803D' }
      : val === 'PENDING'
        ? { bg: '#EFF6FF', fg: '#1D4ED8' }
        : val === 'REVOKED'
          ? { bg: '#FEF2F2', fg: '#B91C1C' }
          : val === 'REJECTED'
            ? { bg: '#FFF7ED', fg: '#C2410C' }
            : { bg: '#E5E7EB', fg: '#374151' };
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
      {val}
    </span>
  );
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

export default function TrustedDevicesPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [confirmRevoke, setConfirmRevoke] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmLanguage, setConfirmLanguage] = useState(null);
  const [detailsRow, setDetailsRow] = useState(null);
  const [actionLoading, setActionLoading] = useState('');
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const openDetails = async (row) => {
    setDetailsRow(row);
    if (!row?.deviceId || row?.pushToken) return;
    try {
      const res = await api.devices.get(row.deviceId);
      if (!res) return;
      setDetailsRow((prev) => (prev?.deviceId === row.deviceId ? { ...prev, ...res } : prev));
    } catch {
      // Fall back to list payload if the details endpoint isn't available.
    }
  };

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        if (['accountId', 'userId'].includes(key)) {
          const num = Number(value);
          if (!Number.isNaN(num)) params.set(key, String(num));
        } else {
          params.set(key, String(value));
        }
      });
      const res = await api.devices.list(params);
      const list = Array.isArray(res) ? res : res?.content || res?.devices || [];
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!rows || rows.length === 0) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set();
      rows.forEach((row) => {
        if (prev.has(row.deviceId)) next.add(row.deviceId);
      });
      return next;
    });
  }, [rows]);

  useEffect(() => {
    if (!info && !error) return;
    const t = setTimeout(() => {
      setInfo(null);
      setError(null);
    }, 3500);
    return () => clearTimeout(t);
  }, [info, error]);

  const applyFilters = () => {
    setPage(0);
    setAppliedFilters(filters);
  };

  const resetFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(0);
  };

  const handleRevokeDevice = async () => {
    if (!confirmRevoke?.deviceId) return;
    const deviceId = confirmRevoke.deviceId;
    setError(null);
    setInfo(null);
    setActionLoading(`revoke-${deviceId}`);
    try {
      await api.devices.revoke(deviceId);
      setInfo(`Revoked device ${deviceId}.`);
      setConfirmRevoke(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  };

  const handleDeleteDevices = async (deviceIds) => {
    const ids = (deviceIds || []).map((id) => String(id).trim()).filter(Boolean);
    if (ids.length === 0) {
      setError('Select at least one device to delete.');
      return;
    }
    setError(null);
    setInfo(null);
    setActionLoading(ids.length === 1 ? `delete-${ids[0]}` : 'delete-bulk');
    try {
      if (ids.length === 1) {
        await api.devices.remove(ids[0]);
        setInfo(`Deleted device ${ids[0]}.`);
      } else {
        await api.devices.removeMany(ids);
        setInfo(`Deleted ${ids.length} devices.`);
      }
      setConfirmDelete(null);
      setSelectedIds(new Set());
      fetchRows();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  };

  const handleLanguageSelect = (row, nextLanguage) => {
    if (!row?.deviceId) return;
    const normalized = String(nextLanguage || '').toLowerCase();
    if (!languageOptions.includes(normalized)) {
      setError('Language must be en or fr.');
      return;
    }
    if (String(row.preferredLanguage || '').toLowerCase() === normalized) return;
    setConfirmLanguage({ row, nextLanguage: normalized });
  };

  const handleConfirmLanguageUpdate = async () => {
    if (!confirmLanguage?.row?.deviceId || !confirmLanguage?.nextLanguage) return;
    const { row, nextLanguage } = confirmLanguage;
    setError(null);
    setInfo(null);
    setActionLoading(`lang-${row.deviceId}`);
    try {
      await api.devices.updateLanguage(row.deviceId, { preferredLanguage: nextLanguage });
      setInfo(`Updated device ${row.deviceId} language to ${nextLanguage}.`);
      setConfirmLanguage(null);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to update device language.');
    } finally {
      setActionLoading('');
    }
  };

  const toggleSelection = (deviceId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  };

  const selectAllOnPage = () => {
    if (!rows || rows.length === 0) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      rows.forEach((row) => {
        if (row.deviceId) next.add(row.deviceId);
      });
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const columns = useMemo(
    () => [
      {
        key: 'select',
        label: '',
        render: (row) => (
          <input
            type="checkbox"
            aria-label={`Select device ${row.deviceId}`}
            checked={selectedIds.has(row.deviceId)}
            onChange={() => toggleSelection(row.deviceId)}
          />
        )
      },
      {
        key: 'deviceId',
        label: 'Device',
        render: (row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div style={{ fontWeight: 700 }}>{row.deviceName || 'Unnamed device'}</div>
          </div>
        )
      },
      {
        key: 'accountId',
        label: 'Owner',
        render: (row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            <div>
              {row.userFullName || `${row.userFirstName || ''} ${row.userLastName || ''}`.trim() || '—'}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              {row.accountReference ? row.accountReference : row.accountId !== undefined && row.accountId !== null ? `Account #${row.accountId}` : 'No account'}
            </div>
          </div>
        )
      },
      {
        key: 'userPhoneNumber',
        label: 'Phone',
        render: (row) => row.userPhoneNumber || row.phoneNumber || '—'
      },
      {
        key: 'status',
        label: 'Status',
        render: (row) => <StatusBadge value={row.status} />
      },
      {
        key: 'platform',
        label: 'Platform',
        render: (row) => (row.platform ? row.platform.toUpperCase() : '—')
      },
      {
        key: 'lastSeenAt',
        label: 'Last seen',
        render: (row) => formatDateTime(row.lastSeenAt)
      },
      {
        key: 'preferredLanguage',
        label: 'Language',
        render: (row) => {
          const current = String(row.preferredLanguage || '').toLowerCase();
          return (
            <select
              aria-label={`Preferred language for device ${row.deviceId}`}
              value={languageOptions.includes(current) ? current : ''}
              onChange={(e) => handleLanguageSelect(row, e.target.value)}
              disabled={actionLoading === `lang-${row.deviceId}`}
            >
              <option value="">—</option>
              {languageOptions.map((lang) => (
                <option key={lang} value={lang}>
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
          );
        }
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: '220px' }}>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => openDetails(row)} className="btn-ghost btn-sm">
                Details
              </button>
              <button type="button" onClick={() => setConfirmRevoke(row)} className="btn-danger btn-sm" disabled={actionLoading === `revoke-${row.deviceId}`}>
                {actionLoading === `revoke-${row.deviceId}` ? 'Revoking…' : 'Revoke'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete({ deviceIds: [row.deviceId] })}
                className="btn-danger btn-sm"
                disabled={actionLoading === `delete-${row.deviceId}`}
              >
                {actionLoading === `delete-${row.deviceId}` ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )
      }
    ],
    [actionLoading, selectedIds]
  );

  const parseTimestamp = (value) => {
    if (!value) return 0;
    const ts = new Date(value).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  };

  const groupedRows = useMemo(() => {
    const groups = new Map();
    rows.forEach((row) => {
      const rawAccountId = row.accountId;
      const groupKey = rawAccountId === null || rawAccountId === undefined || rawAccountId === '' ? '__unassigned__' : String(rawAccountId);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          accountId: rawAccountId,
          accountReference: row.accountReference || '',
          rows: []
        });
      }
      const group = groups.get(groupKey);
      if (!group.accountReference && row.accountReference) group.accountReference = row.accountReference;
      group.rows.push(row);
    });
    return Array.from(groups.values())
      .map((group) => {
        const sortedDevices = [...group.rows].sort((a, b) => {
          const aTs = parseTimestamp(a.lastSeenAt || a.createdAt);
          const bTs = parseTimestamp(b.lastSeenAt || b.createdAt);
          return bTs - aTs;
        });
        const latestDevice = sortedDevices[0] || null;
        const profileSource =
          sortedDevices.find((item) => item.userFullName || item.userFirstName || item.userLastName || item.userEmail || item.email || item.userPhoneNumber || item.phoneNumber) ||
          latestDevice ||
          {};
        return {
          ...group,
          rows: sortedDevices,
          latestDevice,
          otherDevices: sortedDevices.slice(1),
          userName: profileSource.userFullName || `${profileSource.userFirstName || ''} ${profileSource.userLastName || ''}`.trim() || '—',
          userEmail: profileSource.userEmail || profileSource.email || '—',
          userPhone: profileSource.userPhoneNumber || profileSource.phoneNumber || '—'
        };
      })
      .sort((a, b) => parseTimestamp(b.latestDevice?.lastSeenAt || b.latestDevice?.createdAt) - parseTimestamp(a.latestDevice?.lastSeenAt || a.latestDevice?.createdAt));
  }, [rows]);

  useEffect(() => {
    setExpandedGroups((prev) => {
      if (!prev.size) return prev;
      const validKeys = new Set(groupedRows.map((group) => group.key));
      const next = new Set();
      prev.forEach((key) => {
        if (validKeys.has(key)) next.add(key);
      });
      return next;
    });
  }, [groupedRows]);

  const toggleGroup = (groupKey) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const DetailCard = ({ label, children }) => (
    <div className="detail-card">
      <div className="detail-label">{label}</div>
      <div className="detail-value">{children}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Trusted Devices</div>
          <div style={{ color: 'var(--muted)' }}>Search, trust, revoke, or delete registered devices.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/dashboard/device-replacement-requests" className="btn-neutral">
            Replacement requests
          </Link>
          <Link href="/dashboard" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
            ← Dashboard
          </Link>
        </div>
      </div>

      {info && (
        <div className="card" style={{ color: '#166534', fontWeight: 700, border: '1px solid #bbf7d0', background: '#ecfdf3' }}>
          {info}
        </div>
      )}
      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700, border: '1px solid #fecdd3', background: '#fef2f2' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Filters</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
            <button type="button" onClick={fetchRows} disabled={loading} className="btn-neutral btn-sm">
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
        {showFilters && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="accountId">Account ID</label>
                <input id="accountId" type="number" min={0} value={filters.accountId} onChange={(e) => setFilters((p) => ({ ...p, accountId: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="userId">User ID</label>
                <input id="userId" type="number" min={0} value={filters.userId} onChange={(e) => setFilters((p) => ({ ...p, userId: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="userRef">User ref</label>
                <input id="userRef" value={filters.userRef} onChange={(e) => setFilters((p) => ({ ...p, userRef: e.target.value }))} placeholder="internal reference" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="userEmail">User email</label>
                <input id="userEmail" value={filters.userEmail} onChange={(e) => setFilters((p) => ({ ...p, userEmail: e.target.value }))} placeholder="email@example.com" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="userPhone">User phone contains</label>
                <input id="userPhone" value={filters.userPhone} onChange={(e) => setFilters((p) => ({ ...p, userPhone: e.target.value }))} placeholder="+243" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="deviceId">Device ID</label>
                <input id="deviceId" value={filters.deviceId} onChange={(e) => setFilters((p) => ({ ...p, deviceId: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="deviceName">Device name contains</label>
                <input id="deviceName" value={filters.deviceName} onChange={(e) => setFilters((p) => ({ ...p, deviceName: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="status">Status</label>
                <select id="status" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
                  <option value="">Any</option>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="platform">Platform</label>
                <select id="platform" value={filters.platform} onChange={(e) => setFilters((p) => ({ ...p, platform: e.target.value }))}>
                  <option value="">Any</option>
                  {platformOptions.map((p) => (
                    <option key={p} value={p}>
                      {p.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="sortBy">Sort by</label>
                <select id="sortBy" value={filters.sortBy} onChange={(e) => setFilters((p) => ({ ...p, sortBy: e.target.value }))}>
                  {sortByOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="sortDir">Sort direction</label>
                <select id="sortDir" value={filters.sortDir} onChange={(e) => setFilters((p) => ({ ...p, sortDir: e.target.value }))}>
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="page">Page</label>
                  <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="size">Size</label>
                  <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={applyFilters} disabled={loading} className="btn-primary">
                {loading ? 'Applying…' : 'Apply filters'}
              </button>
              <button type="button" onClick={resetFilters} disabled={loading} className="btn-neutral">
                Reset
              </button>
              <button type="button" onClick={selectAllOnPage} disabled={loading || rows.length === 0} className="btn-neutral">
                Select page
              </button>
              <button type="button" onClick={clearSelection} disabled={selectedIds.size === 0} className="btn-neutral">
                Clear selection
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete({ deviceIds: Array.from(selectedIds) })}
                disabled={selectedIds.size === 0 || actionLoading === 'delete-bulk'}
                className="btn-danger"
              >
                {actionLoading === 'delete-bulk' ? 'Deleting…' : `Delete selected (${selectedIds.size})`}
              </button>
              {pageMeta.totalElements !== null && (
                <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  {pageMeta.totalElements} devices total
                  {pageMeta.totalPages !== null && pageMeta.totalPages > 0 ? ` · page ${page + 1}/${pageMeta.totalPages}` : ''}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="card table-scroll">
        <div className="table-scroll__hint">Swipe to see more</div>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                Expand
              </th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                User
              </th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                Email
              </th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                Phone
              </th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                Last device
              </th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                Platform
              </th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                Language
              </th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                Other devices
              </th>
              <th className="data-table__cell" style={{ textAlign: 'left', padding: '0.75rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted)' }}>
                  No devices found
                </td>
              </tr>
            )}
            {groupedRows.map((group) => {
              const isExpanded = expandedGroups.has(group.key);
              const latest = group.latestDevice;
              return (
                <Fragment key={group.key}>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="data-table__cell" style={{ padding: '0.75rem' }}>
                      <button type="button" className="btn-neutral btn-sm" onClick={() => toggleGroup(group.key)}>
                        {isExpanded ? 'Hide' : 'Show'}
                      </button>
                    </td>
                    <td className="data-table__cell" style={{ padding: '0.75rem' }}>
                      {group.userName}
                    </td>
                    <td className="data-table__cell" style={{ padding: '0.75rem' }}>
                      {group.userEmail}
                    </td>
                    <td className="data-table__cell" style={{ padding: '0.75rem' }}>
                      {group.userPhone}
                    </td>
                    <td className="data-table__cell" style={{ padding: '0.75rem' }}>
                      {latest ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                          <div>{latest.deviceName || latest.deviceId || '—'}</div>
                          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{formatDateTime(latest.lastSeenAt || latest.createdAt)}</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="data-table__cell" style={{ padding: '0.75rem' }}>
                      {latest
                        ? String(latest.platform || '').toLowerCase() === 'ios'
                          ? 'iPhone'
                          : String(latest.platform || '').toLowerCase() === 'android'
                            ? 'Android'
                            : latest.platform
                              ? String(latest.platform).toUpperCase()
                              : '—'
                        : '—'}
                    </td>
                    <td className="data-table__cell" style={{ padding: '0.75rem' }}>
                      {latest?.preferredLanguage ? String(latest.preferredLanguage).toUpperCase() : '—'}
                    </td>
                    <td className="data-table__cell" style={{ padding: '0.75rem' }}>
                      {group.otherDevices.length}
                    </td>
                    <td className="data-table__cell" style={{ padding: '0.75rem' }}>
                      {latest ? (
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => openDetails(latest)} className="btn-ghost btn-sm">
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRevoke(latest)}
                            className="btn-danger btn-sm"
                            disabled={actionLoading === `revoke-${latest.deviceId}`}
                          >
                            {actionLoading === `revoke-${latest.deviceId}` ? 'Revoking…' : 'Revoke'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete({ deviceIds: [latest.deviceId] })}
                            className="btn-danger btn-sm"
                            disabled={actionLoading === `delete-${latest.deviceId}`}
                          >
                            {actionLoading === `delete-${latest.deviceId}` ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={9} style={{ padding: '0.75rem', background: 'var(--card-subtle)' }}>
                        {group.otherDevices.length === 0 ? (
                          <div style={{ color: 'var(--muted)' }}>No other devices for this account.</div>
                        ) : (
                          <DataTable columns={columns} rows={group.otherDevices} emptyLabel="No other devices" />
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {detailsRow && (
        <Modal title="Device details" onClose={() => setDetailsRow(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <div style={{ fontWeight: 900, fontSize: '18px' }}>{detailsRow.deviceName || 'Unnamed device'}</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{detailsRow.deviceId}</div>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                {detailsRow.userFirstName || detailsRow.userLastName ? `${detailsRow.userFirstName || ''} ${detailsRow.userLastName || ''}`.trim() : `User ${detailsRow.userId ?? '—'}`}
                {detailsRow.accountReference ? ` · ${detailsRow.accountReference}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge value={detailsRow.status} />
              {detailsRow.platform && <span className="pill" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{String(detailsRow.platform).toUpperCase()}</span>}
            </div>
          </div>

          <div className="detail-grid" style={{ marginTop: '0.75rem' }}>
            <DetailCard label="Account">
              {detailsRow.accountReference ? detailsRow.accountReference : detailsRow.accountId !== undefined && detailsRow.accountId !== null ? `Account #${detailsRow.accountId}` : '—'}
            </DetailCard>
            <DetailCard label="User reference">{detailsRow.userReference || '—'}</DetailCard>
            <DetailCard label="Email">{detailsRow.userEmail || detailsRow.email || '—'}</DetailCard>
            <DetailCard label="Phone">{detailsRow.userPhoneNumber || detailsRow.phoneNumber || '—'}</DetailCard>
            <DetailCard label="Last seen">{formatDateTime(detailsRow.lastSeenAt)}</DetailCard>
            <DetailCard label="Last seen IP">{detailsRow.lastSeenIp || '—'}</DetailCard>
            <DetailCard label="Last seen country">{detailsRow.lastSeenCountry ? String(detailsRow.lastSeenCountry).toUpperCase() : '—'}</DetailCard>
            <DetailCard label="Country (client)">{detailsRow.lastSeenCountryClient ? String(detailsRow.lastSeenCountryClient).toUpperCase() : '—'}</DetailCard>
            <DetailCard label="Preferred language">
              <select
                aria-label={`Preferred language for device ${detailsRow.deviceId}`}
                value={languageOptions.includes(String(detailsRow.preferredLanguage || '').toLowerCase()) ? String(detailsRow.preferredLanguage || '').toLowerCase() : ''}
                onChange={(e) => handleLanguageSelect(detailsRow, e.target.value)}
                disabled={actionLoading === `lang-${detailsRow.deviceId}`}
              >
                <option value="">—</option>
                {languageOptions.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang.toUpperCase()}
                  </option>
                ))}
              </select>
            </DetailCard>
            <DetailCard label="Push token">
              {detailsRow.pushToken ? (
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace', wordBreak: 'break-all' }}>
                  {detailsRow.pushToken}
                </span>
              ) : (
                '—'
              )}
            </DetailCard>
            <DetailCard label="Active sessions">{detailsRow.activeSessions ?? '—'}</DetailCard>
            <DetailCard label="Created">{formatDateTime(detailsRow.createdAt)}</DetailCard>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={() => setDetailsRow(null)} className="btn-neutral">
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmRevoke(detailsRow);
                setDetailsRow(null);
              }}
              className="btn-danger"
            >
              Revoke device
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmDelete({ deviceIds: [detailsRow.deviceId] });
                setDetailsRow(null);
              }}
              className="btn-danger"
            >
              Delete device
            </button>
          </div>
        </Modal>
      )}

      {confirmRevoke && (
        <Modal title="Revoke device" onClose={() => setConfirmRevoke(null)}>
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
            This will set the device status to REVOKED, set revokedAt to now, and clear all active sessions for {confirmRevoke.deviceName || confirmRevoke.deviceId}. Proceed?
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmRevoke(null)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleRevokeDevice} className="btn-danger" disabled={actionLoading === `revoke-${confirmRevoke.deviceId}`}>
              {actionLoading === `revoke-${confirmRevoke.deviceId}` ? 'Revoking…' : 'Revoke device'}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete device(s)" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
            This will permanently delete {confirmDelete.deviceIds?.length === 1 ? 'this device' : 'these devices'} and any associated records. Proceed?
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleDeleteDevices(confirmDelete.deviceIds)}
              className="btn-danger"
              disabled={actionLoading.startsWith('delete-')}
            >
              {actionLoading.startsWith('delete-') ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {confirmLanguage && (
        <Modal title="Update device language" onClose={() => setConfirmLanguage(null)}>
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
            Update language for device {confirmLanguage.row.deviceName || confirmLanguage.row.deviceId} to {confirmLanguage.nextLanguage.toUpperCase()}?
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmLanguage(null)} className="btn-neutral">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmLanguageUpdate}
              className="btn-primary"
              disabled={actionLoading === `lang-${confirmLanguage.row.deviceId}`}
            >
              {actionLoading === `lang-${confirmLanguage.row.deviceId}` ? 'Updating…' : 'Confirm'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
