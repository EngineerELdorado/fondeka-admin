'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const statusOptions = ['IN_PREPARATION', 'ACTIVE', 'FAILED', 'BLOCKED_BY_USER', 'BLOCKED_BY_ADMIN', 'BLOCKED_BY_PROVIDER'];

const emptyState = {
  internalReference: '',
  name: '',
  externalReference: '',
  status: 'IN_PREPARATION',
  last4: '',
  cardHolderId: '',
  accountId: '',
  issued: false,
  cardProductCardProviderId: ''
};

const emptyIssueState = {
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

const emptyFilters = {
  status: '',
  issued: '',
  accountId: '',
  email: '',
  cardHolderId: '',
  internalReference: '',
  externalReference: '',
  name: ''
};

const toPayload = (state) => ({
  internalReference: state.internalReference,
  name: state.name,
  externalReference: state.externalReference || null,
  status: state.status,
  last4: state.last4 || null,
  cardHolderId: Number(state.cardHolderId) || 0,
  accountId: Number(state.accountId) || 0,
  issued: Boolean(state.issued),
  cardProductCardProviderId: Number(state.cardProductCardProviderId) || 0
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

const StatusBadge = ({ value }) => {
  if (!value) return '—';
  const val = String(value).toUpperCase();
  const tone =
    val === 'ACTIVE'
      ? { bg: '#ECFDF3', fg: '#15803D' }
      : val === 'IN_PREPARATION'
        ? { bg: '#EFF6FF', fg: '#1D4ED8' }
        : val === 'FAILED'
          ? { bg: '#FEF2F2', fg: '#B91C1C' }
          : val === 'BLOCKED_BY_ADMIN' || val === 'BLOCKED_BY_USER'
            ? { bg: '#FFF7ED', fg: '#9A3412' }
            : val === 'BLOCKED_BY_PROVIDER'
              ? { bg: '#E5E7EB', fg: '#374151' }
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

const ExpandableText = ({ value, maxLength = 28 }) => {
  const [expanded, setExpanded] = useState(false);
  const text = value === null || value === undefined ? '' : String(value);
  if (!text) return '—';
  if (text.length <= maxLength) return text;
  const short = `${text.slice(0, maxLength)}…`;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
      <span title={text}>{expanded ? text : short}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((prev) => !prev);
        }}
        className="btn-neutral btn-sm"
        style={{ padding: '0.1rem 0.45rem' }}
      >
        {expanded ? 'Show less' : 'Show more'}
      </button>
    </span>
  );
};

export default function CardsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [issueDraft, setIssueDraft] = useState(emptyIssueState);
  const [issueLoading, setIssueLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmBlock, setConfirmBlock] = useState(null);
  const [confirmUnblock, setConfirmUnblock] = useState(null);
  const [cardActionLoading, setCardActionLoading] = useState(false);
  const [providerDetailLoading, setProviderDetailLoading] = useState(false);
  const [providerDetailError, setProviderDetailError] = useState(null);
  const [providerDetailData, setProviderDetailData] = useState(null);
  const [providerTxLoading, setProviderTxLoading] = useState(false);
  const [providerTxError, setProviderTxError] = useState(null);
  const [providerTxData, setProviderTxData] = useState(null);
  const [providerTxPage, setProviderTxPage] = useState('1');
  const [providerTxStartDate, setProviderTxStartDate] = useState('');
  const [providerTxEndDate, setProviderTxEndDate] = useState('');
  const providerTxLastRequestRef = useRef(new Map());

  const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatJson = (value) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };
  const toFiniteNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const formatMoney = (amount, currency) => {
    const num = toFiniteNumber(amount);
    if (num === null) return amount ?? '—';
    const safeCurrency = currency || 'USD';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: safeCurrency,
        maximumFractionDigits: 2
      }).format(num);
    } catch {
      return `${num.toFixed(2)} ${safeCurrency}`.trim();
    }
  };

  const formatMoneyFromCents = (amountInCents, currency) => {
    const num = toFiniteNumber(amountInCents);
    if (num === null) return amountInCents ?? '—';
    return formatMoney(num / 100, currency);
  };

  const formatProviderDateTime = (value) => {
    if (!value) return '—';
    if (typeof value === 'number') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
    }
    const text = String(value).trim();
    if (!text) return '—';
    let parsed = null;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) {
      parsed = new Date(text.replace(' ', 'T') + 'Z');
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(text)) {
      parsed = new Date(text + 'Z');
    } else {
      parsed = new Date(text);
    }
    if (Number.isNaN(parsed.getTime())) return text;
    return parsed.toLocaleString();
  };

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        if (key === 'issued') {
          params.set('issued', String(value));
        } else {
          params.set(key, String(value));
        }
      });
      const res = await api.cards.list(params);
    const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canAdminBlock = (card) => String(card?.status || '').toUpperCase() === 'ACTIVE';
  const canAdminUnblock = (card) => String(card?.status || '').toUpperCase() === 'BLOCKED_BY_ADMIN';

  const syncCardRecord = (card) => {
    if (!card?.id) return;
    setRows((prev) => prev.map((row) => (row?.id === card.id ? { ...row, ...card } : row)));
    setSelected((prev) => (prev?.id === card.id ? { ...prev, ...card } : prev));
    setConfirmBlock((prev) => (prev?.id === card.id ? { ...prev, ...card } : prev));
    setConfirmUnblock((prev) => (prev?.id === card.id ? { ...prev, ...card } : prev));
  };

  useEffect(() => {
    fetchRows();
  }, [page, size, appliedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    {
      key: 'account',
      label: 'Account',
      render: (row) => {
        const accountId = row?.accountId ?? row?.account_id;
        if (accountId === null || accountId === undefined || String(accountId).trim() === '') return '—';
        const accountLabel = `#${accountId}`;
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <span>{accountLabel}</span>
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
    { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
    { key: 'createdAt', label: 'Created', render: (row) => formatDateTime(row.createdAt) },
    { key: 'last4', label: 'Last 4', render: (row) => row.last4 || '—' },
    { key: 'issued', label: 'Issued', render: (row) => (row.issued ? 'Yes' : 'No') },
    { key: 'internalReference', label: 'Internal ref' },
    {
      key: 'externalReference',
      label: 'External ref',
      render: (row) => <ExpandableText value={row.externalReference} maxLength={20} />
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral">View</button>
          <button type="button" onClick={() => openEdit(row)} className="btn-neutral">Edit</button>
          {canAdminUnblock(row) ? (
            <button type="button" onClick={() => setConfirmUnblock(row)} className="btn-success">Unblock</button>
          ) : null}
          {canAdminBlock(row) ? (
            <button type="button" onClick={() => setConfirmBlock(row)} className="btn-danger">Block</button>
          ) : null}
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

  const openIssue = () => {
    setIssueDraft(emptyIssueState);
    setShowIssue(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      internalReference: row.internalReference ?? '',
      name: row.name ?? '',
      externalReference: row.externalReference ?? '',
      status: row.status ?? '',
      last4: row.last4 ?? '',
      cardHolderId: row.cardHolderId ?? '',
      accountId: row.accountId ?? '',
      issued: Boolean(row.issued),
      cardProductCardProviderId: row.cardProductCardProviderId ?? ''
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
    setProviderDetailData(null);
    setProviderDetailError(null);
    setProviderTxData(null);
    setProviderTxError(null);
    setProviderTxPage('1');
    setProviderTxStartDate('');
    setProviderTxEndDate('');
  };

  const loadProviderDetails = async (cardId) => {
    if (!cardId) return;
    setProviderDetailLoading(true);
    setProviderDetailError(null);
    try {
      const [base, live] = await Promise.all([
        api.cards.get(cardId),
        api.cards.providerDetails(cardId)
      ]);
      if (base) {
        setSelected((prev) => ({ ...(prev || {}), ...base }));
      }
      setProviderDetailData(live || null);
    } catch (err) {
      setProviderDetailError(err?.message || 'Failed to load provider details');
    } finally {
      setProviderDetailLoading(false);
    }
  };

  const loadProviderTransactions = async (cardId, options = {}) => {
    if (!cardId) return;
    const pageValueRaw = options.page ?? providerTxPage;
    const startDateRaw = (options.startDate ?? providerTxStartDate).trim();
    const endDateRaw = (options.endDate ?? providerTxEndDate).trim();
    const pageNum = Number(pageValueRaw);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
      setProviderTxError('Page must be 1 or greater.');
      return;
    }
    if ((startDateRaw && !endDateRaw) || (!startDateRaw && endDateRaw)) {
      setProviderTxError('Provide both startDate and endDate together.');
      return;
    }
    const datePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    if ((startDateRaw && !datePattern.test(startDateRaw)) || (endDateRaw && !datePattern.test(endDateRaw))) {
      setProviderTxError('Dates must use format yyyy-MM-dd HH:mm:ss.');
      return;
    }

    const requestKey = `${cardId}|${pageNum}|${startDateRaw}|${endDateRaw}`;
    const now = Date.now();
    const last = providerTxLastRequestRef.current.get(requestKey) || 0;
    if (now - last < 3000) {
      const waitMs = 3000 - (now - last);
      const waitSec = Math.ceil(waitMs / 1000);
      setProviderTxError(`Please wait ${waitSec}s before requesting the same card/page again.`);
      return;
    }
    providerTxLastRequestRef.current.set(requestKey, now);

    setProviderTxLoading(true);
    setProviderTxError(null);
    try {
      const query = new URLSearchParams({ page: String(pageNum) });
      if (startDateRaw && endDateRaw) {
        query.set('startDate', startDateRaw);
        query.set('endDate', endDateRaw);
      }
      const res = await api.cards.providerTransactions(cardId, query);
      setProviderTxData(res || null);
    } catch (err) {
      setProviderTxError(err?.message || 'Failed to load provider transactions');
    } finally {
      setProviderTxLoading(false);
    }
  };

  useEffect(() => {
    if (!showDetail || !selected?.id) return;
    loadProviderDetails(selected.id);
    loadProviderTransactions(selected.id, { page: '1', startDate: '', endDate: '' });
  }, [showDetail, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.cards.create(toPayload(draft));
      setInfo('Created card.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
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
    setIssueLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.cards.issue(toIssuePayload(issueDraft));
      const transactionId = res?.transactionId || res?.id || null;
      const message = transactionId
        ? `Card issuance submitted. Transaction ID: ${transactionId}.`
        : 'Card issuance submitted.';
      setInfo(message);
      setShowIssue(false);
      fetchRows();
    } catch (err) {
      setError(err.message);
    } finally {
      setIssueLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    setError(null);
    setInfo(null);
    try {
      await api.cards.update(selected.id, toPayload(draft));
      setInfo(`Updated card ${selected.id}.`);
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
      await api.cards.remove(id);
      setInfo(`Deleted card ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBlock = async () => {
    if (!confirmBlock?.id) return;
    setError(null);
    setInfo(null);
    setCardActionLoading(true);
    try {
      const updated = await api.cards.block(confirmBlock.id);
      if (updated) syncCardRecord(updated);
      setInfo(`Blocked card ${confirmBlock.id}.`);
      setConfirmBlock(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCardActionLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!confirmUnblock?.id) return;
    setError(null);
    setInfo(null);
    setCardActionLoading(true);
    try {
      const updated = await api.cards.unblock(confirmUnblock.id);
      if (updated) syncCardRecord(updated);
      setInfo(`Unblocked card ${confirmUnblock.id}.`);
      setConfirmUnblock(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCardActionLoading(false);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="internalReference">Internal reference</label>
        <input id="internalReference" value={draft.internalReference} onChange={(e) => setDraft((p) => ({ ...p, internalReference: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="name">Name</label>
        <input id="name" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="externalReference">External reference</label>
        <input id="externalReference" value={draft.externalReference} onChange={(e) => setDraft((p) => ({ ...p, externalReference: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="status">Status</label>
        <select id="status" value={draft.status} onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))}>
          {statusOptions.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="last4">Last 4</label>
        <input id="last4" value={draft.last4} onChange={(e) => setDraft((p) => ({ ...p, last4: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="cardHolderId">Card holder ID</label>
        <input id="cardHolderId" type="number" value={draft.cardHolderId} onChange={(e) => setDraft((p) => ({ ...p, cardHolderId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="accountId">Account ID</label>
        <input id="accountId" type="number" value={draft.accountId} onChange={(e) => setDraft((p) => ({ ...p, accountId: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="cardProductCardProviderId">Card product/provider ID</label>
        <input
          id="cardProductCardProviderId"
          type="number"
          value={draft.cardProductCardProviderId}
          onChange={(e) => setDraft((p) => ({ ...p, cardProductCardProviderId: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="issued" type="checkbox" checked={draft.issued} onChange={(e) => setDraft((p) => ({ ...p, issued: e.target.checked }))} />
        <label htmlFor="issued">Issued</label>
      </div>
    </div>
  );

  const providerBalanceValue = providerDetailData?.providerBalance;
  const userVisibleBalanceValue = providerDetailData?.appVisibleBalance;
  const hasBothBalances = providerBalanceValue !== null && providerBalanceValue !== undefined && userVisibleBalanceValue !== null && userVisibleBalanceValue !== undefined;
  const balancesAreSame = hasBothBalances && String(providerBalanceValue) === String(userVisibleBalanceValue);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Cards</div>
          <div style={{ color: 'var(--muted)' }}>Issue and manage individual cards.</div>
        </div>
        <Link href="/dashboard/cards" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Cards hub
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="statusFilter">Status</label>
                <select
                  id="statusFilter"
                  value={filters.status}
                  onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="">All</option>
                  {statusOptions.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="issuedFilter">Issued</label>
                <select
                  id="issuedFilter"
                  value={filters.issued}
                  onChange={(e) => setFilters((p) => ({ ...p, issued: e.target.value }))}
                >
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="internalReference">Internal reference</label>
                <input id="internalReference" value={filters.internalReference} onChange={(e) => setFilters((p) => ({ ...p, internalReference: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="externalReference">External reference</label>
                <input id="externalReference" value={filters.externalReference} onChange={(e) => setFilters((p) => ({ ...p, externalReference: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="nameFilter">Name</label>
                <input id="nameFilter" value={filters.name} onChange={(e) => setFilters((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="accountId">Account ID</label>
                <input id="accountId" type="number" value={filters.accountId} onChange={(e) => setFilters((p) => ({ ...p, accountId: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="emailFilter">Email</label>
                <input
                  id="emailFilter"
                  type="email"
                  value={filters.email}
                  placeholder="jane@example.com"
                  onChange={(e) => setFilters((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="page">Page</label>
                <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Number(e.target.value))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="size">Size</label>
                <input id="size" type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setPage(0);
                  setAppliedFilters(filters);
                }}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Applying…' : 'Apply filters'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters(emptyFilters);
                  setAppliedFilters(emptyFilters);
                  setPage(0);
                }}
                disabled={loading}
                className="btn-neutral"
              >
                Reset
              </button>
              <button type="button" onClick={openIssue} className="btn-primary">
                Issue card
              </button>
              <button type="button" onClick={openCreate} className="btn-success">
                Add card
              </button>
            </div>
          </>
        )}
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        page={page}
        pageSize={size}
        onPageChange={setPage}
        emptyLabel="No cards found"
        showAccountQuickNav={false}
      />

      {showCreate && (
        <Modal title="Add card" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showIssue && (
        <Modal title="Issue Card (Order Flow)" onClose={() => (!issueLoading ? setShowIssue(false) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Uses <code>POST /admin-api/cards/issue</code>.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="issueAccountMode">Account selector</label>
                <select
                  id="issueAccountMode"
                  value={issueDraft.accountMode}
                  onChange={(e) => setIssueDraft((p) => ({ ...p, accountMode: e.target.value }))}
                >
                  <option value="id">Account ID</option>
                  <option value="reference">Account reference</option>
                  <option value="email">Account email</option>
                </select>
              </div>
              {issueDraft.accountMode === 'id' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="issueAccountId">Account ID</label>
                  <input
                    id="issueAccountId"
                    type="number"
                    min={1}
                    value={issueDraft.accountId}
                    onChange={(e) => setIssueDraft((p) => ({ ...p, accountId: e.target.value }))}
                  />
                </div>
              )}
              {issueDraft.accountMode === 'reference' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="issueAccountReference">Account reference</label>
                  <input
                    id="issueAccountReference"
                    value={issueDraft.accountReference}
                    onChange={(e) => setIssueDraft((p) => ({ ...p, accountReference: e.target.value }))}
                  />
                </div>
              )}
              {issueDraft.accountMode === 'email' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="issueAccountEmail">Account email</label>
                  <input
                    id="issueAccountEmail"
                    type="email"
                    value={issueDraft.accountEmail}
                    onChange={(e) => setIssueDraft((p) => ({ ...p, accountEmail: e.target.value }))}
                  />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="issueCardProductId">Card product ID</label>
                <input
                  id="issueCardProductId"
                  type="number"
                  min={1}
                  value={issueDraft.cardProductId}
                  onChange={(e) => setIssueDraft((p) => ({ ...p, cardProductId: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label htmlFor="issueCardProductProviderId">Card product/provider ID (optional)</label>
                <input
                  id="issueCardProductProviderId"
                  type="number"
                  min={1}
                  value={issueDraft.cardProductCardProviderId}
                  onChange={(e) => setIssueDraft((p) => ({ ...p, cardProductCardProviderId: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="issueChargeAccount"
                type="checkbox"
                checked={issueDraft.chargeAccount}
                onChange={(e) => setIssueDraft((p) => ({ ...p, chargeAccount: e.target.checked }))}
              />
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => setShowIssue(false)} className="btn-neutral" disabled={issueLoading}>
                Cancel
              </button>
              <button type="button" onClick={handleIssue} className="btn-primary" disabled={issueLoading}>
                {issueLoading ? 'Issuing…' : 'Issue card'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit card ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleUpdate} className="btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Details ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div
              className="card"
              style={{
                padding: '0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusBadge value={selected?.status} />
                <span style={{ fontWeight: 700 }}>Card {selected?.name || selected?.id}</span>
                <span style={{ color: 'var(--muted)', fontSize: '12px' }}>•••• {selected?.last4 || '—'}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {canAdminBlock(selected) ? (
                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    onClick={() => setConfirmBlock(selected)}
                    disabled={cardActionLoading}
                  >
                    Block card
                  </button>
                ) : null}
                {canAdminUnblock(selected) ? (
                  <button
                    type="button"
                    className="btn-success btn-sm"
                    onClick={() => setConfirmUnblock(selected)}
                    disabled={cardActionLoading}
                  >
                    Unblock card
                  </button>
                ) : null}
                <button type="button" className="btn-neutral btn-sm" onClick={() => loadProviderDetails(selected?.id)} disabled={providerDetailLoading || !selected?.id}>
                  {providerDetailLoading ? 'Refreshing details…' : 'Refresh live details'}
                </button>
                <button
                  type="button"
                  className="btn-neutral btn-sm"
                  onClick={() => loadProviderTransactions(selected?.id)}
                  disabled={providerTxLoading || !selected?.id}
                >
                  {providerTxLoading ? 'Refreshing transactions…' : 'Refresh transactions'}
                </button>
              </div>
            </div>

            <DetailGrid
              rows={[
                { label: 'ID', value: selected?.id },
                { label: 'Name', value: selected?.name },
                { label: 'Status', value: <StatusBadge value={selected?.status} /> },
                { label: 'External ref', value: <ExpandableText value={selected?.externalReference} maxLength={40} /> },
                { label: 'Internal ref', value: <ExpandableText value={selected?.internalReference} maxLength={40} /> },
                { label: 'Created at', value: formatDateTime(selected?.createdAt) },
                { label: 'Last 4', value: selected?.last4 },
                { label: 'Issued', value: selected?.issued ? 'Yes' : 'No' }
              ]}
            />

            <div className="card" style={{ padding: '0.9rem', display: 'grid', gap: '0.6rem' }}>
              <div style={{ fontWeight: 800 }}>Balances</div>
              {providerDetailError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{providerDetailError}</div>}
              {!providerDetailError && providerDetailLoading && <div style={{ color: 'var(--muted)' }}>Loading provider details…</div>}
              {!providerDetailError && !providerDetailLoading && (
                <DetailGrid
                  rows={
                    balancesAreSame
                      ? [{ label: 'Balance', value: providerBalanceValue }]
                      : [
                          { label: 'Provider Balance', value: providerBalanceValue ?? '—' },
                          { label: 'User Visible Balance', value: userVisibleBalanceValue ?? '—' }
                        ]
                  }
                />
              )}
            </div>

            <div className="card" style={{ padding: '0.9rem', display: 'grid', gap: '0.6rem' }}>
              <div style={{ fontWeight: 800 }}>Transactions</div>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
                Provider timestamps are GMT and displayed in your local timezone here.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem', alignItems: 'end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="providerTxPage">Page</label>
                  <input id="providerTxPage" type="number" min={1} value={providerTxPage} onChange={(e) => setProviderTxPage(e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="providerTxStartDate">Start date (yyyy-MM-dd HH:mm:ss)</label>
                  <input
                    id="providerTxStartDate"
                    value={providerTxStartDate}
                    onChange={(e) => setProviderTxStartDate(e.target.value)}
                    placeholder="2026-03-01 00:00:00"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label htmlFor="providerTxEndDate">End date (yyyy-MM-dd HH:mm:ss)</label>
                  <input
                    id="providerTxEndDate"
                    value={providerTxEndDate}
                    onChange={(e) => setProviderTxEndDate(e.target.value)}
                    placeholder="2026-03-10 23:59:59"
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-neutral btn-sm"
                    onClick={() => loadProviderTransactions(selected?.id)}
                    disabled={providerTxLoading || !selected?.id}
                  >
                    {providerTxLoading ? 'Loading…' : 'Load transactions'}
                  </button>
                  <button
                    type="button"
                    className="btn-neutral btn-sm"
                    onClick={() => {
                      setProviderTxPage('1');
                      setProviderTxStartDate('');
                      setProviderTxEndDate('');
                    }}
                    disabled={providerTxLoading}
                  >
                    Reset range
                  </button>
                </div>
              </div>

              {providerTxError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{providerTxError}</div>}

              {!providerTxError && providerTxLoading && <div style={{ color: 'var(--muted)' }}>Loading provider transactions…</div>}

              {!providerTxError && !providerTxLoading && (
                <>
                  {(() => {
                    const txList = providerTxData?.data?.transactions || providerTxData?.transactions || [];
                    const creditCount = txList.filter((tx) => String(tx?.card_transaction_type || tx?.type || '').toUpperCase() === 'CREDIT').length;
                    const debitCount = txList.filter((tx) => String(tx?.card_transaction_type || tx?.type || '').toUpperCase() === 'DEBIT').length;
                    const creditTotal = txList.reduce((sum, tx) => {
                      const type = String(tx?.card_transaction_type || tx?.type || '').toUpperCase();
                      const amount = toFiniteNumber(tx?.amount);
                      if (type !== 'CREDIT' || amount === null) return sum;
                      return sum + amount;
                    }, 0);
                    const debitTotal = txList.reduce((sum, tx) => {
                      const type = String(tx?.card_transaction_type || tx?.type || '').toUpperCase();
                      const amount = toFiniteNumber(tx?.amount);
                      if (type !== 'DEBIT' || amount === null) return sum;
                      return sum + amount;
                    }, 0);
                    const txCurrency =
                      txList.find((tx) => tx?.currency)?.currency ||
                      providerTxData?.data?.transactions?.[0]?.currency ||
                      providerTxData?.transactions?.[0]?.currency ||
                      'USD';
                    return (
                  <DetailGrid
                    rows={[
                      { label: 'Rows', value: txList.length },
                      { label: 'Credits', value: `${creditCount} (${formatMoneyFromCents(creditTotal, txCurrency)})` },
                      { label: 'Debits', value: `${debitCount} (${formatMoneyFromCents(debitTotal, txCurrency)})` }
                    ]}
                  />
                    );
                  })()}
                  <DetailGrid
                    rows={[
                      { label: 'Current page', value: providerTxData?.data?.meta?.page ?? providerTxData?.meta?.page ?? '—' },
                      { label: 'Total pages', value: providerTxData?.data?.meta?.totalPages ?? providerTxData?.meta?.totalPages ?? '—' },
                      { label: 'Total records', value: providerTxData?.data?.meta?.total ?? providerTxData?.meta?.total ?? '—' }
                    ]}
                  />
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '0.45rem' }}>Time</th>
                          <th style={{ padding: '0.45rem' }}>Direction</th>
                          <th style={{ padding: '0.45rem' }}>Description</th>
                          <th style={{ padding: '0.45rem' }}>Amount</th>
                          <th style={{ padding: '0.45rem' }}>Refs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {((providerTxData?.data?.transactions || providerTxData?.transactions || [])).length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ padding: '0.6rem', color: 'var(--muted)' }}>
                              No provider transactions returned.
                            </td>
                          </tr>
                        ) : (
                          (providerTxData?.data?.transactions || providerTxData?.transactions || []).map((tx, idx) => (
                            <tr key={tx?.id || tx?.transaction_id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '0.45rem' }}>
                                {formatProviderDateTime(
                                  tx?.createdAt ||
                                    tx?.created_at ||
                                    tx?.transactionDate ||
                                    tx?.transaction_date ||
                                    tx?.date ||
                                    tx?.timestamp
                                )}
                              </td>
                              <td style={{ padding: '0.45rem' }}>
                                {(() => {
                                  const dir = String(tx?.card_transaction_type || tx?.type || tx?.transaction_type || '—').toUpperCase();
                                  const tone =
                                    dir === 'CREDIT'
                                      ? { bg: '#ECFDF3', fg: '#15803D' }
                                      : dir === 'DEBIT'
                                        ? { bg: '#FEF2F2', fg: '#B91C1C' }
                                        : { bg: '#E5E7EB', fg: '#374151' };
                                  return (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        padding: '0.18rem 0.5rem',
                                        borderRadius: '999px',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        background: tone.bg,
                                        color: tone.fg
                                      }}
                                    >
                                      {dir}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td style={{ padding: '0.45rem' }}>
                                {tx?.description || tx?.enriched_data?.transaction_category || '—'}
                              </td>
                              <td style={{ padding: '0.45rem', fontWeight: 700 }}>
                                {(() => {
                                  const dir = String(tx?.card_transaction_type || tx?.type || tx?.transaction_type || '').toUpperCase();
                                  const prefix = dir === 'DEBIT' ? '-' : dir === 'CREDIT' ? '+' : '';
                                  return `${prefix}${formatMoneyFromCents(tx?.amount ?? tx?.transaction_amount, tx?.currency)}`;
                                })()}
                              </td>
                              <td style={{ padding: '0.45rem', fontSize: '12px' }}>
                                <div>Bridge: {tx?.bridgecard_transaction_reference || '—'}</div>
                                <div style={{ color: 'var(--muted)' }}>Client: {tx?.client_transaction_reference || '—'}</div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete card <strong>{confirmDelete.name || confirmDelete.id}</strong>? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </Modal>
      )}

      {confirmBlock && (
        <Modal title="Block card" onClose={() => setConfirmBlock(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Block card <strong>{confirmBlock.name || confirmBlock.id}</strong>? The provider will be synchronized before local status moves to <strong>BLOCKED_BY_ADMIN</strong>.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmBlock(null)} className="btn-neutral" disabled={cardActionLoading}>Cancel</button>
            <button type="button" onClick={handleBlock} className="btn-danger" disabled={cardActionLoading}>
              {cardActionLoading ? 'Blocking…' : 'Block'}
            </button>
          </div>
        </Modal>
      )}

      {confirmUnblock && (
        <Modal title="Unblock card" onClose={() => setConfirmUnblock(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Unblock card <strong>{confirmUnblock.name || confirmUnblock.id}</strong>? The provider will be synchronized before local status moves back to <strong>ACTIVE</strong>.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmUnblock(null)} className="btn-neutral" disabled={cardActionLoading}>Cancel</button>
            <button type="button" onClick={handleUnblock} className="btn-success" disabled={cardActionLoading}>
              {cardActionLoading ? 'Unblocking…' : 'Unblock'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
