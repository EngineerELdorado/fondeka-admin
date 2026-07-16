'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyFilters = { paymentMethodId: '', accountId: '', email: '' };
const emptyDraft = { accountId: '', email: '', paymentMethodId: '', active: true };

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
          x
        </button>
      </div>
      {children}
    </div>
  </div>
);

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{row.value ?? '-'}</div>
      </div>
    ))}
  </div>
);

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const targetLabel = (row) => {
  if (row?.accountId !== null && row?.accountId !== undefined && String(row.accountId).trim() !== '') return `Account ${row.accountId}`;
  if (row?.email) return row.email;
  return '-';
};

const targetType = (row) => {
  if (row?.accountId !== null && row?.accountId !== undefined && String(row.accountId).trim() !== '') return 'Account';
  if (row?.email) return 'Email';
  return '-';
};

const paymentMethodLabel = (row) => row?.paymentMethodDisplayName || row?.paymentMethodName || row?.paymentMethodId || '-';

export default function PaymentMethodStatusOverridesPage() {
  const [rows, setRows] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      if (String(appliedFilters.paymentMethodId || '').trim()) params.set('paymentMethodId', String(appliedFilters.paymentMethodId).trim());
      if (String(appliedFilters.accountId || '').trim()) params.set('accountId', String(appliedFilters.accountId).trim());
      if (String(appliedFilters.email || '').trim()) params.set('email', String(appliedFilters.email).trim());
      const res = await api.paymentMethodStatusOverrides.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err.message || 'Failed to load payment method status overrides.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const res = await api.paymentMethods.list(new URLSearchParams({ page: '0', size: '300' }));
        const list = Array.isArray(res) ? res : res?.content || [];
        setPaymentMethods(list || []);
      } catch {
        setPaymentMethods([]);
      }
    };
    fetchPaymentMethods();
  }, []);

  const validateDraft = () => {
    const hasAccount = String(draft.accountId || '').trim() !== '';
    const hasEmail = String(draft.email || '').trim() !== '';
    if (!draft.paymentMethodId) return 'Payment method is required.';
    if (hasAccount === hasEmail) return 'Provide exactly one target: account ID or email.';
    if (hasAccount && !Number.isFinite(Number(draft.accountId))) return 'Account ID must be a number.';
    if (hasEmail && !String(draft.email).includes('@')) return 'Email must be valid.';
    return null;
  };

  const buildPayload = () => {
    const payload = {
      paymentMethodId: Number(draft.paymentMethodId),
      active: Boolean(draft.active)
    };
    if (String(draft.accountId || '').trim()) payload.accountId = Number(draft.accountId);
    if (String(draft.email || '').trim()) payload.email = String(draft.email).trim();
    return payload;
  };

  const openCreate = () => {
    setDraft(emptyDraft);
    setSelected(null);
    setError(null);
    setInfo(null);
    setShowCreate(true);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      accountId: row.accountId ?? '',
      email: row.email ?? '',
      paymentMethodId: row.paymentMethodId ?? '',
      active: Boolean(row.active)
    });
    setError(null);
    setInfo(null);
    setShowEdit(true);
  };

  const openDetail = async (row) => {
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.paymentMethodStatusOverrides.get(row.id);
      setSelected(res || row);
      setShowDetail(true);
    } catch (err) {
      setError(err.message || `Failed to load override ${row.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async () => {
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.paymentMethodStatusOverrides.create(buildPayload());
      setInfo('Created payment method status override.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to create payment method status override.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.paymentMethodStatusOverrides.update(selected.id, buildPayload());
      setInfo(`Updated override ${selected.id}.`);
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to update override ${selected.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete?.id) return;
    const id = confirmDelete.id;
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.paymentMethodStatusOverrides.remove(id);
      setInfo(`Deleted override ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to delete override ${id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'targetType', label: 'Target type', render: targetType },
    { key: 'target', label: 'Target', render: targetLabel },
    { key: 'paymentMethod', label: 'Payment method', render: paymentMethodLabel },
    { key: 'active', label: 'Active', render: (row) => (row.active ? 'Yes' : 'No') },
    { key: 'updatedAt', label: 'Updated', hideOnMobile: true, render: (row) => formatDateTime(row.updatedAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral" disabled={actionLoading}>View</button>
          <button type="button" onClick={() => openEdit(row)} className="btn-neutral" disabled={actionLoading}>Edit</button>
          <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger" disabled={actionLoading}>Delete</button>
        </div>
      )
    }
  ], [actionLoading]);

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size : page + 1 < pageMeta.totalPages;

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="paymentMethodId">Payment method</label>
        <select id="paymentMethodId" value={draft.paymentMethodId} onChange={(e) => setDraft((prev) => ({ ...prev, paymentMethodId: e.target.value }))}>
          <option value="">Select method</option>
          {paymentMethods.map((method) => (
            <option key={method.id} value={method.id}>
              {method.displayName || method.name || method.id}{method.currency ? ` (${method.currency})` : ''}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="accountId">Account ID</label>
        <input
          id="accountId"
          type="number"
          value={draft.accountId}
          disabled={String(draft.email || '').trim() !== ''}
          onChange={(e) => setDraft((prev) => ({ ...prev, accountId: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={draft.email}
          disabled={String(draft.accountId || '').trim() !== ''}
          onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
        />
      </div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
        <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((prev) => ({ ...prev, active: e.target.checked }))} />
        Active for target
      </label>
      <div style={{ color: 'var(--muted)', fontSize: '13px', gridColumn: '1 / -1' }}>
        Provide exactly one target. Runtime precedence is account override, then email override, then global payment method active state.
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Payment Method Status Overrides</div>
          <div style={{ color: 'var(--muted)' }}>Override payment method active state for one account or one email.</div>
        </div>
        <Link href="/dashboard/payments" className="btn-neutral">
          {'<- Payments hub'}
        </Link>
      </div>

      <div className="card" style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.5 }}>
        Precedence: account override wins over email override, and email override wins over the global payment method active state.
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="filterPaymentMethodId">Payment method</label>
          <select id="filterPaymentMethodId" value={filters.paymentMethodId} onChange={(e) => setFilters((prev) => ({ ...prev, paymentMethodId: e.target.value }))}>
            <option value="">All methods</option>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.displayName || method.name || method.id}{method.currency ? ` (${method.currency})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filterAccountId">Account ID</label>
          <input id="filterAccountId" type="number" value={filters.accountId} onChange={(e) => setFilters((prev) => ({ ...prev, accountId: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="filterEmail">Email</label>
          <input id="filterEmail" type="email" value={filters.email} onChange={(e) => setFilters((prev) => ({ ...prev, email: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="page">Page</label>
          <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Math.max(0, Number(e.target.value) || 0))} />
        </div>
        <div>
          <label htmlFor="size">Size</label>
          <input id="size" type="number" min={1} value={size} onChange={(e) => { setSize(Math.max(1, Number(e.target.value) || 1)); setPage(0); }} />
        </div>
        <button type="button" onClick={() => { setAppliedFilters(filters); setPage(0); }} disabled={loading} className="btn-primary">
          Apply filters
        </button>
        <button type="button" onClick={() => { setFilters(emptyFilters); setAppliedFilters(emptyFilters); setPage(0); }} disabled={loading} className="btn-neutral">
          Reset
        </button>
        <button type="button" onClick={fetchRows} disabled={loading || actionLoading} className="btn-neutral">
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
        <button type="button" onClick={openCreate} disabled={actionLoading} className="btn-success">
          Add override
        </button>
      </div>

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
        canPrev={canPrev}
        canNext={canNext}
        emptyLabel="No payment method status overrides found"
        showAccountQuickNav={false}
      />

      {showCreate && (
        <Modal title="Add payment method status override" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral" disabled={actionLoading}>Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success" disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Create'}</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit override ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral" disabled={actionLoading}>Cancel</button>
            <button type="button" onClick={handleUpdate} className="btn-primary" disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Save'}</button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Override ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Target type', value: targetType(selected) },
              { label: 'Target', value: targetLabel(selected) },
              { label: 'Payment method', value: paymentMethodLabel(selected) },
              { label: 'Payment method ID', value: selected?.paymentMethodId },
              { label: 'Active', value: selected?.active ? 'Yes' : 'No' },
              { label: 'Created', value: formatDateTime(selected?.createdAt) },
              { label: 'Updated', value: formatDateTime(selected?.updatedAt) }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete override <strong>{confirmDelete.id}</strong> for {targetLabel(confirmDelete)} / {paymentMethodLabel(confirmDelete)}? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral" disabled={actionLoading}>Cancel</button>
            <button type="button" onClick={handleDelete} className="btn-danger" disabled={actionLoading}>{actionLoading ? 'Deleting...' : 'Delete'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
