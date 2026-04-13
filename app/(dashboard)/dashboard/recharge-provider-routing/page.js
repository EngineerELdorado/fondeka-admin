'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/DataTable';
import { api } from '@/lib/api';

const rechargeTypeOptions = ['AIRTIME', 'DATA', 'BUNDLE'];
const providerOptions = ['RELOADLY', 'ZENDIT'];
const emptyDraft = {
  rechargeType: '',
  countryCode: '',
  providerName: '',
  rank: '1',
  active: true
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
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
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

const formatCountry = (value) => {
  const next = String(value || '').trim().toUpperCase();
  return next || 'Global';
};

const formatRechargeType = (value) => {
  const next = String(value || '').trim().toUpperCase();
  return next || 'Fallback';
};

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

export default function RechargeProviderRoutingPage() {
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
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      const res = await api.rechargeProviderRouting.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      setPageMeta({
        totalElements: typeof res?.totalElements === 'number' ? res.totalElements : null,
        totalPages: typeof res?.totalPages === 'number' ? res.totalPages : null
      });
    } catch (err) {
      setError(err.message || 'Failed to load recharge provider routing rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateDraft = () => {
    const providerName = String(draft.providerName || '').trim();
    const rechargeType = String(draft.rechargeType || '').trim();
    const rank = Number(draft.rank);
    const countryCode = String(draft.countryCode || '').trim().toUpperCase();
    if (!providerName) return 'Provider is required.';
    if (rechargeType && !rechargeTypeOptions.includes(rechargeType)) return 'Recharge type is invalid.';
    if (!providerOptions.includes(providerName)) return 'Provider is invalid.';
    if (!Number.isInteger(rank) || rank < 0) return 'Rank must be an integer greater than or equal to 0.';
    if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) return 'Country must be a 2-letter ISO code.';
    return null;
  };

  const buildPayload = () => ({
    rechargeType: String(draft.rechargeType || '').trim() || null,
    countryCode: String(draft.countryCode || '').trim().toUpperCase() || null,
    providerName: String(draft.providerName || '').trim(),
    rank: Number(draft.rank),
    active: Boolean(draft.active)
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
      rechargeType: row.rechargeType ?? '',
      countryCode: row.countryCode ?? '',
      providerName: row.providerName ?? '',
      rank: row.rank === null || row.rank === undefined ? '1' : String(row.rank),
      active: Boolean(row.active)
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
      const data = await api.rechargeProviderRouting.get(row.id);
      setSelected(data || row);
      setShowDetail(true);
    } catch (err) {
      setError(err.message || `Failed to load recharge routing rule ${row.id}.`);
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
      await api.rechargeProviderRouting.create(buildPayload());
      setInfo('Created recharge routing rule.');
      setShowCreate(false);
      fetchRows();
    } catch (err) {
      setError(err.message || 'Failed to create recharge routing rule.');
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
      await api.rechargeProviderRouting.update(selected.id, buildPayload());
      setInfo(`Updated recharge routing rule ${selected.id}.`);
      setShowEdit(false);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to update recharge routing rule ${selected.id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirmDeactivate?.id) return;
    const id = confirmDeactivate.id;
    setActionLoading(true);
    setError(null);
    setInfo(null);
    try {
      await api.rechargeProviderRouting.update(id, {
        rechargeType: confirmDeactivate.rechargeType ?? null,
        countryCode: confirmDeactivate.countryCode ?? null,
        providerName: confirmDeactivate.providerName,
        rank: confirmDeactivate.rank,
        active: false
      });
      setConfirmDeactivate(null);
      setInfo(`Deactivated recharge routing rule ${id}.`);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to deactivate recharge routing rule ${id}.`);
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
      await api.rechargeProviderRouting.remove(id);
      setConfirmDelete(null);
      setInfo(`Deleted recharge routing rule ${id}.`);
      fetchRows();
    } catch (err) {
      setError(err.message || `Failed to delete recharge routing rule ${id}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const canPrev = page > 0;
  const canNext = pageMeta.totalPages === null ? rows.length === size : page + 1 < pageMeta.totalPages;

  const columns = useMemo(
    () => [
      { key: 'id', label: 'ID' },
      { key: 'rechargeType', label: 'Recharge Type', render: (row) => formatRechargeType(row.rechargeType) },
      { key: 'countryCode', label: 'Country', render: (row) => formatCountry(row.countryCode) },
      { key: 'providerName', label: 'Provider' },
      { key: 'rank', label: 'Rank' },
      { key: 'active', label: 'Active', render: (row) => <StatusBadge active={Boolean(row.active)} /> },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => openDetail(row)} className="btn-neutral" disabled={actionLoading}>
              View
            </button>
            <button type="button" onClick={() => openEdit(row)} className="btn-neutral" disabled={actionLoading}>
              Edit
            </button>
            {row.active && (
              <button type="button" onClick={() => setConfirmDeactivate(row)} className="btn-neutral" disabled={actionLoading}>
                Deactivate
              </button>
            )}
            <button type="button" onClick={() => setConfirmDelete(row)} className="btn-danger" disabled={actionLoading}>
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
        Use one global default per recharge type first. Add country-specific rules only when you need an override. Lower rank wins among equally specific rules.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="rechargeType">Recharge type</label>
          <select id="rechargeType" value={draft.rechargeType} onChange={(e) => setDraft((p) => ({ ...p, rechargeType: e.target.value }))}>
            <option value="">Generic fallback</option>
            {rechargeTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label htmlFor="countryCode">Country</label>
          <input
            id="countryCode"
            value={draft.countryCode}
            onChange={(e) => setDraft((p) => ({ ...p, countryCode: e.target.value.toUpperCase() }))}
            placeholder="Global"
            maxLength={2}
          />
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
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Recharge Provider Routing</div>
          <div style={{ color: 'var(--muted)' }}>
            Operational routing rules for AIRTIME, DATA, and BUNDLE. The app stays provider-agnostic and backend resolution uses these rules for both catalog lookup and fulfillment.
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            More specific rules win over generic ones. If specificity ties, lower rank wins. If nothing matches, backend falls back to the legacy global airtime provider.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={openCreate}>
            Add rule
          </button>
          <Link href="/dashboard" className="btn-neutral">
            {'<- Dashboard'}
          </Link>
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontWeight: 700 }}>Admin guidance</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Use one global default per recharge type. Add country-specific overrides carefully, and deactivate old rules instead of relying on ambiguous overlaps.</div>
        <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Changing these rules affects live routing. Treat them as operational controls, not cosmetic settings.</div>
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
              const nextSize = Math.max(1, Number(e.target.value) || 1);
              setSize(nextSize);
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
        emptyLabel="No recharge routing rules found."
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
        <Modal title="Add recharge routing rule" onClose={() => (!actionLoading ? setShowCreate(false) : null)}>
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
        <Modal title={`Edit recharge routing rule ${selected?.id || ''}`} onClose={() => (!actionLoading ? setShowEdit(false) : null)}>
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
        <Modal title={`Recharge routing rule ${selected.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected.id },
              { label: 'Recharge type', value: formatRechargeType(selected.rechargeType) },
              { label: 'Country', value: formatCountry(selected.countryCode) },
              { label: 'Provider', value: selected.providerName || '-' },
              { label: 'Rank', value: selected.rank },
              { label: 'Active', value: selected.active ? 'Yes' : 'No' },
              { label: 'Created', value: formatDateTime(selected.createdAt) },
              { label: 'Updated', value: formatDateTime(selected.updatedAt) }
            ]}
          />
        </Modal>
      )}

      {confirmDeactivate && (
        <Modal title="Deactivate recharge routing rule" onClose={() => (!actionLoading ? setConfirmDeactivate(null) : null)}>
          <div style={{ color: 'var(--muted)' }}>
            Deactivate rule {confirmDeactivate.id}? This stops it from matching new routing requests without deleting the record.
          </div>
          <DetailGrid
            rows={[
              { label: 'Recharge type', value: formatRechargeType(confirmDeactivate.rechargeType) },
              { label: 'Country', value: formatCountry(confirmDeactivate.countryCode) },
              { label: 'Provider', value: confirmDeactivate.providerName },
              { label: 'Rank', value: confirmDeactivate.rank }
            ]}
          />
          <div className="modal-actions">
            <button type="button" className="btn-neutral" onClick={() => setConfirmDeactivate(null)} disabled={actionLoading}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleDeactivate} disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Deactivate'}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete recharge routing rule" onClose={() => (!actionLoading ? setConfirmDelete(null) : null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete rule {confirmDelete.id}? This permanently removes it.
          </div>
          <DetailGrid
            rows={[
              { label: 'Recharge type', value: formatRechargeType(confirmDelete.rechargeType) },
              { label: 'Country', value: formatCountry(confirmDelete.countryCode) },
              { label: 'Provider', value: confirmDelete.providerName },
              { label: 'Rank', value: confirmDelete.rank }
            ]}
          />
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
