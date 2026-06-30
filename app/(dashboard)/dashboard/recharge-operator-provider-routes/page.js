'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const rechargeTypeOptions = ['AIRTIME', 'DATA', 'BUNDLE'];
const providerOptions = ['RELOADLY', 'ZENDIT'];
const emptyDraft = {
  countryCode: 'CD',
  rechargeType: 'DATA',
  operatorNamePattern: 'Airtel',
  phoneNumberPrefixes: '97,98,99',
  providerName: 'ZENDIT',
  active: true,
  rank: '1'
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface" style={{ gap: '0.75rem' }}>
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

const StatusBadge = ({ active }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.2rem 0.5rem',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 700,
      background: active ? '#ECFDF3' : '#FEF2F2',
      color: active ? '#15803D' : '#B91C1C'
    }}
  >
    {active ? 'ACTIVE' : 'INACTIVE'}
  </span>
);

const normalizeList = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.content)) return res.content;
  if (Array.isArray(res?.items)) return res.items;
  return [];
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function RechargeOperatorProviderRoutesPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [pageMeta, setPageMeta] = useState({ totalElements: null, totalPages: null });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [selected, setSelected] = useState(null);
  const [confirmActive, setConfirmActive] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      const res = await api.rechargeOperatorProviderRoutes.list(params);
      const list = normalizeList(res);
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : typeof res?.totalItems === 'number' ? res.totalItems : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setRows([]);
      setPageMeta({ totalElements: null, totalPages: null });
      setError(err?.message || 'Failed to load recharge operator provider routes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateDraft = () => {
    const countryCode = String(draft.countryCode || '').trim().toUpperCase();
    const rechargeType = String(draft.rechargeType || '').trim().toUpperCase();
    const operatorNamePattern = String(draft.operatorNamePattern || '').trim();
    const phoneNumberPrefixes = String(draft.phoneNumberPrefixes || '').trim();
    const providerName = String(draft.providerName || '').trim().toUpperCase();
    const rank = Number(draft.rank);
    if (!/^[A-Z]{2}$/.test(countryCode)) return 'Country must be a 2-letter ISO code.';
    if (!rechargeTypeOptions.includes(rechargeType)) return 'Recharge type is required.';
    if (!operatorNamePattern) return 'Operator name pattern is required.';
    if (phoneNumberPrefixes && !/^\d+(?:\s*,\s*\d+)*$/.test(phoneNumberPrefixes)) return 'Phone number prefixes must be comma-separated digits, for example 97,98,99.';
    if (!providerOptions.includes(providerName)) return 'Provider is required.';
    if (!Number.isInteger(rank) || rank < 0) return 'Rank must be an integer greater than or equal to 0.';
    return null;
  };

  const buildPayload = () => ({
    countryCode: String(draft.countryCode || '').trim().toUpperCase(),
    rechargeType: String(draft.rechargeType || '').trim().toUpperCase(),
    operatorNamePattern: String(draft.operatorNamePattern || '').trim(),
    phoneNumberPrefixes: String(draft.phoneNumberPrefixes || '').trim(),
    providerName: String(draft.providerName || '').trim().toUpperCase(),
    active: Boolean(draft.active),
    rank: Number(draft.rank)
  });

  const openCreate = () => {
    setDraft(emptyDraft);
    setSelected(null);
    setShowCreate(true);
    setError(null);
    setInfo(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      countryCode: row.countryCode ?? '',
      rechargeType: row.rechargeType ?? '',
      operatorNamePattern: row.operatorNamePattern ?? '',
      phoneNumberPrefixes: row.phoneNumberPrefixes ?? '',
      providerName: row.providerName ?? '',
      active: Boolean(row.active),
      rank: row.rank === null || row.rank === undefined ? '1' : String(row.rank)
    });
    setShowEdit(true);
    setError(null);
    setInfo(null);
  };

  const openDetail = async (row) => {
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      const data = await api.rechargeOperatorProviderRoutes.get(row.id);
      setSelected(data || row);
      setShowDetail(true);
    } catch (err) {
      setError(err?.message || `Failed to load recharge operator provider route ${row.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async () => {
    const message = validateDraft();
    if (message) {
      setError(message);
      return;
    }
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.rechargeOperatorProviderRoutes.create(buildPayload());
      setInfo('Created recharge operator provider route.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err?.message || 'Failed to create recharge operator provider route.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selected?.id) return;
    const message = validateDraft();
    if (message) {
      setError(message);
      return;
    }
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.rechargeOperatorProviderRoutes.update(selected.id, buildPayload());
      setInfo(`Updated recharge operator provider route ${selected.id}.`);
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err?.message || `Failed to update recharge operator provider route ${selected.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateActive = async () => {
    if (!confirmActive?.id) return;
    const id = confirmActive.id;
    const nextActive = !Boolean(confirmActive.active);
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.rechargeOperatorProviderRoutes.updateActive(id, nextActive);
      setInfo(`${nextActive ? 'Activated' : 'Deactivated'} recharge operator provider route ${id}.`);
      setConfirmActive(null);
      fetchRows();
    } catch (err) {
      setError(err?.message || `Failed to update recharge operator provider route ${id}.`);
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
      await api.rechargeOperatorProviderRoutes.remove(id);
      setConfirmDelete(null);
      setInfo(`Deleted recharge operator provider route ${id}.`);
      fetchRows();
    } catch (err) {
      setError(err?.message || `Failed to delete recharge operator provider route ${id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size : page + 1 < pageMeta.totalPages;

  const detailRows = (row) => [
    { label: 'ID', value: row?.id },
    { label: 'Country', value: row?.countryCode },
    { label: 'Recharge type', value: row?.rechargeType },
    { label: 'Operator pattern', value: row?.operatorNamePattern },
    { label: 'Phone prefixes', value: row?.phoneNumberPrefixes || '-' },
    { label: 'Provider', value: row?.providerName },
    { label: 'Rank', value: row?.rank },
    { label: 'Active', value: row?.active ? 'Yes' : 'No' },
    { label: 'Created', value: formatDateTime(row?.createdAt) },
    { label: 'Updated', value: formatDateTime(row?.updatedAt) }
  ];

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'countryCode', label: 'Country' },
      { key: 'rechargeType', label: 'Type' },
      { key: 'operatorNamePattern', label: 'Operator Pattern' },
      { key: 'phoneNumberPrefixes', label: 'Phone Prefixes', render: (row) => row.phoneNumberPrefixes || '-' },
      { key: 'providerName', label: 'Provider' },
      { key: 'rank', label: 'Rank' },
      { key: 'active', label: 'Active', render: (row) => <StatusBadge active={Boolean(row.active)} /> },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openDetail(row)} className="btn-neutral btn-sm" disabled={actionLoading}>
              View
            </button>
            <button type="button" onClick={() => openEdit(row)} className="btn-neutral btn-sm" disabled={actionLoading}>
              Edit
            </button>
            <button type="button" onClick={() => setConfirmActive(row)} className="btn-neutral btn-sm" disabled={actionLoading}>
              {row.active ? 'Deactivate' : 'Activate'}
            </button>
            <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger btn-sm" disabled={actionLoading}>
              Delete
            </button>
          </div>
        )
      }
    ],
    [actionLoading]
  );

  const renderForm = () => (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
        Routes are checked before broad country/type provider routing. Lower rank wins when multiple active routes match.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="countryCode">Country</label>
          <input id="countryCode" value={draft.countryCode} onChange={(e) => setDraft((p) => ({ ...p, countryCode: e.target.value.toUpperCase() }))} placeholder="CD" maxLength={2} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="rechargeType">Recharge type</label>
          <select id="rechargeType" value={draft.rechargeType} onChange={(e) => setDraft((p) => ({ ...p, rechargeType: e.target.value }))}>
            <option value="">Choose type</option>
            {rechargeTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="operatorNamePattern">Operator name pattern</label>
          <input id="operatorNamePattern" value={draft.operatorNamePattern} onChange={(e) => setDraft((p) => ({ ...p, operatorNamePattern: e.target.value }))} placeholder="Airtel" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="phoneNumberPrefixes">Phone number prefixes</label>
          <input id="phoneNumberPrefixes" value={draft.phoneNumberPrefixes} onChange={(e) => setDraft((p) => ({ ...p, phoneNumberPrefixes: e.target.value }))} placeholder="97,98,99" />
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Comma-separated national prefixes after normalization.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="providerName">Provider</label>
          <select id="providerName" value={draft.providerName} onChange={(e) => setDraft((p) => ({ ...p, providerName: e.target.value }))}>
            <option value="">Choose provider</option>
            {providerOptions.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="rank">Rank</label>
          <input id="rank" type="number" min={0} step={1} value={draft.rank} onChange={(e) => setDraft((p) => ({ ...p, rank: e.target.value }))} />
        </div>
      </div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
        <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))} />
        Active
      </label>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Recharge Operator Provider Routes</div>
          <div style={{ color: 'var(--muted)' }}>
            Choose which provider serves data or bundle offers for a specific operator and phone prefix.
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            If no matching routed provider has offers, backend falls back to the broad country/type provider route.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={openCreate}>
            Add route
          </button>
          <Link href="/dashboard" className="btn-neutral">
            {'<- Dashboard'}
          </Link>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontWeight: 700 }}>Production examples</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>CD DATA Vodacom prefixes 81,82 {'->'} RELOADLY</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>CD BUNDLE Vodacom prefixes 81,82 {'->'} RELOADLY</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>CD DATA Airtel prefixes 97,98,99 {'->'} ZENDIT</div>
      </div>

      <div className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="page">Page</label>
          <input id="page" type="number" min={0} value={page} onChange={(e) => setPage(Math.max(0, Number(e.target.value) || 0))} />
        </div>
        <div>
          <label htmlFor="size">Size</label>
          <input
            id="size"
            type="number"
            min={1}
            max={200}
            value={size}
            onChange={(e) => {
              setSize(Math.max(1, Number(e.target.value) || 1));
              setPage(0);
            }}
          />
        </div>
        <button type="button" className="btn-neutral" onClick={fetchRows} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable
        columns={columns}
        rows={rows}
        emptyLabel={loading ? 'Loading recharge operator provider routes...' : 'No recharge operator provider routes found.'}
        page={page}
        pageSize={size}
        totalPages={pageMeta.totalPages}
        totalElements={pageMeta.totalElements}
        onPageChange={setPage}
        canPrev={canPrev}
        canNext={canNext}
        showAccountQuickNav={false}
      />

      {showCreate && (
        <Modal title="Add recharge operator provider route" onClose={() => (!actionLoading ? setShowCreate(false) : null)}>
          {renderForm()}
          <div className="modal-actions">
            <button type="button" className="btn-neutral" onClick={() => setShowCreate(false)} disabled={actionLoading}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleCreate} disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Create'}</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit recharge operator provider route ${selected?.id || ''}`} onClose={() => (!actionLoading ? setShowEdit(false) : null)}>
          {renderForm()}
          <div className="modal-actions">
            <button type="button" className="btn-neutral" onClick={() => setShowEdit(false)} disabled={actionLoading}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleUpdate} disabled={actionLoading}>{actionLoading ? 'Saving...' : 'Update'}</button>
          </div>
        </Modal>
      )}

      {showDetail && selected && (
        <Modal title={`Recharge operator provider route ${selected.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid rows={detailRows(selected)} />
        </Modal>
      )}

      {confirmActive && (
        <Modal title={`${confirmActive.active ? 'Deactivate' : 'Activate'} route`} onClose={() => (!actionLoading ? setConfirmActive(null) : null)}>
          <div style={{ color: 'var(--muted)' }}>{confirmActive.active ? 'Deactivate' : 'Activate'} route {confirmActive.id}?</div>
          <DetailGrid rows={detailRows(confirmActive).slice(1, 7)} />
          <div className="modal-actions">
            <button type="button" className="btn-neutral" onClick={() => setConfirmActive(null)} disabled={actionLoading}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleUpdateActive} disabled={actionLoading}>
              {actionLoading ? 'Saving...' : confirmActive.active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete recharge operator provider route" onClose={() => (!actionLoading ? setConfirmDelete(null) : null)}>
          <div style={{ color: 'var(--muted)' }}>Delete route {confirmDelete.id}? This permanently removes it.</div>
          <DetailGrid rows={detailRows(confirmDelete).slice(1, 7)} />
          <div className="modal-actions">
            <button type="button" className="btn-neutral" onClick={() => setConfirmDelete(null)} disabled={actionLoading}>Cancel</button>
            <button type="button" className="btn-danger" onClick={handleDelete} disabled={actionLoading}>{actionLoading ? 'Deleting...' : 'Delete'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
