'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const statusFilterOptions = ['PENDING', 'APPROVED', 'REJECTED', 'FAILED', 'PROVISIONALLY_APPROVED', 'ADDITIONAL_VERIFICATION_NEEDED', 'EXPIRED'];
const statusDecisionOptions = ['APPROVE', 'REJECT', 'EXPIRE'];
const statusToDecision = {
  APPROVED: 'APPROVE',
  REJECTED: 'REJECT',
  FAILED: 'REJECT',
  EXPIRED: 'EXPIRE'
};

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

const emptyStatusDraft = {
  status: '',
  comments: ''
};

const emptyLevelDraft = {
  level: ''
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
  const [statusEditRow, setStatusEditRow] = useState(null);
  const [levelEditRow, setLevelEditRow] = useState(null);
  const [statusDraft, setStatusDraft] = useState(emptyStatusDraft);
  const [levelDraft, setLevelDraft] = useState(emptyLevelDraft);
  const [levelOptions, setLevelOptions] = useState([]);
  const [smileAction, setSmileAction] = useState(null);
  const [confirmSmileDelete, setConfirmSmileDelete] = useState(null);
  const router = useRouter();

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
          <button
            type="button"
            onClick={() => {
              setStatusEditRow(row);
              const mappedDecision = statusToDecision[row?.status] || '';
              setStatusDraft({
                ...emptyStatusDraft,
                status: mappedDecision,
                comments: row?.comments || ''
              });
            }}
            className="btn-primary"
            style={{ background: 'linear-gradient(90deg, #10B981, #047857)', border: 'none' }}
          >
            Update status
          </button>
          <button
            type="button"
            onClick={() => {
              setLevelEditRow(row);
              setLevelDraft({
                ...emptyLevelDraft,
                level: row?.level ?? ''
              });
            }}
            className="btn-neutral"
          >
            Change level
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

  const handleSmileOpen = (row) => {
    if (!row?.id) return;
    router.push(`/dashboard/kycs/${row.id}/smileid`);
  };

  const handleStatusUpdate = async () => {
    if (!statusEditRow?.id || !statusDraft.status) return;
    setError(null);
    setInfo(null);
    try {
      const statusPayload = { status: statusDraft.status };
      if (statusDraft.comments) statusPayload.comments = statusDraft.comments;
      await api.kycs.updateStatus(statusEditRow.id, statusPayload);
      setInfo(`KYC ${statusEditRow.id} status → ${statusDraft.status}`);
      setStatusEditRow(null);
      setStatusDraft(emptyStatusDraft);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLevelUpdate = async () => {
    if (!levelEditRow?.id || levelDraft.level === '') return;
    setError(null);
    setInfo(null);
    try {
      await api.kycs.updateLevel(levelEditRow.id, { level: Number(levelDraft.level) });
      setInfo(`KYC ${levelEditRow.id} level → ${levelDraft.level}`);
      setLevelEditRow(null);
      setLevelDraft(emptyLevelDraft);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSmileReenroll = async (row) => {
    if (!row?.id) return;
    setError(null);
    setInfo(null);
    setSmileAction('reenroll');
    try {
      const res = await api.kycs.smileIdReenroll(row.id);
      setInfo(res?.message || `SmileID user ${res?.user_id || ''} re-enrollment enabled.`);
    } catch (err) {
      setError(err.message || 'Failed to allow SmileID re-enrollment.');
    } finally {
      setSmileAction(null);
    }
  };

  const handleSmileDelete = async () => {
    if (!confirmSmileDelete?.id) return;
    setError(null);
    setInfo(null);
    setSmileAction('delete');
    try {
      const res = await api.kycs.smileIdDelete(confirmSmileDelete.id);
      setInfo(res?.message || `SmileID user ${res?.user_id || ''} deleted.`);
      setConfirmSmileDelete(null);
    } catch (err) {
      setError(err.message || 'Failed to delete SmileID user.');
    } finally {
      setSmileAction(null);
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
              {statusFilterOptions.map((st) => (
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
            <button type="button" onClick={() => handleSmileOpen(selected)} className="btn-neutral">
              SmileID
            </button>
            <button
              type="button"
              onClick={() => handleSmileReenroll(selected)}
              className="btn-neutral"
              disabled={smileAction !== null}
            >
              {smileAction === 'reenroll' ? 'Allowing…' : 'Allow re-enrollment'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmSmileDelete(selected)}
              className="btn-primary"
              disabled={smileAction !== null}
              style={{ background: 'linear-gradient(90deg, #F97316, #DC2626)', border: 'none' }}
            >
              Delete SmileID user
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
              { label: 'Last job reference', value: selected?.lastJobReference },
              { label: 'ID number', value: selected?.idNumber },
              { label: 'DOB', value: formatDate(selected?.dob) },
              { label: 'Issued at', value: formatDateTime(selected?.issuedAt) },
              { label: 'Expires at', value: formatDateTime(selected?.expiresAt) }
            ]}
          />
        </Modal>
      )}

      {confirmSmileDelete && (
        <Modal title="Delete SmileID user" onClose={() => setConfirmSmileDelete(null)}>
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
            This permanently deletes the SmileID user and cannot be undone. Continue?
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmSmileDelete(null)} className="btn-neutral" disabled={smileAction === 'delete'}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSmileDelete}
              className="btn-primary"
              disabled={smileAction === 'delete'}
              style={{ background: 'linear-gradient(90deg, #F97316, #DC2626)', border: 'none' }}
            >
              {smileAction === 'delete' ? 'Deleting…' : 'Delete user'}
            </button>
          </div>
        </Modal>
      )}

      {statusEditRow && (
        <Modal title={`Update KYC status ${statusEditRow.id}`} onClose={() => setStatusEditRow(null)}>
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
            Update the KYC status (and optional comments).
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionSelect">Status</label>
              <select
                id="decisionSelect"
                value={statusDraft.status}
                onChange={(e) => setStatusDraft((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="">Select</option>
                {statusDecisionOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <label htmlFor="decisionComments">Comments (optional)</label>
            <textarea
              id="decisionComments"
              rows={3}
              value={statusDraft.comments}
              onChange={(e) => setStatusDraft((p) => ({ ...p, comments: e.target.value }))}
              placeholder="Add a brief note about the status change"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setStatusEditRow(null)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleStatusUpdate} className="btn-primary">
              Submit
            </button>
          </div>
        </Modal>
      )}

      {levelEditRow && (
        <Modal title={`Change KYC level ${levelEditRow.id}`} onClose={() => setLevelEditRow(null)}>
          <div style={{ color: 'var(--muted)', marginBottom: '0.75rem' }}>
            Update the KYC level only.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="decisionLevel">Level</label>
              <select id="decisionLevel" value={levelDraft.level} onChange={(e) => setLevelDraft((p) => ({ ...p, level: e.target.value }))}>
                <option value="">Select level</option>
                {(levelOptions.length ? levelOptions : Array.from({ length: 8 }, (_, idx) => ({ level: idx, levelDescription: '' }))).map((opt) => (
                  <option key={opt.level} value={opt.level}>
                    {opt.level} {opt.levelDescription ? `- ${opt.levelDescription}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setLevelEditRow(null)} className="btn-neutral">
              Cancel
            </button>
            <button type="button" onClick={handleLevelUpdate} className="btn-primary">
              Submit
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
}
