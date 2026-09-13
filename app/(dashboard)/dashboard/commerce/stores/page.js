'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const VERIFICATION_STATUSES = ['UNVERIFIED', 'VERIFIED', 'REJECTED'];
const STORE_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'CLOSED'];
const VISIBILITIES = ['PUBLIC', 'PRIVATE', 'UNLISTED'];
const DELETED_STATE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active only' },
  { value: 'deleted', label: 'Deleted only' }
];

const asText = (...values) => {
  const value = values.find((item) => item !== null && item !== undefined && String(item).trim() !== '');
  return value === null || value === undefined ? '—' : String(value);
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const badgeStyle = (tone) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.25rem 0.5rem',
  borderRadius: '999px',
  border: `1px solid ${tone.border}`,
  background: tone.background,
  color: tone.color,
  fontSize: '12px',
  fontWeight: 800,
  whiteSpace: 'nowrap'
});

const verificationTone = (status) => {
  if (status === 'VERIFIED') return { border: 'rgba(22, 163, 74, 0.28)', background: 'rgba(22, 163, 74, 0.08)', color: '#166534' };
  if (status === 'REJECTED') return { border: 'rgba(220, 38, 38, 0.28)', background: 'rgba(220, 38, 38, 0.08)', color: '#991b1b' };
  return { border: 'rgba(245, 158, 11, 0.32)', background: 'rgba(245, 158, 11, 0.1)', color: '#92400e' };
};

const getStoreId = (row) => row?.id ?? row?.storeId ?? row?.commerceStoreId;
const getDeletedAt = (row) => row?.deletedAt ?? row?.deleted_at ?? row?.selfDeletedAt ?? row?.removedAt ?? null;
const isDeletedStore = (row) => Boolean(row?.deleted || row?.deletedFlag || row?.isDeleted || getDeletedAt(row) || String(row?.status || '').toUpperCase() === 'DELETED');

const getOwnerLabel = (row) => {
  const account = row?.account || row?.owner || row?.merchant || row?.user;
  const name = [account?.firstName, account?.lastName].filter(Boolean).join(' ').trim();
  return asText(row?.accountReference, row?.ownerAccountReference, account?.accountReference, name, account?.email, row?.accountId, row?.ownerAccountId);
};

export default function CommerceStoresPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [verificationStatus, setVerificationStatus] = useState('');
  const [status, setStatus] = useState('');
  const [visibility, setVisibility] = useState('');
  const [deletedState, setDeletedState] = useState('');
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (verificationStatus) params.set('verificationStatus', verificationStatus);
      if (status) params.set('status', status);
      if (visibility) params.set('visibility', visibility);
      if (deletedState === 'active') params.set('deleted', 'false');
      if (deletedState === 'deleted') params.set('deleted', 'true');
      const res = await api.commerceStores.list(params);
      const list = Array.isArray(res) ? res : res?.content || res?.stores || [];
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err?.message || 'Failed to load commerce stores.');
      setRows([]);
      setPageMeta({ totalElements: null, totalPages: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, verificationStatus, status, visibility, deletedState]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!info && !error) return;
    const timeout = setTimeout(() => {
      setInfo(null);
      setError(null);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [info, error]);

  const updateVerification = useCallback(
    async (row, nextStatus) => {
      const storeId = getStoreId(row);
      if (!storeId || savingId) return;
      setSavingId(String(storeId));
      setError(null);
      setInfo(null);
      try {
        const res = await api.commerceStores.updateVerification(storeId, { verificationStatus: nextStatus });
        setRows((prev) =>
          prev.map((item) => {
            const itemId = getStoreId(item);
            if (String(itemId) !== String(storeId)) return item;
            return { ...item, ...(res && typeof res === 'object' ? res : {}), verificationStatus: nextStatus };
          })
        );
        setInfo(`Store ${storeId} marked ${nextStatus}.`);
      } catch (err) {
        setError(err?.message || 'Failed to update store verification.');
      } finally {
        setSavingId('');
      }
    },
    [savingId]
  );

  const restoreStore = useCallback(
    async (row) => {
      const storeId = getStoreId(row);
      if (!storeId || savingId) return;
      setSavingId(String(storeId));
      setError(null);
      setInfo(null);
      try {
        const res = await api.commerceStores.restore(storeId);
        setRows((prev) => {
          if (deletedState === 'deleted') return prev.filter((item) => String(getStoreId(item)) !== String(storeId));
          return prev.map((item) => {
            const itemId = getStoreId(item);
            if (String(itemId) !== String(storeId)) return item;
            const restored = res && typeof res === 'object' ? res : {};
            return { ...item, ...restored, deleted: false, isDeleted: false, deletedAt: null, selfDeletedAt: null };
          });
        });
        setInfo(`Store ${storeId} restored.`);
      } catch (err) {
        setError(err?.message || 'Failed to restore store.');
      } finally {
        setSavingId('');
      }
    },
    [deletedState, savingId]
  );

  const clearFilters = () => {
    setVerificationStatus('');
    setStatus('');
    setVisibility('');
    setDeletedState('');
    setPage(0);
  };

  const columns = useMemo(
    () => [
      {
        key: 'store',
        label: 'Store',
        render: (row) => {
          const storeId = getStoreId(row);
          return (
            <div style={{ display: 'grid', gap: '0.2rem' }}>
              <div style={{ fontWeight: 800 }}>{asText(row?.name, row?.storeName, row?.displayName, `Store ${storeId || ''}`)}</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{asText(row?.slug, row?.handle, row?.publicName)}</div>
              {storeId ? <div style={{ color: 'var(--muted)', fontSize: '12px' }}>ID {storeId}</div> : null}
            </div>
          );
        }
      },
      { key: 'owner', label: 'Owner', render: (row) => getOwnerLabel(row) },
      {
        key: 'status',
        label: 'Status',
        render: (row) => {
          const deleted = isDeletedStore(row);
          return (
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{asText(row?.status)}</span>
              {deleted ? (
                <span style={badgeStyle({ border: 'rgba(220, 38, 38, 0.28)', background: 'rgba(220, 38, 38, 0.08)', color: '#991b1b' })}>
                  Deleted
                </span>
              ) : null}
            </div>
          );
        }
      },
      {
        key: 'visibility',
        label: 'Visibility',
        render: (row) => asText(row?.visibility)
      },
      {
        key: 'verificationStatus',
        label: 'Verification',
        render: (row) => {
          const value = asText(row?.verificationStatus, 'UNVERIFIED');
          return <span style={badgeStyle(verificationTone(value))}>{value}</span>;
        }
      },
      {
        key: 'countryCurrency',
        label: 'Country / Currency',
        render: (row) => asText([row?.countryCode, row?.currency].filter(Boolean).join(' / '), row?.country, row?.currency)
      },
      {
        key: 'deletedAt',
        label: 'Deleted at',
        render: (row) => formatDateTime(getDeletedAt(row))
      },
      {
        key: 'createdAt',
        label: 'Created',
        render: (row) => formatDateTime(row?.createdAt || row?.createdDate)
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => {
          const storeId = getStoreId(row);
          const current = asText(row?.verificationStatus, 'UNVERIFIED');
          const deleted = isDeletedStore(row);
          return (
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {deleted ? (
                <button
                  type="button"
                  className="btn-success btn-sm"
                  onClick={() => restoreStore(row)}
                  disabled={!storeId || savingId === String(storeId)}
                >
                  {savingId === String(storeId) ? 'Restoring...' : 'Restore'}
                </button>
              ) : (
                VERIFICATION_STATUSES.map((nextStatus) => (
                  <button
                    key={nextStatus}
                    type="button"
                    className={nextStatus === 'VERIFIED' ? 'btn-success btn-sm' : nextStatus === 'REJECTED' ? 'btn-danger btn-sm' : 'btn-neutral btn-sm'}
                    onClick={() => updateVerification(row, nextStatus)}
                    disabled={!storeId || savingId === String(storeId) || current === nextStatus}
                  >
                    {nextStatus}
                  </button>
                ))
              )}
            </div>
          );
        }
      }
    ],
    [restoreStore, savingId, updateVerification]
  );

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size && rows.length > 0 : page + 1 < pageMeta.totalPages;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 800 }}>Commerce Stores</div>
          <div style={{ color: 'var(--muted)' }}>Review stores and update their verification status.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/dashboard/commerce/store-creation-fee" className="btn-neutral" style={{ textDecoration: 'none' }}>
            Store creation fee
          </Link>
          <Link href="/dashboard/commerce/settlement-policy" className="btn-neutral" style={{ textDecoration: 'none' }}>
            Settlement policy
          </Link>
          <Link href="/dashboard/feature-flags" className="btn-neutral" style={{ textDecoration: 'none' }}>
            Commerce flags
          </Link>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="verificationStatus">Verification</label>
            <select
              id="verificationStatus"
              value={verificationStatus}
              onChange={(e) => {
                setVerificationStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All</option>
              {VERIFICATION_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="storeStatus">Store status</label>
            <select
              id="storeStatus"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All</option>
              {STORE_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="visibility">Visibility</label>
            <select
              id="visibility"
              value={visibility}
              onChange={(e) => {
                setVisibility(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All</option>
              {VISIBILITIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="deletedState">Deleted state</label>
            <select
              id="deletedState"
              value={deletedState}
              onChange={(e) => {
                setDeletedState(e.target.value);
                setPage(0);
              }}
            >
              {DELETED_STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="pageSize">Page size</label>
            <input
              id="pageSize"
              type="number"
              min={1}
              max={200}
              value={size}
              onChange={(e) => {
                setSize(Math.max(1, Number(e.target.value) || 20));
                setPage(0);
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={fetchRows} disabled={loading || Boolean(savingId)}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button type="button" className="btn-neutral" onClick={clearFilters} disabled={loading || Boolean(savingId)}>
            Clear filters
          </button>
          {pageMeta.totalElements !== null ? (
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
              {pageMeta.totalElements} stores total
              {pageMeta.totalPages !== null && pageMeta.totalPages > 0 ? ` | page ${page + 1}/${pageMeta.totalPages}` : ''}
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>
          {info}
        </div>
      ) : null}

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
        emptyLabel={loading ? 'Loading commerce stores...' : 'No commerce stores found'}
        rowStyle={(row) => (isDeletedStore(row) ? { opacity: 0.62, background: '#FEF2F2' } : {})}
      />
    </div>
  );
}
