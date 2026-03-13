'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

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

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
};

const pick = (...values) => values.find((value) => value !== null && value !== undefined && String(value).trim() !== '');
const normalizeEmailFilter = (value) => String(value || '').trim().toLowerCase();

export default function BlacklistPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [appliedEmail, setAppliedEmail] = useState('');

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (appliedEmail) params.set('email', appliedEmail);
      const res = await api.blacklist.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      const normalized = (list || []).map((item) => ({
        id: item?.id,
        accountId: pick(item?.accountId, item?.account?.id),
        accountReference: pick(item?.accountReference, item?.account?.accountReference, item?.account?.accountNumber),
        userReference: pick(item?.userReference, item?.account?.userReference),
        firstName: pick(item?.firstName, item?.account?.userFirstName),
        lastName: pick(item?.lastName, item?.account?.userLastName),
        otherNames: pick(item?.otherNames, item?.account?.userMiddleName),
        username: pick(item?.username, item?.account?.username),
        email: pick(item?.email, item?.accountEmail, item?.account?.email),
        phoneNumber: pick(item?.phoneNumber, item?.accountPhoneNumber, item?.account?.phoneNumber),
        reason: pick(item?.reason, item?.details, item?.comment, item?.note),
        createdAt: pick(item?.createdAt, item?.created_at, item?.timestamp),
        raw: item
      }));
      setRows(normalized);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err?.message || 'Failed to load blacklist entries');
      setRows([]);
      setPageMeta({ totalElements: null, totalPages: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  const canGoPrevious = page > 0;
  const canGoNext = pageMeta.totalPages === null ? rows.length === size && rows.length > 0 : page + 1 < pageMeta.totalPages;

  const columns = useMemo(
    () => [
      { key: 'id', label: 'Entry ID' },
      { key: 'accountId', label: 'Account ID' },
      {
        key: 'accountReference',
        label: 'Account ref',
        render: (row) => {
          const accountId = row?.accountId;
          const accountReference = row?.accountReference || '—';
          if (!accountId) return accountReference;
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
              <span>{accountReference}</span>
              <Link
                href={`/dashboard/accounts/accounts/${encodeURIComponent(String(accountId))}`}
                aria-label={`Open account ${accountId}`}
                title={`Open account ${accountId}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '999px',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  textDecoration: 'none'
                }}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21a8 8 0 1 0-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </Link>
            </span>
          );
        }
      },
      {
        key: 'user',
        label: 'User',
        render: (row) => {
          const fullName = [row?.firstName, row?.otherNames, row?.lastName].filter(Boolean).join(' ').trim();
          return fullName || row?.username || row?.email || '—';
        }
      },
      { key: 'userReference', label: 'User ref' },
      { key: 'email', label: 'Email' },
      { key: 'phoneNumber', label: 'Phone' },
      { key: 'reason', label: 'Reason', render: (row) => row.reason || '—' },
      { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <button type="button" className="btn-danger btn-sm" onClick={() => setConfirmDelete(row)}>
            Remove from blacklist
          </button>
        )
      }
    ],
    []
  );

  const deleteEntry = async () => {
    if (!confirmDelete?.id) return;
    setDeleting(true);
    setError(null);
    setInfo(null);
    try {
      await api.blacklist.remove(confirmDelete.id);
      setConfirmDelete(null);
      setInfo('Blacklist entry removed. Access restored for this account.');
      await fetchRows();
    } catch (err) {
      setError(err?.message || 'Failed to remove blacklist entry');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Blacklist</div>
          <div style={{ color: 'var(--muted)' }}>Review blocked accounts and remove blacklist entries by entry ID.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={fetchRows} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <Link href="/dashboard/accounts/accounts" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
            ← Accounts
          </Link>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="page">Page</label>
          <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="size">Size</label>
          <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>
        <button type="button" className="btn-neutral" onClick={fetchRows} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '260px', flex: 1 }}>
          <label htmlFor="emailFilter">Email (exact)</label>
          <input
            id="emailFilter"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setPage(0);
            setAppliedEmail(normalizeEmailFilter(emailInput));
          }}
          disabled={loading}
        >
          Apply email filter
        </button>
        <button
          type="button"
          className="btn-neutral"
          onClick={() => {
            setEmailInput('');
            setAppliedEmail('');
            setPage(0);
          }}
          disabled={loading}
        >
          Clear filter
        </button>
      </div>

      {appliedEmail && (
        <div className="card" style={{ color: 'var(--muted)', fontSize: '13px' }}>
          Filtering by email: <strong>{appliedEmail}</strong> (exact match, case-insensitive).
        </div>
      )}

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={size}
        totalPages={pageMeta.totalPages}
        totalElements={pageMeta.totalElements}
        onPageChange={setPage}
        canPrev={canGoPrevious}
        canNext={canGoNext}
        emptyLabel="No blacklist entries found"
        showAccountQuickNav={false}
      />

      {confirmDelete && (
        <Modal title="Remove blacklist entry" onClose={() => (!deleting ? setConfirmDelete(null) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)' }}>
              Remove blacklist entry <strong>{confirmDelete.id}</strong> for account{' '}
              <strong>{confirmDelete.accountReference || confirmDelete.accountId || '—'}</strong>?
            </div>
            <div style={{ color: 'var(--muted)' }}>This restores account access immediately.</div>
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={deleteEntry} disabled={deleting}>
                {deleting ? 'Removing…' : 'Remove from blacklist'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
