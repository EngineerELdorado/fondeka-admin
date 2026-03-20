'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const emptyDraft = {
  accountId: '',
  email: '',
  reason: ''
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

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

const fullName = (row) => [row?.firstName, row?.otherNames, row?.lastName].filter(Boolean).join(' ').trim();

export default function UntrustedBorrowersPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [emailInput, setEmailInput] = useState('');
  const [appliedEmail, setAppliedEmail] = useState('');
  const [removeEmailInput, setRemoveEmailInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (appliedEmail) params.set('email', appliedEmail);
      const res = await api.untrustedBorrowers.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      const normalized = list.map((item) => ({
        id: item?.id,
        accountId: item?.accountId ?? item?.account?.id ?? null,
        accountReference: item?.accountReference ?? item?.account?.accountReference ?? null,
        firstName: item?.firstName ?? item?.account?.userFirstName ?? null,
        lastName: item?.lastName ?? item?.account?.userLastName ?? null,
        otherNames: item?.otherNames ?? item?.account?.userMiddleName ?? null,
        email: item?.email ?? item?.account?.email ?? null,
        phoneNumber: item?.phoneNumber ?? item?.account?.phoneNumber ?? null,
        reason: item?.reason ?? '',
        createdAt: item?.createdAt ?? item?.created_at ?? null,
        updatedAt: item?.updatedAt ?? item?.updated_at ?? null,
        raw: item
      }));
      setRows(normalized);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setRows([]);
      setPageMeta({ totalElements: null, totalPages: null });
      setError(err?.message || 'Failed to load untrusted borrowers');
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
      { key: 'id', label: 'ID' },
      { key: 'accountId', label: 'Account ID' },
      {
        key: 'name',
        label: 'Name',
        render: (row) => fullName(row) || '—'
      },
      { key: 'email', label: 'Email' },
      { key: 'phoneNumber', label: 'Phone' },
      { key: 'reason', label: 'Reason', render: (row) => row.reason || '—' },
      { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-neutral btn-sm"
              onClick={() => openDetails(row)}
            >
              View
            </button>
            <button
              type="button"
              className="btn-neutral btn-sm"
              onClick={() => openEdit(row)}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn-danger btn-sm"
              onClick={() => setConfirmDelete(row)}
            >
              Remove
            </button>
          </div>
        )
      }
    ],
    []
  );

  const openCreate = () => {
    setSelected(null);
    setDraft(emptyDraft);
    setShowCreate(true);
    setError(null);
    setInfo(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      accountId: row?.accountId ? String(row.accountId) : '',
      email: row?.email || '',
      reason: row?.reason || ''
    });
    setShowEdit(true);
    setError(null);
    setInfo(null);
  };

  const openDetails = async (row) => {
    if (!row?.id) return;
    setDetailsLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.untrustedBorrowers.get(row.id);
      setSelected({
        id: res?.id ?? row.id,
        accountId: res?.accountId ?? row.accountId ?? null,
        accountReference: res?.accountReference ?? row.accountReference ?? null,
        firstName: res?.firstName ?? row.firstName ?? null,
        lastName: res?.lastName ?? row.lastName ?? null,
        otherNames: res?.otherNames ?? row.otherNames ?? null,
        email: res?.email ?? row.email ?? null,
        phoneNumber: res?.phoneNumber ?? row.phoneNumber ?? null,
        reason: res?.reason ?? row.reason ?? '',
        createdAt: res?.createdAt ?? row.createdAt ?? null,
        updatedAt: res?.updatedAt ?? row.updatedAt ?? null,
        raw: res
      });
      setShowDetails(true);
    } catch (err) {
      setError(err?.message || 'Failed to load untrusted borrower');
    } finally {
      setDetailsLoading(false);
    }
  };

  const submitCreate = async () => {
    const accountId = Number(draft.accountId);
    const email = normalizeEmail(draft.email);
    const reason = String(draft.reason || '').trim();
    const hasAccountId = Number.isFinite(accountId) && accountId > 0;
    const hasEmail = Boolean(email);
    if (!hasAccountId && !hasEmail) {
      setError('Either account ID or email is required');
      return;
    }
    if (hasEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Email format is invalid');
      return;
    }
    if (!reason) {
      setError('Reason is required');
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const payload = { reason };
      if (hasAccountId) payload.accountId = accountId;
      if (hasEmail) payload.email = email;
      await api.untrustedBorrowers.create(payload);
      setShowCreate(false);
      setInfo('Untrusted borrower added.');
      await fetchRows();
    } catch (err) {
      setError(err?.message || 'Failed to add untrusted borrower');
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!selected?.id) return;
    const accountId = Number(draft.accountId);
    const reason = String(draft.reason || '').trim();
    if (!Number.isFinite(accountId) || accountId <= 0) {
      setError('Valid account ID is required');
      return;
    }
    if (!reason) {
      setError('Reason is required');
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.untrustedBorrowers.update(selected.id, { accountId, reason });
      setShowEdit(false);
      setInfo(`Untrusted borrower ${selected.id} updated.`);
      await fetchRows();
    } catch (err) {
      setError(err?.message || 'Failed to update untrusted borrower');
    } finally {
      setSaving(false);
    }
  };

  const submitDelete = async () => {
    if (!confirmDelete?.id) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.untrustedBorrowers.remove(confirmDelete.id);
      setConfirmDelete(null);
      setInfo(`Untrusted borrower ${confirmDelete.id} removed.`);
      await fetchRows();
    } catch (err) {
      setError(err?.message || 'Failed to remove untrusted borrower');
    } finally {
      setSaving(false);
    }
  };

  const submitRemoveByEmail = async () => {
    const email = normalizeEmail(removeEmailInput);
    if (!email) {
      setError('Email is required for remove-by-email');
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.untrustedBorrowers.removeByEmail(email);
      setInfo(`Remove by email completed for ${email}.`);
      await fetchRows();
      setRemoveEmailInput('');
    } catch (err) {
      setError(err?.message || 'Failed to remove by email');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>Untrusted Borrowers</div>
          <div style={{ color: 'var(--muted)' }}>Manage borrowers flagged as untrusted for loan eligibility policy.</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-neutral" onClick={fetchRows} disabled={loading || saving}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="btn-success" onClick={openCreate} disabled={saving}>
            Add untrusted borrower
          </button>
          <Link href="/dashboard/loans" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
            ← Loans
          </Link>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label htmlFor="page">Page</label>
            <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <label htmlFor="size">Size</label>
            <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '260px', flex: 1 }}>
            <label htmlFor="emailFilter">Email filter (exact)</label>
            <input id="emailFilter" value={emailInput} placeholder="user@mail.com" onChange={(e) => setEmailInput(e.target.value)} />
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setPage(0);
              setAppliedEmail(normalizeEmail(emailInput));
            }}
            disabled={loading}
          >
            Apply filter
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

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '260px', flex: 1 }}>
            <label htmlFor="removeEmail">Remove by email</label>
            <input id="removeEmail" value={removeEmailInput} placeholder="user@mail.com" onChange={(e) => setRemoveEmailInput(e.target.value)} />
          </div>
          <button type="button" className="btn-danger" onClick={submitRemoveByEmail} disabled={saving}>
            {saving ? 'Removing…' : 'Remove by email'}
          </button>
        </div>
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
        emptyLabel={loading ? 'Loading…' : 'No untrusted borrowers found'}
      />

      {showCreate && (
        <Modal title="Add untrusted borrower" onClose={() => (!saving ? setShowCreate(false) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label htmlFor="createAccountId">Account ID</label>
              <input id="createAccountId" type="number" min="1" value={draft.accountId} onChange={(e) => setDraft((prev) => ({ ...prev, accountId: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label htmlFor="createEmail">Email</label>
              <input
                id="createEmail"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="user@example.com"
              />
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Use account ID or email. If both are provided, account ID is used first.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label htmlFor="createReason">Reason</label>
              <textarea id="createReason" value={draft.reason} onChange={(e) => setDraft((prev) => ({ ...prev, reason: e.target.value }))} rows={3} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setShowCreate(false)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn-success" onClick={submitCreate} disabled={saving}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit untrusted borrower ${selected?.id || ''}`} onClose={() => (!saving ? setShowEdit(false) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label htmlFor="editAccountId">Account ID</label>
              <input id="editAccountId" type="number" min="1" value={draft.accountId} onChange={(e) => setDraft((prev) => ({ ...prev, accountId: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <label htmlFor="editReason">Reason</label>
              <textarea id="editReason" value={draft.reason} onChange={(e) => setDraft((prev) => ({ ...prev, reason: e.target.value }))} rows={3} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setShowEdit(false)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={submitEdit} disabled={saving}>
                {saving ? 'Updating…' : 'Save changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDetails && (
        <Modal title={`Untrusted borrower ${selected?.id || ''}`} onClose={() => setShowDetails(false)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {detailsLoading ? (
              <div style={{ color: 'var(--muted)' }}>Loading details…</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.6rem' }}>
                  <div><strong>ID:</strong> {selected?.id ?? '—'}</div>
                  <div><strong>Account ID:</strong> {selected?.accountId ?? '—'}</div>
                  <div><strong>Name:</strong> {fullName(selected) || '—'}</div>
                  <div><strong>Email:</strong> {selected?.email || '—'}</div>
                  <div><strong>Phone:</strong> {selected?.phoneNumber || '—'}</div>
                  <div><strong>Created:</strong> {formatDateTime(selected?.createdAt)}</div>
                  <div><strong>Updated:</strong> {formatDateTime(selected?.updatedAt)}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>Reason</div>
                  <div style={{ color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>{selected?.reason || '—'}</div>
                </div>
              </>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setShowDetails(false)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Remove untrusted borrower" onClose={() => (!saving ? setConfirmDelete(null) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)' }}>
              Remove entry <strong>{confirmDelete.id}</strong> for <strong>{fullName(confirmDelete) || confirmDelete.email || `account ${confirmDelete.accountId}`}</strong>?
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setConfirmDelete(null)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={submitDelete} disabled={saving}>
                {saving ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
