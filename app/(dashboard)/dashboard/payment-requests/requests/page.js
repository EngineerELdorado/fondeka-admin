'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  accountId: '',
  type: '',
  title: '',
  description: '',
  amount: '',
  minAmount: '',
  maxAmount: '',
  goalAmount: '',
  currency: '',
  allowPartial: false,
  showRecentPaymentsPublicly: false,
  feeInclusion: '',
  approvalStatus: '',
  lifecycle: '',
  activationAt: '',
  expiresAt: '',
  payerFields: []
};

const typeOptions = ['QUICK_CHARGE', 'DONATION', 'INVOICE'];
const approvalStatusOptions = ['PENDING', 'APPROVED', 'REJECTED'];
const lifecycleOptions = ['DRAFT', 'NEW', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'COMPLETED'];
const feeInclusionOptions = ['ON_TOP', 'ABSORBED'];
const recomputeEligibleTypes = new Set(['INVOICE', 'QUICK_CHARGE']);
const emptyPayerField = { label: '', required: false, key: '' };

const normalizePayerFields = (source) => {
  const list = Array.isArray(source?.payerFields) ? source.payerFields : Array.isArray(source?.payer_fields) ? source.payer_fields : [];
  return list.map((field) => ({
    label: field?.label ?? '',
    required: Boolean(field?.required),
    key: field?.key ?? ''
  }));
};

const toPayerFieldsPayload = (fields) => {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((field) => ({
      label: String(field?.label || '').trim(),
      required: Boolean(field?.required),
      key: String(field?.key || '').trim()
    }))
    .filter((field) => field.label)
    .map((field) => ({
      label: field.label,
      required: field.required,
      ...(field.key ? { key: field.key } : {})
    }));
};

const initialFilters = {
  id: '',
  accountId: '',
  linkCode: '',
  email: '',
  phoneNumber: '',
  titleContains: '',
  descriptionContains: '',
  type: '',
  approvalStatus: '',
  lifecycle: '',
  currency: '',
  amountGte: '',
  amountLte: '',
  minAmountGte: '',
  minAmountLte: '',
  maxAmountGte: '',
  maxAmountLte: '',
  activationAfter: '',
  activationBefore: '',
  expiresAfter: '',
  expiresBefore: ''
};

const toPayload = (state) => ({
  accountId: Number(state.accountId) || 0,
  type: state.type,
  title: state.title || null,
  description: state.description || null,
  amount: state.amount === '' ? null : Number(state.amount),
  minAmount: state.minAmount === '' ? null : Number(state.minAmount),
  maxAmount: state.maxAmount === '' ? null : Number(state.maxAmount),
  goalAmount: state.goalAmount === '' ? null : Number(state.goalAmount),
  currency: state.currency,
  allowPartial: Boolean(state.allowPartial),
  showRecentPaymentsPublicly: Boolean(state.showRecentPaymentsPublicly),
  feeInclusion: state.feeInclusion || null,
  approvalStatus: state.approvalStatus || null,
  lifecycle: state.lifecycle || null,
  activationAt: state.activationAt || null,
  expiresAt: state.expiresAt || null,
  payerFields: toPayerFieldsPayload(state.payerFields)
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

const FilterChip = ({ label, onClear }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.35rem',
      padding: '0.35rem 0.6rem',
      background: 'var(--muted-bg, #f3f4f6)',
      borderRadius: '999px',
      fontSize: '13px',
      color: 'var(--text)'
    }}
  >
    {label}
    <button
      type="button"
      onClick={onClear}
      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}
      aria-label={`Clear ${label}`}
    >
      ×
    </button>
  </span>
);

const Badge = ({ children, tone = 'neutral' }) => {
  const palette =
    tone === 'success'
      ? { bg: '#ECFDF3', fg: '#15803D' }
      : tone === 'info'
        ? { bg: '#EFF6FF', fg: '#1D4ED8' }
        : tone === 'danger'
          ? { bg: '#FEF2F2', fg: '#B91C1C' }
          : { bg: '#E5E7EB', fg: '#374151' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.55rem',
        borderRadius: '999px',
        background: palette.bg,
        color: palette.fg,
        fontSize: '12px',
        fontWeight: 700
      }}
    >
      {children || '—'}
    </span>
  );
};

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

export default function PaymentRequestsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [savingApprovalId, setSavingApprovalId] = useState(null);
  const [recomputingLifecycleId, setRecomputingLifecycleId] = useState(null);
  const [showPayerFieldAdvanced, setShowPayerFieldAdvanced] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const addIf = (key, value) => {
        if (value === '' || value === null || value === undefined) return;
        params.set(key, String(value));
      };
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        if (['id', 'accountId'].includes(key)) {
          const num = Number(value);
          if (!Number.isNaN(num)) addIf(key, num);
        } else if (
          ['amountGte', 'amountLte', 'minAmountGte', 'minAmountLte', 'maxAmountGte', 'maxAmountLte'].includes(key)
        ) {
          const num = Number(value);
          if (!Number.isNaN(num)) addIf(key, num);
        } else if (['activationAfter', 'activationBefore', 'expiresAfter', 'expiresBefore'].includes(key)) {
          const ts = Date.parse(value);
          if (!Number.isNaN(ts)) addIf(key, ts);
        } else {
          addIf(key, value);
        }
      });
      const res = await api.paymentRequests.list(params);
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
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => {
    setPage(0);
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(0);
  };

  const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const handleApprove = async (row) => {
    if (!row?.id) return;
    setError(null);
    setInfo(null);
    setSavingApprovalId(row.id);
    try {
      await api.paymentRequests.update(row.id, {
        accountId: row.accountId,
        type: row.type,
        currency: row.currency,
        approvalStatus: 'APPROVED'
      });
      setInfo(`Approved donation request ${row.id}.`);
      fetchRows();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingApprovalId(null);
    }
  };

  const canRecomputeLifecycle = (row) =>
    row?.lifecycle === 'ACTIVE' && recomputeEligibleTypes.has(row?.type);

  const handleRecomputeLifecycle = async (row) => {
    if (!row?.id || !canRecomputeLifecycle(row)) return;
    setError(null);
    setInfo(null);
    setRecomputingLifecycleId(row.id);
    try {
      const res = await api.paymentRequests.recomputeLifecycle(row.id);
      if (res?.changed) {
        const previous = res?.previousLifecycle || row.lifecycle || 'UNKNOWN';
        const next = res?.lifecycle || previous;
        setInfo(`Lifecycle updated: ${previous} -> ${next}`);
      } else {
        setInfo('No lifecycle change needed');
      }
      await fetchRows();
    } catch (err) {
      setError(err.message);
    } finally {
      setRecomputingLifecycleId(null);
    }
  };

  const columns = [
    {
      key: 'userName',
      label: 'Requester',
      render: (row) => {
        const label = row.userName || '—';
        const accountId = row?.accountId;
        if (accountId === null || accountId === undefined || String(accountId).trim() === '') return label;
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <span>{label}</span>
            <Link
              href={`/dashboard/accounts/accounts/${encodeURIComponent(String(accountId).trim())}`}
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
    { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Amount' },
    { key: 'totalCollected', label: 'Collected' },
    { key: 'currency', label: 'Currency' },
    {
      key: 'showRecentPaymentsPublicly',
      label: 'Recent payers visibility',
      render: (row) => (row.showRecentPaymentsPublicly ? <Badge tone="success">Public</Badge> : <Badge>Private</Badge>)
    },
    {
      key: 'payerFields',
      label: 'Payer fields',
      render: (row) => {
        const count = normalizePayerFields(row).length;
        return count > 0 ? <Badge tone="info">{count}</Badge> : '—';
      }
    },
    {
      key: 'approvalStatus',
      label: 'Approval',
      render: (row) => <Badge tone="info">{row.approvalStatus}</Badge>
    },
    {
      key: 'lifecycle',
      label: 'Lifecycle',
      render: (row) => <Badge tone="success">{row.lifecycle}</Badge>
    },
    { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
    { key: 'linkCode', label: 'Link code' },
    {
      key: 'timing',
      label: 'Activation / Expiry',
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span>{formatDateTime(row.activationAt)}</span>
          <span style={{ color: 'var(--muted)' }}>{formatDateTime(row.expiresAt)}</span>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {row.approvalStatus === 'PENDING' && row.type === 'DONATION' && (
            <button
              type="button"
              onClick={() => handleApprove(row)}
              className="btn-success"
              disabled={savingApprovalId === row.id}
            >
              {savingApprovalId === row.id ? 'Approving…' : 'Approve'}
            </button>
          )}
          {canRecomputeLifecycle(row) && (
            <button
              type="button"
              onClick={() => handleRecomputeLifecycle(row)}
              className="btn-primary"
              disabled={recomputingLifecycleId === row.id}
            >
              {recomputingLifecycleId === row.id ? 'Recomputing…' : 'Recompute Lifecycle'}
            </button>
          )}
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral">View</button>
          <button type="button" onClick={() => openEdit(row)} className="btn-neutral">Edit</button>
          <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger">Delete</button>
        </div>
      )
    }
  ];

  const openCreate = () => {
    setDraft(emptyState);
    setShowPayerFieldAdvanced(false);
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = (row) => {
    const payerFields = normalizePayerFields(row);
    setSelected(row);
    setDraft({
      accountId: row.accountId ?? '',
      type: row.type ?? '',
      title: row.title ?? '',
      description: row.description ?? '',
      amount: row.amount ?? '',
      minAmount: row.minAmount ?? '',
      maxAmount: row.maxAmount ?? '',
      goalAmount: row.goalAmount ?? '',
      currency: row.currency ?? '',
      allowPartial: Boolean(row.allowPartial),
      showRecentPaymentsPublicly: Boolean(row.showRecentPaymentsPublicly),
      feeInclusion: row.feeInclusion ?? '',
      approvalStatus: row.approvalStatus ?? '',
      lifecycle: row.lifecycle ?? '',
      activationAt: row.activationAt ?? '',
      expiresAt: row.expiresAt ?? '',
      payerFields
    });
    setShowPayerFieldAdvanced(payerFields.some((field) => Boolean(field.key)));
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

  const handleCreate = async () => {
    setError(null);
    setInfo(null);
    try {
      const created = await api.paymentRequests.create(toPayload(draft));
      let refreshed = created || null;
      if (created?.id) {
        try {
          refreshed = await api.paymentRequests.get(created.id);
        } catch {
          refreshed = created;
        }
      }
      setInfo('Created payment request.');
      setShowCreate(false);
      if (refreshed) {
        setSelected(refreshed);
        setShowDetail(true);
      }
      await fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    setError(null);
    setInfo(null);
    try {
      await api.paymentRequests.update(selected.id, toPayload(draft));
      setInfo(`Updated payment request ${selected.id}.`);
      setShowEdit(false);
      try {
        const refreshed = await api.paymentRequests.get(selected.id);
        setSelected(refreshed || null);
        setShowDetail(true);
      } catch {
        setSelected((prev) => prev || null);
      }
      await fetchRows();
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
      await api.paymentRequests.remove(id);
      setInfo(`Deleted payment request ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const addPayerFieldRow = () => {
    setDraft((prev) => ({
      ...prev,
      payerFields: [...(Array.isArray(prev.payerFields) ? prev.payerFields : []), { ...emptyPayerField }]
    }));
  };

  const updatePayerFieldRow = (index, patch) => {
    setDraft((prev) => {
      const next = Array.isArray(prev.payerFields) ? [...prev.payerFields] : [];
      next[index] = { ...(next[index] || emptyPayerField), ...patch };
      return { ...prev, payerFields: next };
    });
  };

  const removePayerFieldRow = (index) => {
    setDraft((prev) => ({
      ...prev,
      payerFields: (Array.isArray(prev.payerFields) ? prev.payerFields : []).filter((_, idx) => idx !== index)
    }));
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="accountId">Account ID</label>
        <input id="accountId" type="number" value={draft.accountId} onChange={(e) => setDraft((p) => ({ ...p, accountId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="type">Type</label>
        <select id="type" value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))}>
          <option value="">Select type</option>
          {typeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="title">Title</label>
        <input id="title" value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="description">Description</label>
        <input id="description" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="amount">Amount</label>
        <input id="amount" type="number" value={draft.amount} onChange={(e) => setDraft((p) => ({ ...p, amount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="minAmount">Min amount</label>
        <input id="minAmount" type="number" value={draft.minAmount} onChange={(e) => setDraft((p) => ({ ...p, minAmount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="maxAmount">Max amount</label>
        <input id="maxAmount" type="number" value={draft.maxAmount} onChange={(e) => setDraft((p) => ({ ...p, maxAmount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="goalAmount">Goal amount</label>
        <input id="goalAmount" type="number" value={draft.goalAmount} onChange={(e) => setDraft((p) => ({ ...p, goalAmount: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="currency">Currency</label>
        <input id="currency" value={draft.currency} onChange={(e) => setDraft((p) => ({ ...p, currency: e.target.value }))} />
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '0.6rem', padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <div style={{ fontWeight: 700 }}>Public display settings</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input id="allowPartial" type="checkbox" checked={draft.allowPartial} onChange={(e) => setDraft((p) => ({ ...p, allowPartial: e.target.checked }))} />
          <label htmlFor="allowPartial">Allow partial</label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            id="showRecentPaymentsPublicly"
            type="checkbox"
            checked={draft.showRecentPaymentsPublicly}
            onChange={(e) => setDraft((p) => ({ ...p, showRecentPaymentsPublicly: e.target.checked }))}
          />
          <label htmlFor="showRecentPaymentsPublicly">Show recent payers publicly</label>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Field key: <code>showRecentPaymentsPublicly</code>. Recommended: keep this off unless payer visibility is explicitly required.
        </div>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '0.6rem', padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700 }}>Extra payer fields</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn-neutral btn-sm" onClick={() => setShowPayerFieldAdvanced((prev) => !prev)}>
              {showPayerFieldAdvanced ? 'Hide advanced key' : 'Show advanced key'}
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={addPayerFieldRow}>
              Add field
            </button>
          </div>
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          Default UI uses label + required. Optional key is for advanced control; backend will auto-generate and uniquify keys when missing.
        </div>
        {(Array.isArray(draft.payerFields) ? draft.payerFields : []).length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: '13px' }}>No extra payer fields configured.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.55rem' }}>
            {(Array.isArray(draft.payerFields) ? draft.payerFields : []).map((field, index) => (
              <div
                key={`${field?.key || 'new'}-${index}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: showPayerFieldAdvanced ? 'minmax(200px, 2fr) minmax(160px, 1.2fr) auto auto' : 'minmax(220px, 1fr) auto auto',
                  gap: '0.55rem',
                  alignItems: 'end'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor={`payer-field-label-${index}`}>Label</label>
                  <input
                    id={`payer-field-label-${index}`}
                    value={field?.label || ''}
                    onChange={(e) => updatePayerFieldRow(index, { label: e.target.value })}
                    placeholder="Student ID"
                  />
                </div>
                {showPayerFieldAdvanced && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label htmlFor={`payer-field-key-${index}`}>Key (optional)</label>
                    <input
                      id={`payer-field-key-${index}`}
                      value={field?.key || ''}
                      onChange={(e) => updatePayerFieldRow(index, { key: e.target.value })}
                      placeholder="student_id"
                    />
                  </div>
                )}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(field?.required)}
                    onChange={(e) => updatePayerFieldRow(index, { required: e.target.checked })}
                  />
                  Required
                </label>
                <button type="button" className="btn-danger btn-sm" onClick={() => removePayerFieldRow(index)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="feeInclusion">Fee inclusion</label>
        <select id="feeInclusion" value={draft.feeInclusion} onChange={(e) => setDraft((p) => ({ ...p, feeInclusion: e.target.value }))}>
          <option value="">Select</option>
          {feeInclusionOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="approvalStatus">Approval</label>
        <select id="approvalStatus" value={draft.approvalStatus} onChange={(e) => setDraft((p) => ({ ...p, approvalStatus: e.target.value }))}>
          <option value="">Select</option>
          {approvalStatusOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="lifecycle">Lifecycle</label>
        <select id="lifecycle" value={draft.lifecycle} onChange={(e) => setDraft((p) => ({ ...p, lifecycle: e.target.value }))}>
          <option value="">Select</option>
          {lifecycleOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="activationAt">Activation at</label>
        <input id="activationAt" value={draft.activationAt} onChange={(e) => setDraft((p) => ({ ...p, activationAt: e.target.value }))} placeholder="Timestamp" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="expiresAt">Expires at</label>
        <input id="expiresAt" value={draft.expiresAt} onChange={(e) => setDraft((p) => ({ ...p, expiresAt: e.target.value }))} placeholder="Timestamp" />
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Payment Requests</div>
          <div style={{ color: 'var(--muted)' }}>Create and manage payment requests.</div>
        </div>
        <Link href="/dashboard/payment-requests" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Payment Requests hub
        </Link>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontWeight: 700 }}>Search & Filters</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-neutral btn-sm"
              onClick={() => {
                const next = { ...initialFilters, type: 'DONATION', approvalStatus: 'PENDING' };
                setFilters(next);
                setAppliedFilters(next);
                setPage(0);
              }}
            >
              Pending donations
            </button>
            <button type="button" className="btn-neutral btn-sm" onClick={() => setShowFilters((prev) => !prev)}>
              {showFilters ? 'Hide filters' : 'Show filters'}
            </button>
            <button type="button" onClick={fetchRows} disabled={loading} className="btn-neutral btn-sm">
              Refresh
            </button>
          </div>
        </div>
        {showFilters && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-id">ID</label>
            <input id="f-id" type="number" value={filters.id} onChange={(e) => setFilters((p) => ({ ...p, id: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-accountId">Account ID</label>
            <input id="f-accountId" type="number" value={filters.accountId} onChange={(e) => setFilters((p) => ({ ...p, accountId: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-linkCode">Link code</label>
            <input id="f-linkCode" value={filters.linkCode} onChange={(e) => setFilters((p) => ({ ...p, linkCode: e.target.value }))} placeholder="PR-ABC123" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-email">Payer email</label>
            <input id="f-email" value={filters.email} onChange={(e) => setFilters((p) => ({ ...p, email: e.target.value }))} placeholder="owner@example.com" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-phoneNumber">Payer phone</label>
            <input id="f-phoneNumber" value={filters.phoneNumber} onChange={(e) => setFilters((p) => ({ ...p, phoneNumber: e.target.value }))} placeholder="+243..." />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-titleContains">Title contains</label>
            <input id="f-titleContains" value={filters.titleContains} onChange={(e) => setFilters((p) => ({ ...p, titleContains: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-descriptionContains">Description contains</label>
            <input id="f-descriptionContains" value={filters.descriptionContains} onChange={(e) => setFilters((p) => ({ ...p, descriptionContains: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-type">Type</label>
            <select id="f-type" value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))}>
              <option value="">Any</option>
              {typeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-approvalStatus">Approval status</label>
            <select id="f-approvalStatus" value={filters.approvalStatus} onChange={(e) => setFilters((p) => ({ ...p, approvalStatus: e.target.value }))}>
              <option value="">Any</option>
              {approvalStatusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-lifecycle">Lifecycle</label>
            <select id="f-lifecycle" value={filters.lifecycle} onChange={(e) => setFilters((p) => ({ ...p, lifecycle: e.target.value }))}>
              <option value="">Any</option>
              {lifecycleOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-currency">Currency</label>
            <input id="f-currency" value={filters.currency} onChange={(e) => setFilters((p) => ({ ...p, currency: e.target.value }))} placeholder="USD" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.65rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-amountGte">Amount ≥</label>
            <input id="f-amountGte" type="number" value={filters.amountGte} onChange={(e) => setFilters((p) => ({ ...p, amountGte: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-amountLte">Amount ≤</label>
            <input id="f-amountLte" type="number" value={filters.amountLte} onChange={(e) => setFilters((p) => ({ ...p, amountLte: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-minAmountGte">Min amount ≥</label>
            <input id="f-minAmountGte" type="number" value={filters.minAmountGte} onChange={(e) => setFilters((p) => ({ ...p, minAmountGte: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-minAmountLte">Min amount ≤</label>
            <input id="f-minAmountLte" type="number" value={filters.minAmountLte} onChange={(e) => setFilters((p) => ({ ...p, minAmountLte: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-maxAmountGte">Max amount ≥</label>
            <input id="f-maxAmountGte" type="number" value={filters.maxAmountGte} onChange={(e) => setFilters((p) => ({ ...p, maxAmountGte: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-maxAmountLte">Max amount ≤</label>
            <input id="f-maxAmountLte" type="number" value={filters.maxAmountLte} onChange={(e) => setFilters((p) => ({ ...p, maxAmountLte: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-activationAfter">Activation after</label>
            <input id="f-activationAfter" type="datetime-local" value={filters.activationAfter} onChange={(e) => setFilters((p) => ({ ...p, activationAfter: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-activationBefore">Activation before</label>
            <input id="f-activationBefore" type="datetime-local" value={filters.activationBefore} onChange={(e) => setFilters((p) => ({ ...p, activationBefore: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-expiresAfter">Expires after</label>
            <input id="f-expiresAfter" type="datetime-local" value={filters.expiresAfter} onChange={(e) => setFilters((p) => ({ ...p, expiresAfter: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="f-expiresBefore">Expires before</label>
            <input id="f-expiresBefore" type="datetime-local" value={filters.expiresBefore} onChange={(e) => setFilters((p) => ({ ...p, expiresBefore: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={applyFilters} className="btn-primary" disabled={loading}>
            {loading ? 'Loading…' : 'Apply filters'}
          </button>
          <button type="button" onClick={clearFilters} className="btn-neutral" disabled={loading}>
            Clear
          </button>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label htmlFor="page">Page</label>
            <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
            <label htmlFor="size">Size</label>
            <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          </div>
        </div>
          </>
        )}

        {Object.entries(appliedFilters)
          .filter(([, value]) => value !== '' && value !== null && value !== undefined)
          .length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {Object.entries(appliedFilters)
                .filter(([, value]) => value !== '' && value !== null && value !== undefined)
                .map(([key, value]) => (
                  <FilterChip
                    key={key}
                    label={`${key}=${value}`}
                    onClear={() => {
                      setFilters((p) => ({ ...p, [key]: '' }));
                      setAppliedFilters((p) => ({ ...p, [key]: '' }));
                    }}
                  />
                ))}
            </div>
          )}
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={openCreate} className="btn-success">
          Add payment request
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={size}
        onPageChange={setPage}
        emptyLabel="No payment requests found"
        showAccountQuickNav={false}
      />

      {showCreate && (
        <Modal title="Add payment request" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div className="modal-actions">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit payment request ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div className="modal-actions">
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleUpdate} className="btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Details ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <DetailGrid
              rows={[
                { label: 'ID', value: selected?.id },
                { label: 'Account ID', value: selected?.accountId },
                { label: 'Requester', value: selected?.userName },
                { label: 'Email', value: selected?.email },
                { label: 'Phone', value: selected?.phone },
                { label: 'Link code', value: selected?.linkCode },
                { label: 'Type', value: selected?.type },
                { label: 'Title', value: selected?.title },
                { label: 'Description', value: selected?.description },
                { label: 'Amount', value: selected?.amount },
                { label: 'Total collected', value: selected?.totalCollected },
                { label: 'Min amount', value: selected?.minAmount },
                { label: 'Max amount', value: selected?.maxAmount },
                { label: 'Goal amount', value: selected?.goalAmount },
                { label: 'Currency', value: selected?.currency },
                { label: 'Allow partial', value: String(selected?.allowPartial) },
                { label: 'Recent payers visibility', value: selected?.showRecentPaymentsPublicly ? 'Public' : 'Private' },
                { label: 'Fee inclusion', value: selected?.feeInclusion },
                { label: 'Approval status', value: selected?.approvalStatus },
                { label: 'Lifecycle', value: selected?.lifecycle },
                { label: 'Activation at', value: formatDateTime(selected?.activationAt) },
                { label: 'Expires at', value: formatDateTime(selected?.expiresAt) },
                { label: 'Created at', value: formatDateTime(selected?.createdAt) }
              ]}
            />
            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '0.65rem', display: 'grid', gap: '0.5rem' }}>
              <div style={{ fontWeight: 700 }}>Extra payer fields (resolved)</div>
              {normalizePayerFields(selected).length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>No extra payer fields configured.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '420px' }}>
                    <thead>
                      <tr>
                        {['Key', 'Label', 'Required'].map((header) => (
                          <th key={header} style={{ textAlign: 'left', padding: '0.45rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {normalizePayerFields(selected).map((field, index) => (
                        <tr key={`${field.key || field.label || 'field'}-${index}`} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.45rem' }}>
                            <code>{field.key || '—'}</code>
                          </td>
                          <td style={{ padding: '0.45rem' }}>{field.label || '—'}</td>
                          <td style={{ padding: '0.45rem' }}>{field.required ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete payment request <strong>{confirmDelete.title || confirmDelete.id}</strong>? This cannot be undone.
          </div>
          <div className="modal-actions">
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
