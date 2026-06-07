'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyDraft = {
  title: '',
  body: '',
  severity: '',
  startAt: '',
  endAt: '',
  link: '',
  image: '',
  downloadUpdate: false,
  targetAccountId: '',
  appVersionAtLeast: '',
  appVersionLessThan: '',
  includeMissingAppVersion: false,
  hasCards: 'ANY',
  hasSavings: 'ANY',
  hasGroupSavings: 'ANY',
  hasLoans: 'ANY',
  hasEsims: 'ANY',
  hasPaymentRequests: 'ANY',
  hasCompletedTransactions: 'ANY',
  minCompletedTransactions: '',
  maxCompletedTransactions: '',
  lastTransactionOlderThanDays: '',
  minTransactionsThisMonth: '',
  maxTransactionsThisMonth: '',
  accountCreatedFrom: '',
  accountCreatedTo: '',
  countryIds: '',
  countryCodes: '',
  deviceLanguages: '',
  billProductIds: '',
  paymentMethodIds: '',
  paymentProviderIds: '',
  transactionServices: '',
  transactionActions: ''
};

const severityOptions = ['INFO', 'WARNING', 'CRITICAL'];
const triStateOptions = [
  { value: 'ANY', label: 'Any' },
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' }
];
const versionPattern = /^\d+(?:\.\d+)*$/;

const formatUtcDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
  return `${formatted} UTC`;
};

const formatCount = (value) => {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-US').format(num);
};

const toDatetimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
};

const toUtcInstant = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)) return trimmed;
  const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  return `${withSeconds}Z`;
};
const toCsvList = (value) =>
  String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
const toCsvIntegerList = (value, label) =>
  toCsvList(value).map((item) => {
    const parsed = Number(item);
    if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must contain only positive integer IDs.`);
    return parsed;
  });
const optionalInteger = (value, label) => {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative integer.`);
  return parsed;
};
const triStateToBoolean = (value) => (value === 'YES' ? true : value === 'NO' ? false : undefined);

const parseInstant = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isActiveNow = (row) => {
  const now = new Date();
  const startAt = parseInstant(row?.startAt);
  const endAt = parseInstant(row?.endAt);
  if (startAt && startAt > now) return false;
  if (endAt && endAt < now) return false;
  return true;
};

const SeverityBadge = ({ value }) => {
  if (!value) return '-';
  const val = String(value).toUpperCase();
  const tone =
    val === 'CRITICAL'
      ? { bg: '#FEF2F2', fg: '#B91C1C' }
      : val === 'WARNING'
        ? { bg: '#FFF7ED', fg: '#C2410C' }
        : val === 'SUCCESS'
          ? { bg: '#ECFDF3', fg: '#15803D' }
          : { bg: '#EFF6FF', fg: '#1D4ED8' };

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

const ActiveBadge = ({ active }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.2rem 0.55rem',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 700,
      background: active ? '#ECFDF3' : '#F1F5F9',
      color: active ? '#15803D' : '#475569'
    }}
  >
    {active ? 'Active' : 'Inactive'}
  </span>
);

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>{title}</div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: 'var(--text)' }}>
          x
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default function AnnouncementsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [selected, setSelected] = useState(null);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      const res = await api.announcements.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!info && !error) return;
    const t = setTimeout(() => {
      setInfo(null);
      setError(null);
    }, 3500);
    return () => clearTimeout(t);
  }, [info, error]);

  const openCreate = () => {
    setDraft(emptyDraft);
    setSelected(null);
    setShowCreate(true);
    setError(null);
    setInfo(null);
  };

  const openEdit = (row) => {
    const audience = row?.audience || {};
    setSelected(row);
    setDraft({
      title: row?.title ?? '',
      body: row?.body ?? '',
      severity: row?.severity ?? '',
      startAt: toDatetimeLocal(row?.startAt),
      endAt: toDatetimeLocal(row?.endAt),
      link: row?.link ?? '',
      image: row?.image ?? '',
      downloadUpdate: Boolean(row?.downloadUpdate),
      targetAccountId: row?.targetAccountId ?? '',
      appVersionAtLeast: row?.appVersionAtLeast ?? '',
      appVersionLessThan: row?.appVersionLessThan ?? '',
      includeMissingAppVersion: Boolean(row?.includeMissingAppVersion),
      hasCards: audience.hasCards === true ? 'YES' : audience.hasCards === false ? 'NO' : 'ANY',
      hasSavings: audience.hasSavings === true ? 'YES' : audience.hasSavings === false ? 'NO' : 'ANY',
      hasGroupSavings: audience.hasGroupSavings === true ? 'YES' : audience.hasGroupSavings === false ? 'NO' : 'ANY',
      hasLoans: audience.hasLoans === true ? 'YES' : audience.hasLoans === false ? 'NO' : 'ANY',
      hasEsims: audience.hasEsims === true ? 'YES' : audience.hasEsims === false ? 'NO' : 'ANY',
      hasPaymentRequests: audience.hasPaymentRequests === true ? 'YES' : audience.hasPaymentRequests === false ? 'NO' : 'ANY',
      hasCompletedTransactions: audience.hasCompletedTransactions === true ? 'YES' : audience.hasCompletedTransactions === false ? 'NO' : 'ANY',
      minCompletedTransactions: audience.minCompletedTransactions ?? '',
      maxCompletedTransactions: audience.maxCompletedTransactions ?? '',
      lastTransactionOlderThanDays: audience.lastTransactionOlderThanDays ?? '',
      minTransactionsThisMonth: audience.minTransactionsThisMonth ?? '',
      maxTransactionsThisMonth: audience.maxTransactionsThisMonth ?? '',
      accountCreatedFrom: audience.accountCreatedFrom ?? '',
      accountCreatedTo: audience.accountCreatedTo ?? '',
      countryIds: Array.isArray(audience.countryIds) ? audience.countryIds.join(', ') : '',
      countryCodes: Array.isArray(audience.countryCodes) ? audience.countryCodes.join(', ') : '',
      deviceLanguages: Array.isArray(audience.deviceLanguages) ? audience.deviceLanguages.join(', ') : '',
      billProductIds: Array.isArray(audience.billProductIds) ? audience.billProductIds.join(', ') : '',
      paymentMethodIds: Array.isArray(audience.paymentMethodIds) ? audience.paymentMethodIds.join(', ') : '',
      paymentProviderIds: Array.isArray(audience.paymentProviderIds) ? audience.paymentProviderIds.join(', ') : '',
      transactionServices: Array.isArray(audience.transactionServices) ? audience.transactionServices.join(', ') : '',
      transactionActions: Array.isArray(audience.transactionActions) ? audience.transactionActions.join(', ') : ''
    });
    setShowEdit(true);
    setError(null);
    setInfo(null);
  };

  const buildAudiencePayload = () => {
    const audience = {};
    [
      'hasCards',
      'hasSavings',
      'hasGroupSavings',
      'hasLoans',
      'hasEsims',
      'hasPaymentRequests',
      'hasCompletedTransactions'
    ].forEach((field) => {
      const value = triStateToBoolean(draft[field]);
      if (value !== undefined) audience[field] = value;
    });
    [
      ['minCompletedTransactions', 'Min completed transactions'],
      ['maxCompletedTransactions', 'Max completed transactions'],
      ['lastTransactionOlderThanDays', 'Last transaction older-than days'],
      ['minTransactionsThisMonth', 'Min transactions this month'],
      ['maxTransactionsThisMonth', 'Max transactions this month']
    ].forEach(([field, label]) => {
      const value = optionalInteger(draft[field], label);
      if (value !== undefined) audience[field] = value;
    });
    if (draft.accountCreatedFrom) audience.accountCreatedFrom = draft.accountCreatedFrom;
    if (draft.accountCreatedTo) audience.accountCreatedTo = draft.accountCreatedTo;
    const integerLists = [
      ['countryIds', 'Country IDs'],
      ['billProductIds', 'Bill product IDs'],
      ['paymentMethodIds', 'Payment method IDs'],
      ['paymentProviderIds', 'Payment provider IDs']
    ];
    integerLists.forEach(([field, label]) => {
      const values = toCsvIntegerList(draft[field], label);
      if (values.length) audience[field] = values;
    });
    const textLists = [
      'countryCodes',
      'deviceLanguages',
      'transactionServices',
      'transactionActions'
    ];
    textLists.forEach((field) => {
      const values = toCsvList(draft[field]);
      if (values.length) audience[field] = values;
    });
    return Object.keys(audience).length ? audience : undefined;
  };

  const buildPayload = () => {
    const appVersionAtLeast = String(draft.appVersionAtLeast || '').trim();
    const appVersionLessThan = String(draft.appVersionLessThan || '').trim();
    const targetAccountIdRaw = String(draft.targetAccountId || '').trim();
    const targetAccountId = targetAccountIdRaw ? Number(targetAccountIdRaw) : null;
    if (targetAccountIdRaw && (!Number.isInteger(targetAccountId) || targetAccountId <= 0)) throw new Error('Target account ID must be a positive integer.');
    const audience = buildAudiencePayload();
    return {
      title: String(draft.title || '').trim(),
      body: String(draft.body || '').trim(),
      severity: draft.severity ? String(draft.severity).trim() : null,
      startAt: toUtcInstant(draft.startAt),
      endAt: toUtcInstant(draft.endAt),
      link: draft.link ? String(draft.link).trim() : null,
      image: draft.image ? String(draft.image).trim() : null,
      downloadUpdate: Boolean(draft.downloadUpdate),
      targetAccountId,
      audience: audience || null,
      appVersionAtLeast: appVersionAtLeast || null,
      appVersionLessThan: appVersionLessThan || null,
      includeMissingAppVersion: Boolean(draft.includeMissingAppVersion)
    };
  };

  const validateDraft = () => {
    if (!String(draft.title || '').trim()) return 'Title is required.';
    if (!String(draft.body || '').trim()) return 'Body is required.';
    const atLeast = String(draft.appVersionAtLeast || '').trim();
    const lessThan = String(draft.appVersionLessThan || '').trim();
    if (atLeast && !versionPattern.test(atLeast)) return 'Minimum app version must be a numeric dotted version, for example 2.0.0.';
    if (lessThan && !versionPattern.test(lessThan)) return 'Maximum app version must be a numeric dotted version, for example 3.0.0.';
    const targetAccountId = String(draft.targetAccountId || '').trim();
    if (targetAccountId && (!Number.isInteger(Number(targetAccountId)) || Number(targetAccountId) <= 0)) return 'Target account ID must be a positive integer.';
    return null;
  };

  const handleCreate = async () => {
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.announcements.create(buildPayload());
      setInfo('Announcement created.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to create announcement');
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setInfo(null);
    try {
      await api.announcements.update(selected.id, buildPayload());
      setInfo(`Announcement ${selected.id} updated.`);
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to update announcement');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete?.id) return;
    const id = confirmDelete.id;
    setError(null);
    setInfo(null);
    try {
      await api.announcements.remove(id);
      setInfo(`Announcement ${id} deleted.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to delete announcement');
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'title',
        label: 'Title',
        render: (row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <div style={{ fontWeight: 700 }}>{row.title || '-'}</div>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>#{row.id ?? '-'}</div>
          </div>
        )
      },
      {
        key: 'body',
        label: 'Body',
        render: (row) => {
          const text = String(row.body || '');
          return text.length > 120 ? `${text.slice(0, 120)}...` : text || '-';
        }
      },
      {
        key: 'severity',
        label: 'Severity',
        render: (row) => <SeverityBadge value={row.severity} />
      },
      {
        key: 'active',
        label: 'Active',
        render: (row) => <ActiveBadge active={isActiveNow(row)} />
      },
      {
        key: 'downloadUpdate',
        label: 'Update CTA',
        render: (row) => (row?.downloadUpdate ? 'Enabled' : '—')
      },
      {
        key: 'viewCount',
        label: 'Views',
        render: (row) => formatCount(row.viewCount)
      },
      {
        key: 'createdAt',
        label: 'Created',
        render: (row) => formatUtcDateTime(row.createdAt)
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openEdit(row)} className="btn-neutral">
              Edit
            </button>
            <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger">
              Delete
            </button>
          </div>
        )
      }
    ],
    []
  );

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="title">Title *</label>
        <input id="title" value={draft.title} onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))} placeholder="Maintenance notice" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="severity">Severity</label>
        <select
          id="severity"
          value={draft.severity}
          onChange={(e) => setDraft((p) => ({ ...p, severity: e.target.value }))}
        >
          <option value="">Select severity</option>
          {severityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="startAt">Start at (UTC)</label>
        <input
          id="startAt"
          type="datetime-local"
          value={draft.startAt}
          onChange={(e) => setDraft((p) => ({ ...p, startAt: e.target.value }))}
        />
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Treated as UTC, not local time.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="endAt">End at (UTC)</label>
        <input
          id="endAt"
          type="datetime-local"
          value={draft.endAt}
          onChange={(e) => setDraft((p) => ({ ...p, endAt: e.target.value }))}
        />
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Treated as UTC, not local time.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="link">Link</label>
        <input id="link" value={draft.link} onChange={(e) => setDraft((p) => ({ ...p, link: e.target.value }))} placeholder="https://status.fondeka.com" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="image">Image URL</label>
        <input id="image" value={draft.image} onChange={(e) => setDraft((p) => ({ ...p, image: e.target.value }))} placeholder="https://cdn.fondeka.com/..." />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="targetAccountId">Target account ID</label>
        <input
          id="targetAccountId"
          type="number"
          min={1}
          value={draft.targetAccountId}
          onChange={(e) => setDraft((p) => ({ ...p, targetAccountId: e.target.value }))}
          placeholder="Private announcement"
        />
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Optional. If set, only this account can receive the announcement.</div>
      </div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', alignSelf: 'end', minHeight: '42px' }}>
        <input
          type="checkbox"
          checked={draft.downloadUpdate}
          onChange={(e) => setDraft((p) => ({ ...p, downloadUpdate: e.target.checked }))}
        />
        <span>Download update</span>
      </label>
      <div style={{ display: 'grid', gap: '0.75rem', gridColumn: '1 / -1' }}>
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>App version targeting</summary>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginTop: '0.65rem' }}>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>App version at least</span>
              <input value={draft.appVersionAtLeast} onChange={(e) => setDraft((p) => ({ ...p, appVersionAtLeast: e.target.value }))} placeholder="2.0.0" />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem' }}>
              <span>App version less than</span>
              <input value={draft.appVersionLessThan} onChange={(e) => setDraft((p) => ({ ...p, appVersionLessThan: e.target.value }))} placeholder="3.0.0" />
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', alignSelf: 'end', minHeight: '42px' }}>
              <input type="checkbox" checked={draft.includeMissingAppVersion} onChange={(e) => setDraft((p) => ({ ...p, includeMissingAppVersion: e.target.checked }))} />
              Include missing app version
            </label>
          </div>
        </details>

        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Audience targeting</summary>
          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.65rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
              {[
                ['hasCards', 'Has cards'],
                ['hasSavings', 'Has savings'],
                ['hasGroupSavings', 'Has group savings'],
                ['hasLoans', 'Has loans'],
                ['hasEsims', 'Has eSIMs'],
                ['hasPaymentRequests', 'Has payment requests'],
                ['hasCompletedTransactions', 'Has completed transactions']
              ].map(([field, label]) => (
                <label key={field} style={{ display: 'grid', gap: '0.25rem' }}>
                  <span>{label}</span>
                  <select value={draft[field]} onChange={(e) => setDraft((p) => ({ ...p, [field]: e.target.value }))}>
                    {triStateOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {[
                ['minCompletedTransactions', 'Min completed'],
                ['maxCompletedTransactions', 'Max completed'],
                ['lastTransactionOlderThanDays', 'Last tx older than days'],
                ['minTransactionsThisMonth', 'Min this month'],
                ['maxTransactionsThisMonth', 'Max this month']
              ].map(([field, label]) => (
                <label key={field} style={{ display: 'grid', gap: '0.25rem' }}>
                  <span>{label}</span>
                  <input type="number" min={0} value={draft[field]} onChange={(e) => setDraft((p) => ({ ...p, [field]: e.target.value }))} />
                </label>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span>Account created from</span>
                <input type="date" value={draft.accountCreatedFrom} onChange={(e) => setDraft((p) => ({ ...p, accountCreatedFrom: e.target.value }))} />
              </label>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span>Account created to</span>
                <input type="date" value={draft.accountCreatedTo} onChange={(e) => setDraft((p) => ({ ...p, accountCreatedTo: e.target.value }))} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {[
                ['countryIds', 'Country IDs'],
                ['countryCodes', 'Country codes'],
                ['deviceLanguages', 'Device languages'],
                ['billProductIds', 'Bill product IDs'],
                ['paymentMethodIds', 'Payment method IDs'],
                ['paymentProviderIds', 'Payment provider IDs'],
                ['transactionServices', 'Transaction services'],
                ['transactionActions', 'Transaction actions']
              ].map(([field, label]) => (
                <label key={field} style={{ display: 'grid', gap: '0.25rem' }}>
                  <span>{label}</span>
                  <input value={draft[field]} onChange={(e) => setDraft((p) => ({ ...p, [field]: e.target.value }))} placeholder="Comma separated" />
                </label>
              ))}
            </div>
          </div>
        </details>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: '1 / -1' }}>
        <label htmlFor="body">Body *</label>
        <textarea
          id="body"
          rows={4}
          value={draft.body}
          onChange={(e) => setDraft((p) => ({ ...p, body: e.target.value }))}
          placeholder="We will be unavailable from 2-4 AM UTC."
        />
        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
          When enabled, the customer app resolves the announcement link to the platform store URL.
        </div>
      </div>
    </div>
  );

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? true : page + 1 < pageMeta.totalPages;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Announcements</div>
          <div style={{ color: 'var(--muted)' }}>Manage in-app announcements and scheduling windows (UTC).</div>
        </div>
        <Link href="/dashboard" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          {'<- Dashboard'}
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
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
        <button type="button" onClick={openCreate} className="btn-success">
          New announcement
        </button>
        <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={!canPrev} className="btn-neutral">
          Prev
        </button>
        <button type="button" onClick={() => setPage((p) => p + 1)} disabled={!canNext} className="btn-neutral">
          Next
        </button>
        {pageMeta.totalElements !== null && (
          <div style={{ color: 'var(--muted)' }}>
            {pageMeta.totalElements} total{pageMeta.totalPages !== null ? ` | page ${page + 1}/${pageMeta.totalPages}` : ''}
          </div>
        )}
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
        emptyLabel="No announcements found"
        showIndex={false}
      />

      {showCreate && (
        <Modal title="New announcement" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleCreate} className="btn-success">
              Create
            </button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit announcement ${selected?.id ?? ''}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleUpdate} className="btn-primary">
              Save
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete announcement" onClose={() => setConfirmDelete(null)}>
          <div style={{ marginBottom: '0.75rem' }}>
            Delete announcement <strong>{confirmDelete.title || `#${confirmDelete.id}`}</strong>?
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleDelete} className="btn-danger">
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
