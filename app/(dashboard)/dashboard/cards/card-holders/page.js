'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { useAuth } from '@/contexts/AuthContext';

const emptyState = { internalReference: '', externalReference: '', accountId: '', verified: false, metaData: '' };
const emptyFilters = { accountReference: '', email: '', phoneNumber: '' };
const cardStatusOptions = ['IN_PREPARATION', 'ACTIVE', 'FAILED', 'BLOCKED_BY_USER', 'BLOCKED_BY_ADMIN', 'BLOCKED_BY_PROVIDER'];
const emptyReconcileDraft = {
  internalReference: '',
  name: '',
  externalReference: '',
  status: 'ACTIVE',
  last4: '',
  issued: true,
  cardProductCardProviderId: ''
};
const emptyIssueDraft = {
  accountMode: 'id',
  accountId: '',
  accountReference: '',
  accountEmail: '',
  cardProductId: '',
  cardProductCardProviderId: '',
  chargeAccount: false,
  internalFeeAmount: '',
  commissionAmount: '',
  grossAmount: ''
};

const toPayload = (state) => ({
  internalReference: state.internalReference,
  externalReference: state.externalReference || null,
  accountId: Number(state.accountId) || 0,
  verified: Boolean(state.verified),
  metaData: state.metaData || null
});

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

const DetailGrid = ({ rows }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
    {rows.map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700 }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>
);

export default function CardHoldersPage() {
  const { session } = useAuth();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmReset, setConfirmReset] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [showReconcile, setShowReconcile] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [reconcileDraft, setReconcileDraft] = useState(emptyReconcileDraft);
  const [issueDraft, setIssueDraft] = useState(emptyIssueDraft);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);
  const [mappingOptions, setMappingOptions] = useState([]);
  const [mappingLoading, setMappingLoading] = useState(false);

  const isSuperAdmin = useMemo(() => {
    const payload = session?.tokens?.idToken?.payload || session?.tokens?.accessToken?.payload;
    const role = payload?.role || payload?.['custom:role'];
    if (role && String(role).toUpperCase() === 'SUPER_ADMIN') return true;
    const groups = payload?.['cognito:groups'] || payload?.groups;
    if (Array.isArray(groups)) {
      return groups.some((group) => String(group).toUpperCase() === 'SUPER_ADMIN');
    }
    if (typeof groups === 'string') {
      return groups.split(',').some((group) => String(group).trim().toUpperCase() === 'SUPER_ADMIN');
    }
    return false;
  }, [session]);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      Object.entries(filters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        params.set(key, String(value));
      });
      const res = await api.cardHolders.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'internalReference', label: 'Internal ref' },
    { key: 'userName', label: 'User name' },
    { key: 'userEmail', label: 'User email' },
    { key: 'accountId', label: 'Account ID' },
    { key: 'verified', label: 'Verified' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral">View</button>
          <button type="button" onClick={() => openEdit(row)} className="btn-neutral">Edit</button>
          <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger">Delete</button>
        </div>
      )
    }
  ], []);

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      internalReference: row.internalReference ?? '',
      externalReference: row.externalReference ?? '',
      accountId: row.accountId ?? '',
      verified: Boolean(row.verified),
      metaData: row.metaData ?? ''
    });
    setShowEdit(true);
    setInfo(null);
    setError(null);
  };

  const openDetail = (row) => {
    setSelected(row);
    setShowDetail(true);
    setInfo(null);
    setError(null);
  };

  const loadCardProductProviderMappings = async () => {
    setMappingLoading(true);
    try {
      const res = await api.cardProductCardProviders.list(new URLSearchParams({ page: '0', size: '200' }));
      const list = Array.isArray(res) ? res : res?.content || [];
      setMappingOptions(list || []);
    } catch {
      setMappingOptions([]);
    } finally {
      setMappingLoading(false);
    }
  };


  const openReconcile = async (row) => {
    if (!row?.id) return;
    const nextName = String(row?.userName || '').trim();
    const nextInternalRef = String(row?.internalReference || '').trim();
    setReconcileDraft({
      ...emptyReconcileDraft,
      internalReference: nextInternalRef ? `${nextInternalRef}-CARD` : '',
      name: nextName ? `${nextName} Card` : ''
    });
    setShowReconcile(true);
    await loadCardProductProviderMappings();
  };

  const openIssue = async (row) => {
    if (!row?.id) return;
    setIssueDraft({
      ...emptyIssueDraft,
      accountMode: row.accountId ? 'id' : row.accountReference ? 'reference' : row.userEmail ? 'email' : 'id',
      accountId: row.accountId ? String(row.accountId) : '',
      accountReference: row.accountReference || '',
      accountEmail: row.userEmail || ''
    });
    setShowIssue(true);
    await loadCardProductProviderMappings();
  };

  const handleCreate = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.cardHolders.create(toPayload(draft));
      setInfo('Created card holder.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    setError(null);
    setInfo(null);
    try {
      await api.cardHolders.update(selected.id, toPayload(draft));
      setInfo(`Updated card holder ${selected.id}.`);
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete?.id) return;
    const id = confirmDelete.id;
    setError(null);
    setInfo(null);
    try {
      await api.cardHolders.remove(id);
      setInfo(`Deleted card holder ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReset = async () => {
    if (!confirmReset?.id) return;
    const id = confirmReset.id;
    setError(null);
    setInfo(null);
    setResetLoading(true);
    try {
      const res = await api.cardHolders.reset(id);
      setSelected(res || null);
      setRows((prev) => prev.map((row) => (row.id === id ? res : row)));
      setInfo(`Reset card holder ${id}.`);
      setConfirmReset(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleReconcile = async () => {
    if (!selected?.id) return;
    const internalReference = String(reconcileDraft.internalReference || '').trim();
    const name = String(reconcileDraft.name || '').trim();
    const status = String(reconcileDraft.status || '').trim();
    const cardProductCardProviderId = Number(reconcileDraft.cardProductCardProviderId);
    if (!internalReference) {
      setError('Internal reference is required.');
      return;
    }
    if (!name) {
      setError('Card name is required.');
      return;
    }
    if (!status) {
      setError('Status is required.');
      return;
    }
    if (!Number.isInteger(cardProductCardProviderId) || cardProductCardProviderId <= 0) {
      setError('Select a valid product/provider mapping.');
      return;
    }
    setError(null);
    setInfo(null);
    setReconcileLoading(true);
    try {
      const payload = {
        internalReference,
        name,
        externalReference: String(reconcileDraft.externalReference || '').trim() || null,
        status,
        last4: String(reconcileDraft.last4 || '').trim() || null,
        cardHolderId: Number(selected.id),
        issued: Boolean(reconcileDraft.issued),
        cardProductCardProviderId
      };
      const res = await api.cards.reconcile(payload);
      setShowReconcile(false);
      setInfo(`Card reconciled locally (ID: ${res?.id ?? 'new'}).`);
    } catch (err) {
      setError(err?.message || 'Failed to reconcile card.');
    } finally {
      setReconcileLoading(false);
    }
  };

  const validateIssueDraft = (state) => {
    const mode = String(state.accountMode || 'id');
    if (mode === 'id') {
      if (!Number.isInteger(Number(state.accountId)) || Number(state.accountId) <= 0) return 'Account ID is required.';
    } else if (mode === 'reference') {
      if (!String(state.accountReference || '').trim()) return 'Account reference is required.';
    } else if (mode === 'email') {
      const email = String(state.accountEmail || '').trim();
      if (!email) return 'Account email is required.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Account email format is invalid.';
    }
    if (!Number.isInteger(Number(state.cardProductId)) || Number(state.cardProductId) <= 0) return 'Card product id is required.';
    const optionalMoneyFields = [
      { key: 'internalFeeAmount', value: state.internalFeeAmount },
      { key: 'commissionAmount', value: state.commissionAmount },
      { key: 'grossAmount', value: state.grossAmount }
    ];
    for (const field of optionalMoneyFields) {
      if (field.value === '' || field.value === null || field.value === undefined) continue;
      if (!Number.isFinite(Number(field.value)) || Number(field.value) < 0) {
        return `${field.key} must be a non-negative number.`;
      }
    }
    return null;
  };

  const toIssuePayload = (state) => {
    const payload = {
      cardProductId: Number(state.cardProductId),
      chargeAccount: Boolean(state.chargeAccount)
    };
    if (Number.isInteger(Number(state.cardProductCardProviderId)) && Number(state.cardProductCardProviderId) > 0) {
      payload.cardProductCardProviderId = Number(state.cardProductCardProviderId);
    }
    if (state.accountMode === 'id') payload.accountId = Number(state.accountId);
    if (state.accountMode === 'reference') payload.accountReference = String(state.accountReference).trim();
    if (state.accountMode === 'email') payload.accountEmail = String(state.accountEmail).trim();
    if (state.internalFeeAmount !== '') payload.internalFeeAmount = Number(state.internalFeeAmount);
    if (state.commissionAmount !== '') payload.commissionAmount = Number(state.commissionAmount);
    if (state.grossAmount !== '') payload.grossAmount = Number(state.grossAmount);
    return payload;
  };

  const handleIssue = async () => {
    const validationError = validateIssueDraft(issueDraft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setInfo(null);
    setIssueLoading(true);
    try {
      const res = await api.cards.issue(toIssuePayload(issueDraft));
      const txId = res?.transactionId || res?.id || null;
      setShowIssue(false);
      setInfo(txId ? `Card issuance submitted. Transaction ID: ${txId}.` : 'Card issuance submitted.');
    } catch (err) {
      setError(err?.message || 'Failed to issue card.');
    } finally {
      setIssueLoading(false);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="internalReference">Internal reference</label>
        <input id="internalReference" value={draft.internalReference} onChange={(e) => setDraft((p) => ({ ...p, internalReference: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="externalReference">External reference</label>
        <input id="externalReference" value={draft.externalReference} onChange={(e) => setDraft((p) => ({ ...p, externalReference: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="accountId">Account ID</label>
        <input id="accountId" type="number" value={draft.accountId} onChange={(e) => setDraft((p) => ({ ...p, accountId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="metaData">Metadata</label>
        <input id="metaData" value={draft.metaData} onChange={(e) => setDraft((p) => ({ ...p, metaData: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="verified" type="checkbox" checked={draft.verified} onChange={(e) => setDraft((p) => ({ ...p, verified: e.target.checked }))} />
        <label htmlFor="verified">Verified</label>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Card Holders</div>
          <div style={{ color: 'var(--muted)' }}>Manage card holders tied to accounts.</div>
        </div>
        <Link href="/dashboard/cards" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Cards hub
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="page">Page</label>
          <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="size">Size</label>
          <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="accountReference">Account reference</label>
          <input
            id="accountReference"
            value={filters.accountReference}
            onChange={(e) => setFilters((p) => ({ ...p, accountReference: e.target.value }))}
            placeholder="ACC-123"
          />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            value={filters.email}
            onChange={(e) => setFilters((p) => ({ ...p, email: e.target.value }))}
            placeholder="john@example.com"
          />
        </div>
        <div>
          <label htmlFor="phoneNumber">Phone number</label>
          <input
            id="phoneNumber"
            value={filters.phoneNumber}
            onChange={(e) => setFilters((p) => ({ ...p, phoneNumber: e.target.value }))}
            placeholder="+243"
          />
        </div>
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button
          type="button"
          onClick={() => {
            setFilters(emptyFilters);
            setPage(0);
          }}
          disabled={loading}
          className="btn-neutral"
        >
          Clear filters
        </button>
        <button type="button" onClick={openCreate} className="btn-success">
          Add card holder
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No card holders found" />

      {showCreate && (
        <Modal title="Add card holder" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit card holder ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleUpdate} className="btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Details ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Internal ref', value: selected?.internalReference },
              { label: 'External ref', value: selected?.externalReference },
              { label: 'Account ID', value: selected?.accountId },
              { label: 'User name', value: selected?.userName },
              { label: 'User email', value: selected?.userEmail },
              { label: 'Verified', value: String(selected?.verified) },
              { label: 'Metadata', value: selected?.metaData }
            ]}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="button" onClick={() => openIssue(selected)} className="btn-success">
              Issue card
            </button>
            <button type="button" onClick={() => openReconcile(selected)} className="btn-primary">
              Reconcile card
            </button>
            {isSuperAdmin && (
              <button type="button" onClick={() => setConfirmReset(selected)} className="btn-danger">
                Reset card holder
              </button>
            )}
          </div>
        </Modal>
      )}

      {showReconcile && (
        <Modal title={`Reconcile card for holder ${selected?.id}`} onClose={() => (!reconcileLoading ? setShowReconcile(false) : null)}>
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
            Restore a provider-side card in local DB without creating it again at provider.
          </div>
          <DetailGrid
            rows={[
              { label: 'Card holder ID', value: selected?.id },
              { label: 'Holder internal ref', value: selected?.internalReference || '—' },
              { label: 'Holder user', value: selected?.userName || selected?.userEmail || '—' }
            ]}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="reconcileInternalReference">Internal reference *</label>
              <input
                id="reconcileInternalReference"
                value={reconcileDraft.internalReference}
                onChange={(e) => setReconcileDraft((p) => ({ ...p, internalReference: e.target.value }))}
                placeholder="CARD-LOCAL-001"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="reconcileName">Card name *</label>
              <input
                id="reconcileName"
                value={reconcileDraft.name}
                onChange={(e) => setReconcileDraft((p) => ({ ...p, name: e.target.value }))}
                placeholder="Virtual Dollar Card"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="reconcileExternalReference">Provider card ID (external ref)</label>
              <input
                id="reconcileExternalReference"
                value={reconcileDraft.externalReference}
                onChange={(e) => setReconcileDraft((p) => ({ ...p, externalReference: e.target.value }))}
                placeholder="bridge_card_id_if_known"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="reconcileLast4">Last 4</label>
              <input
                id="reconcileLast4"
                maxLength={4}
                value={reconcileDraft.last4}
                onChange={(e) => setReconcileDraft((p) => ({ ...p, last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                placeholder="1234"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="reconcileStatus">Status *</label>
              <select id="reconcileStatus" value={reconcileDraft.status} onChange={(e) => setReconcileDraft((p) => ({ ...p, status: e.target.value }))}>
                {cardStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="reconcileMapping">Product/provider mapping *</label>
              <select
                id="reconcileMapping"
                value={reconcileDraft.cardProductCardProviderId}
                onChange={(e) => setReconcileDraft((p) => ({ ...p, cardProductCardProviderId: e.target.value }))}
                disabled={mappingLoading}
              >
                <option value="">{mappingLoading ? 'Loading mappings…' : 'Select mapping'}</option>
                {mappingOptions.map((mapping) => (
                  <option key={mapping.id} value={mapping.id}>
                    #{mapping.id} • product {mapping.cardProductId} • provider {mapping.cardProviderId}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="reconcileIssued"
                type="checkbox"
                checked={reconcileDraft.issued}
                onChange={(e) => setReconcileDraft((p) => ({ ...p, issued: e.target.checked }))}
              />
              <label htmlFor="reconcileIssued">Issued</label>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="button" onClick={() => setShowReconcile(false)} className="btn-neutral" disabled={reconcileLoading}>
              Cancel
            </button>
            <button type="button" onClick={handleReconcile} className="btn-primary" disabled={reconcileLoading}>
              {reconcileLoading ? 'Reconciling…' : 'Reconcile card'}
            </button>
          </div>
        </Modal>
      )}

      {showIssue && (
        <Modal title={`Issue card for holder ${selected?.id}`} onClose={() => (!issueLoading ? setShowIssue(false) : null)}>
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
            Uses normal card-order flow.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="issueAccountMode">Account selector</label>
              <select id="issueAccountMode" value={issueDraft.accountMode} onChange={(e) => setIssueDraft((p) => ({ ...p, accountMode: e.target.value }))}>
                <option value="id">Account ID</option>
                <option value="reference">Account reference</option>
                <option value="email">Account email</option>
              </select>
            </div>
            {issueDraft.accountMode === 'id' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="issueAccountId">Account ID</label>
                <input id="issueAccountId" type="number" min={1} value={issueDraft.accountId} onChange={(e) => setIssueDraft((p) => ({ ...p, accountId: e.target.value }))} />
              </div>
            )}
            {issueDraft.accountMode === 'reference' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="issueAccountReference">Account reference</label>
                <input id="issueAccountReference" value={issueDraft.accountReference} onChange={(e) => setIssueDraft((p) => ({ ...p, accountReference: e.target.value }))} />
              </div>
            )}
            {issueDraft.accountMode === 'email' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="issueAccountEmail">Account email</label>
                <input id="issueAccountEmail" type="email" value={issueDraft.accountEmail} onChange={(e) => setIssueDraft((p) => ({ ...p, accountEmail: e.target.value }))} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="issueMapping">Product/provider mapping (optional)</label>
              <select
                id="issueMapping"
                value={issueDraft.cardProductCardProviderId}
                onChange={(e) => {
                  const mappingId = e.target.value;
                  const mapping = mappingOptions.find((item) => String(item.id) === String(mappingId));
                  setIssueDraft((p) => ({
                    ...p,
                    cardProductCardProviderId: mappingId,
                    cardProductId: mapping?.cardProductId ? String(mapping.cardProductId) : p.cardProductId
                  }));
                }}
                disabled={mappingLoading}
              >
                <option value="">{mappingLoading ? 'Loading mappings…' : 'Select mapping'}</option>
                {mappingOptions.map((mapping) => (
                  <option key={mapping.id} value={mapping.id}>
                    #{mapping.id} • product {mapping.cardProductId} • provider {mapping.cardProviderId}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="issueCardProductId">Card product ID</label>
              <input id="issueCardProductId" type="number" min={1} value={issueDraft.cardProductId} onChange={(e) => setIssueDraft((p) => ({ ...p, cardProductId: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input id="issueChargeAccount" type="checkbox" checked={issueDraft.chargeAccount} onChange={(e) => setIssueDraft((p) => ({ ...p, chargeAccount: e.target.checked }))} />
              <label htmlFor="issueChargeAccount">Charge account balance</label>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
              If enabled, user is charged from FONDEKA balance. If disabled, admin-sponsored issuance.
            </div>
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', color: 'var(--muted)', fontSize: '13px' }}>
              Optional transaction financial overrides (BUY_CARD)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="issueInternalFeeAmount">Internal fee amount (optional)</label>
                <input
                  id="issueInternalFeeAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={issueDraft.internalFeeAmount}
                  onChange={(e) => setIssueDraft((p) => ({ ...p, internalFeeAmount: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="issueCommissionAmount">Commission amount (optional)</label>
                <input
                  id="issueCommissionAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={issueDraft.commissionAmount}
                  onChange={(e) => setIssueDraft((p) => ({ ...p, commissionAmount: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="issueGrossAmount">Gross amount (optional)</label>
                <input
                  id="issueGrossAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={issueDraft.grossAmount}
                  onChange={(e) => setIssueDraft((p) => ({ ...p, grossAmount: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button type="button" onClick={() => setShowIssue(false)} className="btn-neutral" disabled={issueLoading}>
              Cancel
            </button>
            <button type="button" onClick={handleIssue} className="btn-primary" disabled={issueLoading}>
              {issueLoading ? 'Issuing…' : 'Issue card'}
            </button>
          </div>
        </Modal>
      )}

      {confirmReset && (
        <Modal title="Reset card holder" onClose={() => setConfirmReset(null)}>
          <div style={{ color: 'var(--muted)' }}>
            This will unset verification and external reference. Continue?
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmReset(null)} className="btn-neutral" disabled={resetLoading}>
              Cancel
            </button>
            <button type="button" onClick={handleReset} className="btn-danger" disabled={resetLoading}>
              {resetLoading ? 'Resetting…' : 'Reset card holder'}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete card holder <strong>{confirmDelete.internalReference || confirmDelete.id}</strong>? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
