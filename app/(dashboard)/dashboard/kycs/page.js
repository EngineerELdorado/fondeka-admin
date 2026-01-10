'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const statusOptions = ['PENDING', 'APPROVED', 'REJECTED', 'FAILED', 'PROVISIONALLY_APPROVED', 'ADDITIONAL_VERIFICATION_NEEDED', 'EXPIRED'];
const docTypeOptions = [
  'DRIVERS_LICENSE',
  'PASSPORT',
  'TRAVEL_DOC',
  'VOTER_ID',
  'HEALTH_CARD',
  'IDENTITY_CARD',
  'REGISTRATION_CERTIFICATE',
  'RESIDENT_ID',
  'SEAMANS_ID',
  'UNIFORMED_SERVICES_CARD',
  'TAX_ID',
  'SOCIAL_ID',
  'WORK_PERMIT',
  'OCCUPATION_CARD',
  'ALIEN_CARD',
  'CITIZEN_ID'
];

const emptyFilters = {
  status: '',
  level: '',
  country: '',
  accountRef: '',
  accountId: '',
  emailOrUsername: '',
  internalRef: '',
  externalRef: '',
  idNumber: '',
  startDate: '',
  endDate: ''
};

const emptyUpdateDraft = {
  kycDecision: '',
  comments: '',
  idNumber: '',
  countryCode: '',
  docType: '',
  firstName: '',
  lastName: '',
  otherNames: '',
  fullName: '',
  dob: '',
  address: '',
  city: '',
  postalCode: '',
  houseNo: '',
  gender: '',
  level: '',
  issuedAt: '',
  expiresAt: '',
  externalReference: ''
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

const StatusBadge = ({ value }) => {
  if (!value) return '—';
  const val = String(value).toUpperCase();
  const tone =
    val === 'APPROVED'
      ? { bg: '#ECFDF3', fg: '#15803D' }
      : val === 'PENDING'
        ? { bg: '#EFF6FF', fg: '#1D4ED8' }
        : val === 'REJECTED' || val === 'FAILED' || val === 'EXPIRED'
          ? { bg: '#FEF2F2', fg: '#B91C1C' }
          : val === 'ADDITIONAL_VERIFICATION_NEEDED'
            ? { bg: '#FFF7ED', fg: '#C2410C' }
            : val === 'PROVISIONALLY_APPROVED'
              ? { bg: '#F5F3FF', fg: '#6D28D9' }
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

export default function KycsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState(null); // { row, decision: 'APPROVE' | 'REJECT', comments }
  const [updateDraft, setUpdateDraft] = useState(emptyUpdateDraft);
  const [levelOptions, setLevelOptions] = useState([]);
  const [smileResult, setSmileResult] = useState(null);
  const [smileResultFor, setSmileResultFor] = useState(null);
  const [showSmileResult, setShowSmileResult] = useState(false);
  const [smileLoadingId, setSmileLoadingId] = useState(null);

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const normalizeSmileValue = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && (value.trim() === '' || value.trim().toLowerCase() === 'not available')) return null;
    return value;
  };

  const pickSmileValue = (...values) => {
    for (const value of values) {
      const normalized = normalizeSmileValue(value);
      if (normalized !== null) return normalized;
    }
    return null;
  };

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        if (['level', 'accountId'].includes(key)) {
          const num = Number(value);
          if (!Number.isNaN(num)) params.set(key, String(num));
        } else if (['startDate', 'endDate'].includes(key)) {
          const ts = Date.parse(value);
          if (!Number.isNaN(ts)) params.set(key, String(ts));
        } else {
          params.set(key, String(value));
        }
      });
      const res = await api.kycs.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      const normalized = (list || []).map((item) => {
        const names = [item.firstName, item.otherNames, item.lastName].filter(Boolean).join(' ').trim();
        const userDisplay = item.fullName || names || item.username || item.email;
        return {
          ...item,
          country: item.countryName || item.country || item.countryCode,
          accountRef: item.accountRef || item.accountReference,
          emailOrUsername: userDisplay,
          internalRef: item.internalRef || item.internalReference,
          externalRef: item.externalRef || item.externalReference
        };
      });
      setRows(normalized);
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
    const fetchLevels = async () => {
      try {
        const res = await api.kycCaps.list(new URLSearchParams({ page: '0', size: '100' }));
        const list = Array.isArray(res) ? res : res?.content || [];
        setLevelOptions(list);
      } catch {
        // ignore silently
      }
    };
    fetchLevels();
  }, []);

  const activeFilterChips = useMemo(() => {
    const chips = [];
    const add = (label, key) => chips.push({ label, key });
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined) return;
      switch (key) {
        case 'status':
          add(`Status: ${value}`, key);
          break;
        case 'level':
          add(`Level: ${value}`, key);
          break;
        case 'country':
          add(`Country: ${value}`, key);
          break;
        case 'accountRef':
          add(`Account ref: ${value}`, key);
          break;
        case 'accountId':
          add(`Account ID: ${value}`, key);
          break;
        case 'emailOrUsername':
          add(`Email/Username: ${value}`, key);
          break;
        case 'internalRef':
          add(`Internal ref: ${value}`, key);
          break;
        case 'externalRef':
          add(`External ref: ${value}`, key);
          break;
        case 'idNumber':
          add(`ID number: ${value}`, key);
          break;
        case 'startDate':
          add(`From: ${value}`, key);
          break;
        case 'endDate':
          add(`To: ${value}`, key);
          break;
        default:
          break;
      }
    });
    return chips;
  }, [appliedFilters]);

  const columns = [
    { key: 'id', label: 'ID' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge value={row.status} />
    },
    { key: 'level', label: 'Level' },
    { key: 'country', label: 'Country' },
    {
      key: 'accountRef',
      label: 'Account ref',
      render: (row) => row.accountRef || row.accountReference || '—'
    },
    {
      key: 'emailOrUsername',
      label: 'User',
      render: (row) => row.emailOrUsername || '—'
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      render: (row) => formatDateTime(row.updatedAt)
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral">
            View
          </button>
          <button type="button" onClick={() => handleSmileRefresh(row)} className="btn-neutral" disabled={smileLoadingId === row.id}>
            {smileLoadingId === row.id ? 'Fetching…' : 'SmileID'}
          </button>
          <button
            type="button"
            onClick={() => {
              setDecision({ row, decision: 'APPROVE' });
              setUpdateDraft({
                ...emptyUpdateDraft,
                kycDecision: 'APPROVE',
                comments: row?.comments || '',
                idNumber: row?.idNumber || '',
                countryCode: row?.country || row?.countryCode || '',
                docType: row?.docType || '',
                firstName: row?.firstName || '',
                lastName: row?.lastName || '',
                otherNames: row?.otherNames || '',
                fullName: row?.fullName || '',
                dob: row?.dob || '',
                address: row?.address || '',
                city: row?.city || '',
                postalCode: row?.postalCode || '',
                houseNo: row?.houseNo || '',
                gender: row?.gender || '',
                level: row?.level ?? '',
                issuedAt: row?.issuedAt || '',
                expiresAt: row?.expiresAt || '',
                externalReference: row?.externalReference || ''
              });
            }}
            className="btn-primary"
            style={{ background: 'linear-gradient(90deg, #10B981, #047857)', border: 'none' }}
          >
            Update
          </button>
        </div>
      )
    }
  ];

  const openDetail = (row) => {
    setSelected(row);
    setShowDetail(true);
    setInfo(null);
    setError(null);
  };

  const handleSmileRefresh = async (row) => {
    if (!row?.id) return;
    setError(null);
    setInfo(null);
    setSmileLoadingId(row.id);
    try {
      const res = await api.kycs.refreshSmileIdResult(row.id);
      setSmileResult(res);
      setSmileResultFor(row.id);
      setShowSmileResult(true);
      setInfo(`SmileID result loaded for KYC ${row.id}.`);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to refresh SmileID result.');
    } finally {
      setSmileLoadingId(null);
    }
  };

  const handleDecision = async () => {
    if (!decision?.row?.id || !updateDraft.kycDecision) return;
    setError(null);
    setInfo(null);
    try {
      const payload = {};
      const addIf = (key, val) => {
        if (val !== '' && val !== null && val !== undefined) payload[key] = val;
      };
      addIf('kycDecision', updateDraft.kycDecision);
      addIf('comments', updateDraft.comments);
      addIf('idNumber', updateDraft.idNumber);
      addIf('countryCode', updateDraft.countryCode);
      addIf('docType', updateDraft.docType);
      addIf('firstName', updateDraft.firstName);
      addIf('lastName', updateDraft.lastName);
      addIf('otherNames', updateDraft.otherNames);
      addIf('fullName', updateDraft.fullName);
      addIf('address', updateDraft.address);
      addIf('city', updateDraft.city);
      addIf('postalCode', updateDraft.postalCode);
      addIf('houseNo', updateDraft.houseNo);
      addIf('gender', updateDraft.gender);
      if (updateDraft.level !== '') addIf('level', Number(updateDraft.level));
      const toIso = (val) => {
        if (!val) return null;
        const d = new Date(val);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
      };
      const dobIso = toIso(updateDraft.dob);
      const issuedIso = toIso(updateDraft.issuedAt);
      const expiresIso = toIso(updateDraft.expiresAt);
      if (dobIso) addIf('dob', dobIso);
      if (issuedIso) addIf('issuedAt', issuedIso);
      if (expiresIso) addIf('expiresAt', expiresIso);
      addIf('externalReference', updateDraft.externalReference);

      await api.kycs.update(decision.row.id, payload);
      setInfo(`KYC ${decision.row.id} → ${updateDraft.kycDecision}`);
      setDecision(null);
      setUpdateDraft(emptyUpdateDraft);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>KYCs</div>
          <div style={{ color: 'var(--muted)' }}>Filter, review, and decide KYCs with full context.</div>
        </div>
        <Link href="/dashboard" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Dashboard
        </Link>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="status">Status</label>
            <select id="status" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
              <option value="">All</option>
              {statusOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="level">Level</label>
            <input id="level" type="number" min={0} max={5} value={filters.level} onChange={(e) => setFilters((p) => ({ ...p, level: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="country">Country</label>
            <input id="country" value={filters.country} onChange={(e) => setFilters((p) => ({ ...p, country: e.target.value }))} placeholder="ISO alpha2" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="accountRef">Account ref</label>
            <input id="accountRef" value={filters.accountRef} onChange={(e) => setFilters((p) => ({ ...p, accountRef: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="accountId">Account ID</label>
            <input id="accountId" type="number" min={0} value={filters.accountId} onChange={(e) => setFilters((p) => ({ ...p, accountId: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="emailOrUsername">Email or username</label>
            <input id="emailOrUsername" value={filters.emailOrUsername} onChange={(e) => setFilters((p) => ({ ...p, emailOrUsername: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="internalRef">Internal ref</label>
            <input id="internalRef" value={filters.internalRef} onChange={(e) => setFilters((p) => ({ ...p, internalRef: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="externalRef">External ref</label>
            <input id="externalRef" value={filters.externalRef} onChange={(e) => setFilters((p) => ({ ...p, externalRef: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="idNumber">ID number</label>
            <input id="idNumber" value={filters.idNumber} onChange={(e) => setFilters((p) => ({ ...p, idNumber: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="startDate">Updated from</label>
            <input id="startDate" type="datetime-local" value={filters.startDate} onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label htmlFor="endDate">Updated to</label>
            <input id="endDate" type="datetime-local" value={filters.endDate} onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))} />
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
          <button type="button" onClick={fetchRows} disabled={loading} className="btn-neutral">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Only applied filters are sent to the API.</span>
        </div>

        {activeFilterChips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {activeFilterChips.map((chip) => (
              <FilterChip
                key={chip.key}
                label={chip.label}
                onClear={() => {
                  const next = { ...appliedFilters, [chip.key]: '' };
                  setAppliedFilters(next);
                  setFilters((p) => ({ ...p, [chip.key]: '' }));
                }}
              />
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>
          {error}
        </div>
      )}
      {info && (
        <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>
          {info}
        </div>
      )}

      <DataTable columns={columns} rows={rows} emptyLabel="No KYCs found" />

      {showDetail && (
        <Modal title={`KYC ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => handleSmileRefresh(selected)} className="btn-neutral" disabled={smileLoadingId === selected?.id}>
              {smileLoadingId === selected?.id ? 'Fetching…' : 'SmileID'}
            </button>
          </div>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Status', value: selected?.status },
              { label: 'Level', value: selected?.level },
              { label: 'Country', value: selected?.country },
              { label: 'Account ref', value: selected?.accountRef || selected?.accountReference },
              { label: 'User', value: selected?.fullName || [selected?.firstName, selected?.otherNames, selected?.lastName].filter(Boolean).join(' ') || selected?.username || selected?.email },
              { label: 'Internal ref', value: selected?.internalRef },
              { label: 'External ref', value: selected?.externalRef },
              { label: 'ID number', value: selected?.idNumber },
              { label: 'DOB', value: formatDate(selected?.dob) },
              { label: 'Issued at', value: formatDateTime(selected?.issuedAt) },
              { label: 'Expires at', value: formatDateTime(selected?.expiresAt) }
            ]}
          />
        </Modal>
      )}

      {decision && (
        <Modal title={`${decision.decision === 'APPROVE' ? 'Approve' : 'Reject'} KYC`} onClose={() => setDecision(null)}>
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
            {decision.decision === 'APPROVE' ? 'Approve' : 'Reject'} KYC <strong>{decision.row.id}</strong>?
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionSelect">Decision</label>
              <select
                id="decisionSelect"
                value={updateDraft.kycDecision}
                onChange={(e) => setUpdateDraft((p) => ({ ...p, kycDecision: e.target.value }))}
              >
                <option value="">Select</option>
                <option value="APPROVE">APPROVE</option>
                <option value="REJECT">REJECT</option>
                <option value="EXPIRE">EXPIRED</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionLevel">Level</label>
              <select id="decisionLevel" value={updateDraft.level} onChange={(e) => setUpdateDraft((p) => ({ ...p, level: e.target.value }))}>
                <option value="">Select level</option>
                {(levelOptions.length ? levelOptions : Array.from({ length: 8 }, (_, idx) => ({ level: idx, levelDescription: '' }))).map((opt) => (
                  <option key={opt.level} value={opt.level}>
                    {opt.level} {opt.levelDescription ? `- ${opt.levelDescription}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionCountry">Country</label>
              <input id="decisionCountry" value={updateDraft.countryCode} onChange={(e) => setUpdateDraft((p) => ({ ...p, countryCode: e.target.value }))} placeholder="ISO alpha2" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionDocType">Doc type</label>
              <select id="decisionDocType" value={updateDraft.docType} onChange={(e) => setUpdateDraft((p) => ({ ...p, docType: e.target.value }))}>
                <option value="">Select</option>
                {docTypeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionIdNumber">ID number</label>
              <input id="decisionIdNumber" value={updateDraft.idNumber} onChange={(e) => setUpdateDraft((p) => ({ ...p, idNumber: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionFirstName">First name</label>
              <input id="decisionFirstName" value={updateDraft.firstName} onChange={(e) => setUpdateDraft((p) => ({ ...p, firstName: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionLastName">Last name</label>
              <input id="decisionLastName" value={updateDraft.lastName} onChange={(e) => setUpdateDraft((p) => ({ ...p, lastName: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionOtherNames">Other names</label>
              <input id="decisionOtherNames" value={updateDraft.otherNames} onChange={(e) => setUpdateDraft((p) => ({ ...p, otherNames: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionFullName">Full name</label>
              <input id="decisionFullName" value={updateDraft.fullName} onChange={(e) => setUpdateDraft((p) => ({ ...p, fullName: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionDob">DOB</label>
              <input id="decisionDob" type="datetime-local" value={updateDraft.dob} onChange={(e) => setUpdateDraft((p) => ({ ...p, dob: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionIssuedAt">Issued at</label>
              <input id="decisionIssuedAt" type="datetime-local" value={updateDraft.issuedAt} onChange={(e) => setUpdateDraft((p) => ({ ...p, issuedAt: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionExpiresAt">Expires at</label>
              <input id="decisionExpiresAt" type="datetime-local" value={updateDraft.expiresAt} onChange={(e) => setUpdateDraft((p) => ({ ...p, expiresAt: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionExternalRef">External ref</label>
              <input id="decisionExternalRef" value={updateDraft.externalReference} onChange={(e) => setUpdateDraft((p) => ({ ...p, externalReference: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionAddress">Address</label>
              <input id="decisionAddress" value={updateDraft.address} onChange={(e) => setUpdateDraft((p) => ({ ...p, address: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionCity">City</label>
              <input id="decisionCity" value={updateDraft.city} onChange={(e) => setUpdateDraft((p) => ({ ...p, city: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionPostal">Postal code</label>
              <input id="decisionPostal" value={updateDraft.postalCode} onChange={(e) => setUpdateDraft((p) => ({ ...p, postalCode: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionHouse">House no</label>
              <input id="decisionHouse" value={updateDraft.houseNo} onChange={(e) => setUpdateDraft((p) => ({ ...p, houseNo: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionGender">Gender</label>
              <input id="decisionGender" value={updateDraft.gender} onChange={(e) => setUpdateDraft((p) => ({ ...p, gender: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <label htmlFor="decisionComments">Comments (optional)</label>
            <textarea
              id="decisionComments"
              rows={3}
              value={updateDraft.comments}
              onChange={(e) => setUpdateDraft((p) => ({ ...p, comments: e.target.value }))}
              placeholder="Add a brief note about your decision"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setDecision(null)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleDecision} className={decision.decision === 'APPROVE' ? 'btn-success' : 'btn-danger'}>
              Submit
            </button>
          </div>
        </Modal>
      )}

      {showSmileResult && (
        <Modal
          title={`SmileID result${smileResultFor ? ` for KYC ${smileResultFor}` : ''}`}
          onClose={() => {
            setShowSmileResult(false);
            setSmileResult(null);
            setSmileResultFor(null);
          }}
        >
          {!smileResult ? (
            <div style={{ color: 'var(--muted)' }}>No SmileID result available.</div>
          ) : (
            <>
              <DetailGrid
                rows={[
                  { label: 'Result', value: pickSmileValue(smileResult.ResultText, smileResult.ResultCode) },
                  {
                    label: 'Full name',
                    value: pickSmileValue(
                      smileResult.FullName,
                      [smileResult.FirstName, smileResult.OtherName || smileResult.OtherNames, smileResult.LastName].filter(Boolean).join(' ').trim()
                    )
                  },
                  { label: 'Document type', value: pickSmileValue(smileResult.IDType, smileResult.IdType, smileResult.DocumentType) },
                  { label: 'Document number', value: pickSmileValue(smileResult.IDNumber, smileResult.IdNumber, smileResult.DocumentNumber) },
                  { label: 'DOB', value: pickSmileValue(formatDate(smileResult.DOB), formatDate(smileResult.DateOfBirth)) },
                  { label: 'Expires', value: pickSmileValue(formatDate(smileResult.ExpirationDate), formatDate(smileResult.ExpiryDate)) },
                  { label: 'Country', value: pickSmileValue(smileResult.Country) }
                ]}
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem', marginTop: '0.9rem' }}>
                {[
                  { label: 'Selfie', url: pickSmileValue(smileResult.ImageLinks?.selfie_image, smileResult.imageLinks?.selfie_image) },
                  { label: 'Document front', url: pickSmileValue(smileResult.ImageLinks?.id_card_image, smileResult.imageLinks?.id_card_image) },
                  { label: 'Document back', url: pickSmileValue(smileResult.ImageLinks?.id_card_back, smileResult.imageLinks?.id_card_back) }
                ].map((img) => (
                  <div
                    key={img.label}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      padding: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      minHeight: '140px'
                    }}
                  >
                    <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{img.label}</div>
                    {img.url ? (
                      <img src={img.url} alt={`${img.label} image`} style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '8px' }} />
                    ) : (
                      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>No image.</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
