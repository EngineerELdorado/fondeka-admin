'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const emptyDraft = {
  countryCode: 'CD',
  operatorNamePattern: '',
  phoneNumberPrefixes: '97,98,99',
  enabled: false,
  disabledMessageEn: '',
  disabledMessageFr: '',
  rank: '10'
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

const EnabledBadge = ({ enabled }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '0.2rem 0.5rem',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 700,
      background: enabled ? '#ECFDF3' : '#FEF2F2',
      color: enabled ? '#15803D' : '#B91C1C'
    }}
  >
    {enabled ? 'ENABLED' : 'BLOCKED'}
  </span>
);

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const normalizeList = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.content)) return res.content;
  if (Array.isArray(res?.items)) return res.items;
  return [];
};

export default function AirtimeOperatorFeatureFlagOverridesPage() {
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
  const [confirmToggle, setConfirmToggle] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      const res = await api.airtimeOperatorFeatureFlagOverrides.list(params);
      const list = normalizeList(res);
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : typeof res?.totalItems === 'number' ? res.totalItems : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setRows([]);
      setPageMeta({ totalElements: null, totalPages: null });
      setError(err?.message || 'Failed to load airtime operator overrides.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateDraft = () => {
    const countryCode = String(draft.countryCode || '').trim().toUpperCase();
    const operatorNamePattern = String(draft.operatorNamePattern || '').trim();
    const phoneNumberPrefixes = String(draft.phoneNumberPrefixes || '').trim();
    const rank = Number(draft.rank);
    if (!/^[A-Z]{2}$/.test(countryCode)) return 'Country must be a 2-letter ISO code.';
    if (!operatorNamePattern) return 'Operator name pattern is required.';
    if (phoneNumberPrefixes && !/^\d+(?:\s*,\s*\d+)*$/.test(phoneNumberPrefixes)) return 'Phone number prefixes must be comma-separated digits, for example 97,98,99.';
    if (!Number.isInteger(rank) || rank < 0) return 'Rank must be an integer greater than or equal to 0.';
    return null;
  };

  const buildPayload = () => ({
    countryCode: String(draft.countryCode || '').trim().toUpperCase(),
    operatorNamePattern: String(draft.operatorNamePattern || '').trim(),
    phoneNumberPrefixes: String(draft.phoneNumberPrefixes || '').trim(),
    enabled: Boolean(draft.enabled),
    disabledMessageEn: String(draft.disabledMessageEn || '').trim(),
    disabledMessageFr: String(draft.disabledMessageFr || '').trim(),
    rank: Number(draft.rank)
  });

  const payloadFromRow = (row, overrides = {}) => ({
    countryCode: String(row?.countryCode || '').trim().toUpperCase(),
    operatorNamePattern: String(row?.operatorNamePattern || '').trim(),
    phoneNumberPrefixes: String(row?.phoneNumberPrefixes || '').trim(),
    enabled: Boolean(row?.enabled),
    disabledMessageEn: String(row?.disabledMessageEn || '').trim(),
    disabledMessageFr: String(row?.disabledMessageFr || '').trim(),
    rank: Number(row?.rank || 0),
    ...overrides
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
      operatorNamePattern: row.operatorNamePattern ?? '',
      phoneNumberPrefixes: row.phoneNumberPrefixes ?? '',
      enabled: Boolean(row.enabled),
      disabledMessageEn: row.disabledMessageEn ?? '',
      disabledMessageFr: row.disabledMessageFr ?? '',
      rank: row.rank === null || row.rank === undefined ? '10' : String(row.rank)
    });
    setShowEdit(true);
    setError(null);
    setInfo(null);
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
      await api.airtimeOperatorFeatureFlagOverrides.create(buildPayload());
      setInfo('Created airtime operator override.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err?.message || 'Failed to create airtime operator override.');
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
      await api.airtimeOperatorFeatureFlagOverrides.update(selected.id, buildPayload());
      setInfo(`Updated airtime operator override ${selected.id}.`);
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err?.message || `Failed to update airtime operator override ${selected.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!confirmToggle?.id) return;
    const id = confirmToggle.id;
    const nextEnabled = !Boolean(confirmToggle.enabled);
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.airtimeOperatorFeatureFlagOverrides.update(id, payloadFromRow(confirmToggle, { enabled: nextEnabled }));
      setInfo(`${nextEnabled ? 'Enabled' : 'Blocked'} airtime operator override ${id}.`);
      setConfirmToggle(null);
      fetchRows();
    } catch (err) {
      setError(err?.message || `Failed to update airtime operator override ${id}.`);
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
      await api.airtimeOperatorFeatureFlagOverrides.remove(id);
      setConfirmDelete(null);
      setInfo(`Deleted airtime operator override ${id}.`);
      fetchRows();
    } catch (err) {
      setError(err?.message || `Failed to delete airtime operator override ${id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size : page + 1 < pageMeta.totalPages;

  const detailRows = (row) => [
    { label: 'ID', value: row?.id },
    { label: 'Country', value: row?.countryCode },
    { label: 'Operator pattern', value: row?.operatorNamePattern },
    { label: 'Phone prefixes', value: row?.phoneNumberPrefixes || '-' },
    { label: 'Enabled', value: row?.enabled ? 'Yes' : 'No' },
    { label: 'English message', value: row?.disabledMessageEn || '-' },
    { label: 'French message', value: row?.disabledMessageFr || '-' },
    { label: 'Rank', value: row?.rank },
    { label: 'Created', value: formatDateTime(row?.createdAt) },
    { label: 'Updated', value: formatDateTime(row?.updatedAt) }
  ];

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'countryCode', label: 'Country' },
      { key: 'operatorNamePattern', label: 'Operator Pattern' },
      { key: 'phoneNumberPrefixes', label: 'Phone Prefixes', render: (row) => row.phoneNumberPrefixes || '-' },
      { key: 'enabled', label: 'Status', render: (row) => <EnabledBadge enabled={Boolean(row.enabled)} /> },
      { key: 'disabledMessageEn', label: 'English Message', render: (row) => row.disabledMessageEn || '-' },
      { key: 'disabledMessageFr', label: 'French Message', render: (row) => row.disabledMessageFr || '-' },
      { key: 'rank', label: 'Rank' },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => { setSelected(row); setShowDetail(true); }} className="btn-neutral btn-sm" disabled={actionLoading}>
              View
            </button>
            <button type="button" onClick={() => openEdit(row)} className="btn-neutral btn-sm" disabled={actionLoading}>
              Edit
            </button>
            <button type="button" onClick={() => setConfirmToggle(row)} className="btn-neutral btn-sm" disabled={actionLoading}>
              {row.enabled ? 'Block' : 'Enable'}
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
        AIRTIME only. If no matching override exists, airtime works normally. Set enabled to false to block matching airtime purchases before transaction creation.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="countryCode">Country code</label>
          <input id="countryCode" value={draft.countryCode} onChange={(e) => setDraft((p) => ({ ...p, countryCode: e.target.value.toUpperCase() }))} placeholder="CD" maxLength={2} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="operatorNamePattern">Operator name pattern</label>
          <input id="operatorNamePattern" value={draft.operatorNamePattern} onChange={(e) => setDraft((p) => ({ ...p, operatorNamePattern: e.target.value }))} placeholder="Airtel" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="phoneNumberPrefixes">Phone number prefixes</label>
          <input id="phoneNumberPrefixes" value={draft.phoneNumberPrefixes} onChange={(e) => setDraft((p) => ({ ...p, phoneNumberPrefixes: e.target.value }))} placeholder="97,98,99" />
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Optional comma-separated prefixes. Leave blank to match by country and operator only.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="rank">Rank</label>
          <input id="rank" type="number" min={0} step={1} value={draft.rank} onChange={(e) => setDraft((p) => ({ ...p, rank: e.target.value }))} />
        </div>
      </div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
        <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft((p) => ({ ...p, enabled: e.target.checked }))} />
        Enabled
      </label>
      <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Unchecked means matching airtime purchases are blocked.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="disabledMessageEn">Disabled message, English</label>
          <textarea id="disabledMessageEn" rows={3} value={draft.disabledMessageEn} onChange={(e) => setDraft((p) => ({ ...p, disabledMessageEn: e.target.value }))} placeholder="Airtel airtime is currently unavailable. Please try again later." />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="disabledMessageFr">Disabled message, French</label>
          <textarea id="disabledMessageFr" rows={3} value={draft.disabledMessageFr} onChange={(e) => setDraft((p) => ({ ...p, disabledMessageFr: e.target.value }))} placeholder="Le credit telephonique Airtel est actuellement indisponible. Veuillez reessayer plus tard." />
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Airtime Operator Overrides</div>
          <div style={{ color: 'var(--muted)' }}>
            Block or allow AIRTIME purchases for specific country/operator matches.
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            These overrides do not change DATA, BUNDLE, or the existing recharge operator availability policy behavior.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={openCreate}>
            Add override
          </button>
          <Link href="/dashboard" className="btn-neutral">
            {'<- Dashboard'}
          </Link>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontWeight: 700 }}>Admin guidance</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          To block Airtel CD airtime, configure CD + Airtel + prefixes 97,98,99 with enabled unchecked.
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
          An enabled override does not block; it explicitly allows the matching operator and leaves runtime behavior unchanged.
        </div>
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
        emptyLabel={loading ? 'Loading airtime operator overrides...' : 'No airtime operator overrides found.'}
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
        <Modal title="Add airtime operator override" onClose={() => (!actionLoading ? setShowCreate(false) : null)}>
          {renderForm()}
          <div className="modal-actions">
            <button type="button" className="btn-neutral" onClick={() => setShowCreate(false)} disabled={actionLoading}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleCreate} disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Create'}
            </button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit airtime operator override ${selected?.id || ''}`} onClose={() => (!actionLoading ? setShowEdit(false) : null)}>
          {renderForm()}
          <div className="modal-actions">
            <button type="button" className="btn-neutral" onClick={() => setShowEdit(false)} disabled={actionLoading}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleUpdate} disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Update'}
            </button>
          </div>
        </Modal>
      )}

      {showDetail && selected && (
        <Modal title={`Airtime operator override ${selected.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid rows={detailRows(selected)} />
        </Modal>
      )}

      {confirmToggle && (
        <Modal title={`${confirmToggle.enabled ? 'Block' : 'Enable'} airtime operator`} onClose={() => (!actionLoading ? setConfirmToggle(null) : null)}>
          <div style={{ color: 'var(--muted)' }}>
            {confirmToggle.enabled ? 'Block' : 'Enable'} airtime operator override {confirmToggle.id}?
          </div>
          <DetailGrid rows={detailRows(confirmToggle).slice(1, 6)} />
          <div className="modal-actions">
            <button type="button" className="btn-neutral" onClick={() => setConfirmToggle(null)} disabled={actionLoading}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleToggleEnabled} disabled={actionLoading}>
              {actionLoading ? 'Saving...' : confirmToggle.enabled ? 'Block' : 'Enable'}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete airtime operator override" onClose={() => (!actionLoading ? setConfirmDelete(null) : null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete airtime operator override {confirmDelete.id}? This permanently removes it.
          </div>
          <DetailGrid rows={detailRows(confirmDelete).slice(1, 6)} />
          <div className="modal-actions">
            <button type="button" className="btn-neutral" onClick={() => setConfirmDelete(null)} disabled={actionLoading}>
              Cancel
            </button>
            <button type="button" className="btn-danger" onClick={handleDelete} disabled={actionLoading}>
              {actionLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
