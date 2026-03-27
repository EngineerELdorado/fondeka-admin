'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = { currency: '', displayName: '', rate: '', ask: '', bid: '', active: true };

const toPayload = (state) => ({
  currency: state.currency,
  displayName: state.displayName,
  rate: state.rate === '' ? null : Number(state.rate),
  ask: state.ask === '' ? null : Number(state.ask),
  bid: state.bid === '' ? null : Number(state.bid),
  active: Boolean(state.active)
});

const formatSpread = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return `${(num * 100).toFixed(2)}%`;
};

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

const WARNING_ERROR_CODE = 'WARNING_MESSAGE';

const resolveFlagEnabled = (response) => {
  if (typeof response === 'boolean') return response;
  if (response && typeof response.enabled === 'boolean') return response.enabled;
  return true;
};

const cryptoProductRailFlagKey = (cryptoProductId, flow) => `crypto.product.${cryptoProductId}.${flow}.enabled`;
const cryptoProductRailStateKey = (cryptoProductId, flow) => `${cryptoProductId}:${flow}`;

export default function CryptoProductsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [info, setInfo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [draft, setDraft] = useState(emptyState);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [railFlags, setRailFlags] = useState({});
  const [railFlagsLoading, setRailFlagsLoading] = useState({});
  const [railFlagsSaving, setRailFlagsSaving] = useState({});
  const [overrideModal, setOverrideModal] = useState(null);
  const [overrideAccountId, setOverrideAccountId] = useState('');
  const [overrideAccountEnabled, setOverrideAccountEnabled] = useState(true);
  const [overrideEmail, setOverrideEmail] = useState('');
  const [overrideEmailEnabled, setOverrideEmailEnabled] = useState(true);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState(null);

  const getRailEnabled = (cryptoProductId, flow) => {
    const key = cryptoProductRailStateKey(cryptoProductId, flow);
    const value = railFlags[key];
    return typeof value === 'boolean' ? value : true;
  };

  const isRailLoading = (cryptoProductId, flow) => Boolean(railFlagsLoading[cryptoProductRailStateKey(cryptoProductId, flow)]);
  const isRailSaving = (cryptoProductId, flow) => Boolean(railFlagsSaving[cryptoProductRailStateKey(cryptoProductId, flow)]);

  const loadRailFlags = async (products) => {
    const targets = (products || [])
      .filter((row) => row?.id !== null && row?.id !== undefined)
      .flatMap((row) => [
        { cryptoProductId: row.id, flow: 'collection' },
        { cryptoProductId: row.id, flow: 'payout' }
      ]);
    if (targets.length === 0) return;

    setRailFlagsLoading((prev) => {
      const next = { ...prev };
      targets.forEach(({ cryptoProductId, flow }) => {
        next[cryptoProductRailStateKey(cryptoProductId, flow)] = true;
      });
      return next;
    });

    const settled = await Promise.allSettled(
      targets.map(async ({ cryptoProductId, flow }) => {
        try {
          const res = await api.featureFlags.get(cryptoProductRailFlagKey(cryptoProductId, flow));
          return { cryptoProductId, flow, enabled: resolveFlagEnabled(res) };
        } catch (err) {
          if (err?.status === 404) {
            return { cryptoProductId, flow, enabled: true };
          }
          return { cryptoProductId, flow, enabled: true, error: err };
        }
      })
    );

    setRailFlags((prev) => {
      const next = { ...prev };
      settled.forEach((result, index) => {
        const fallback = targets[index];
        const payload = result.status === 'fulfilled' ? result.value : { ...fallback, enabled: true };
        next[cryptoProductRailStateKey(payload.cryptoProductId, payload.flow)] = Boolean(payload.enabled);
      });
      return next;
    });

    setRailFlagsLoading((prev) => {
      const next = { ...prev };
      targets.forEach(({ cryptoProductId, flow }) => {
        next[cryptoProductRailStateKey(cryptoProductId, flow)] = false;
      });
      return next;
    });
  };

  const updateRailFlag = async (row, flow, enabled) => {
    if (!row?.id) return;
    const stateKey = cryptoProductRailStateKey(row.id, flow);
    setError(null);
    setWarning(null);
    setInfo(null);
    setRailFlagsSaving((prev) => ({ ...prev, [stateKey]: true }));
    try {
      const key = cryptoProductRailFlagKey(row.id, flow);
      await api.featureFlags.update(key, { enabled: Boolean(enabled) });
      setRailFlags((prev) => ({ ...prev, [stateKey]: Boolean(enabled) }));
      setInfo(`${row.displayName || row.currency || `Crypto product ${row.id}`} ${flow} ${enabled ? 'enabled' : 'blocked'}.`);
    } catch (err) {
      const message = err?.message || `Failed to update ${flow} gate`;
      if (err?.data?.errorCode === WARNING_ERROR_CODE) {
        setWarning(message);
      } else {
        setError(message);
      }
    } finally {
      setRailFlagsSaving((prev) => ({ ...prev, [stateKey]: false }));
    }
  };

  const openRailOverride = (row, flow) => {
    if (!row?.id) return;
    const featureFlagKey = cryptoProductRailFlagKey(row.id, flow);
    setOverrideModal({
      featureFlagKey,
      label: `${row.displayName || row.currency || `Crypto product ${row.id}`} - ${flow}`
    });
    setOverrideAccountId('');
    setOverrideAccountEnabled(true);
    setOverrideEmail('');
    setOverrideEmailEnabled(true);
    setOverrideError(null);
  };

  const upsertAccountOverride = async () => {
    const target = String(overrideAccountId || '').trim();
    if (!overrideModal?.featureFlagKey || !target) {
      setOverrideError('Account ID is required');
      return;
    }
    setOverrideSaving(true);
    setOverrideError(null);
    setError(null);
    setWarning(null);
    setInfo(null);
    try {
      await api.featureFlags.upsertOverride(overrideModal.featureFlagKey, target, { enabled: Boolean(overrideAccountEnabled) });
      setInfo(`Account override saved for ${overrideModal.featureFlagKey}.`);
    } catch (err) {
      const message = err?.message || 'Failed to save account override';
      if (err?.data?.errorCode === WARNING_ERROR_CODE) setWarning(message);
      else setOverrideError(message);
    } finally {
      setOverrideSaving(false);
    }
  };

  const removeAccountOverride = async () => {
    const target = String(overrideAccountId || '').trim();
    if (!overrideModal?.featureFlagKey || !target) {
      setOverrideError('Account ID is required');
      return;
    }
    setOverrideSaving(true);
    setOverrideError(null);
    try {
      await api.featureFlags.removeOverride(overrideModal.featureFlagKey, target);
      setInfo(`Account override removed for ${overrideModal.featureFlagKey}.`);
    } catch (err) {
      setOverrideError(err?.message || 'Failed to remove account override');
    } finally {
      setOverrideSaving(false);
    }
  };

  const upsertEmailOverride = async () => {
    const target = String(overrideEmail || '').trim();
    if (!overrideModal?.featureFlagKey || !target) {
      setOverrideError('Email is required');
      return;
    }
    setOverrideSaving(true);
    setOverrideError(null);
    setError(null);
    setWarning(null);
    setInfo(null);
    try {
      await api.featureFlags.upsertOverrideByEmail(overrideModal.featureFlagKey, target, { enabled: Boolean(overrideEmailEnabled) });
      setInfo(`Email override saved for ${overrideModal.featureFlagKey}.`);
    } catch (err) {
      const message = err?.message || 'Failed to save email override';
      if (err?.data?.errorCode === WARNING_ERROR_CODE) setWarning(message);
      else setOverrideError(message);
    } finally {
      setOverrideSaving(false);
    }
  };

  const removeEmailOverride = async () => {
    const target = String(overrideEmail || '').trim();
    if (!overrideModal?.featureFlagKey || !target) {
      setOverrideError('Email is required');
      return;
    }
    setOverrideSaving(true);
    setOverrideError(null);
    try {
      await api.featureFlags.removeOverrideByEmail(overrideModal.featureFlagKey, target);
      setInfo(`Email override removed for ${overrideModal.featureFlagKey}.`);
    } catch (err) {
      setOverrideError(err?.message || 'Failed to remove email override');
    } finally {
      setOverrideSaving(false);
    }
  };

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.cryptoProducts.list(params);
      const list = Array.isArray(res) ? res : res?.content || [];
      setRows(list || []);
      await loadRailFlags(list || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'currency', label: 'Currency' },
    { key: 'displayName', label: 'Display name' },
    { key: 'rate', label: 'Rate' },
    { key: 'ask', label: 'Ask spread', render: (row) => formatSpread(row.ask) },
    { key: 'bid', label: 'Bid spread', render: (row) => formatSpread(row.bid) },
    { key: 'active', label: 'Active' },
    {
      key: 'collectionGate',
      label: 'Collection Enabled',
      render: (row) => {
        if (!row?.id) return '—';
        const loadingRail = isRailLoading(row.id, 'collection');
        const savingRail = isRailSaving(row.id, 'collection');
        const enabled = getRailEnabled(row.id, 'collection');
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={loadingRail || savingRail}
                onChange={(e) => updateRailFlag(row, 'collection', e.target.checked)}
              />
              <span>{loadingRail || savingRail ? 'Updating…' : enabled ? 'On' : 'Off'}</span>
            </label>
            <button type="button" className="btn-neutral btn-sm" onClick={() => openRailOverride(row, 'collection')}>
              Override
            </button>
          </div>
        );
      }
    },
    {
      key: 'payoutGate',
      label: 'Payout Enabled',
      render: (row) => {
        if (!row?.id) return '—';
        const loadingRail = isRailLoading(row.id, 'payout');
        const savingRail = isRailSaving(row.id, 'payout');
        const enabled = getRailEnabled(row.id, 'payout');
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="checkbox"
                checked={enabled}
                disabled={loadingRail || savingRail}
                onChange={(e) => updateRailFlag(row, 'payout', e.target.checked)}
              />
              <span>{loadingRail || savingRail ? 'Updating…' : enabled ? 'On' : 'Off'}</span>
            </label>
            <button type="button" className="btn-neutral btn-sm" onClick={() => openRailOverride(row, 'payout')}>
              Override
            </button>
          </div>
        );
      }
    },
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
  ];

  const openCreate = () => {
    setDraft(emptyState);
    setShowCreate(true);
    setInfo(null);
    setError(null);
    setWarning(null);
  };

  const openEdit = (row) => {
    setSelected(row);
    setDraft({
      currency: row.currency ?? '',
      displayName: row.displayName ?? '',
      rate: row.rate ?? '',
      ask: row.ask != null ? Number(row.ask) * 100 : '',
      bid: row.bid != null ? Number(row.bid) * 100 : '',
      active: Boolean(row.active)
    });
    setShowEdit(true);
    setInfo(null);
    setError(null);
    setWarning(null);
  };

  const openDetail = (row) => {
    setSelected(row);
    setShowDetail(true);
    setInfo(null);
    setError(null);
    setWarning(null);
  };

  const handleCreate = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.cryptoProducts.create(toPayload(draft));
      setInfo('Created crypto product.');
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
      await api.cryptoProducts.update(selected.id, toPayload(draft));
      setInfo(`Updated crypto product ${selected.id}.`);
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
      await api.cryptoProducts.remove(id);
      setInfo(`Deleted crypto product ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="currency">Currency</label>
        <input id="currency" value={draft.currency} onChange={(e) => setDraft((p) => ({ ...p, currency: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="displayName">Display name</label>
        <input id="displayName" value={draft.displayName} onChange={(e) => setDraft((p) => ({ ...p, displayName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rate">Rate</label>
        <input id="rate" type="number" value={draft.rate} onChange={(e) => setDraft((p) => ({ ...p, rate: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="ask">Ask spread (%)</label>
        <input
          id="ask"
          type="number"
          min={0}
          max={100}
          step="0.0000000001"
          value={draft.ask}
          onChange={(e) => setDraft((p) => ({ ...p, ask: e.target.value }))}
          placeholder="2 = 2%"
        />
        <small style={{ color: 'var(--muted)' }}>Enter percent as a number (e.g., 2 = 2%).</small>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="bid">Bid spread (%)</label>
        <input
          id="bid"
          type="number"
          min={0}
          max={100}
          step="0.0000000001"
          value={draft.bid}
          onChange={(e) => setDraft((p) => ({ ...p, bid: e.target.value }))}
          placeholder="1 = 1%"
        />
        <small style={{ color: 'var(--muted)' }}>Enter percent as a number (e.g., 1 = 1%).</small>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input id="active" type="checkbox" checked={draft.active} onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))} />
        <label htmlFor="active">Active</label>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Crypto Products</div>
          <div style={{ color: 'var(--muted)' }}>Currencies with display name and rates.</div>
        </div>
        <Link href="/dashboard/crypto" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Crypto hub
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
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button type="button" onClick={openCreate} className="btn-success">
          Add crypto product
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {warning && <div className="card" style={{ color: '#a16207', background: '#fffbeb', border: '1px solid #fcd34d', fontWeight: 700 }}>{warning}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No crypto products found" />

      {showCreate && (
        <Modal title="Add crypto product" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit crypto product ${selected?.id}`} onClose={() => setShowEdit(false)}>
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
              { label: 'Currency', value: selected?.currency },
              { label: 'Display name', value: selected?.displayName },
              { label: 'Rate', value: selected?.rate },
              { label: 'Ask spread', value: formatSpread(selected?.ask) },
              { label: 'Bid spread', value: formatSpread(selected?.bid) },
              { label: 'Active', value: String(selected?.active) }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete crypto product <strong>{confirmDelete.currency || confirmDelete.id}</strong>? This cannot be undone.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </Modal>
      )}

      {overrideModal && (
        <Modal title={`Rail override: ${overrideModal.label}`} onClose={() => (!overrideSaving ? setOverrideModal(null) : null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
              Feature flag key: <code>{overrideModal.featureFlagKey}</code>
            </div>

            <div style={{ display: 'grid', gap: '0.5rem', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.65rem' }}>
              <div style={{ fontWeight: 700 }}>Override by account ID</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  placeholder="Account ID"
                  value={overrideAccountId}
                  onChange={(e) => setOverrideAccountId(e.target.value)}
                />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input
                    type="checkbox"
                    checked={overrideAccountEnabled}
                    onChange={(e) => setOverrideAccountEnabled(e.target.checked)}
                  />
                  Enabled
                </label>
                <button type="button" className="btn-primary btn-sm" disabled={overrideSaving} onClick={upsertAccountOverride}>
                  Set
                </button>
                <button type="button" className="btn-danger btn-sm" disabled={overrideSaving} onClick={removeAccountOverride}>
                  Remove
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.5rem', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.65rem' }}>
              <div style={{ fontWeight: 700 }}>Override by email</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={overrideEmail}
                  onChange={(e) => setOverrideEmail(e.target.value)}
                />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input
                    type="checkbox"
                    checked={overrideEmailEnabled}
                    onChange={(e) => setOverrideEmailEnabled(e.target.checked)}
                  />
                  Enabled
                </label>
                <button type="button" className="btn-primary btn-sm" disabled={overrideSaving} onClick={upsertEmailOverride}>
                  Set
                </button>
                <button type="button" className="btn-danger btn-sm" disabled={overrideSaving} onClick={removeEmailOverride}>
                  Remove
                </button>
              </div>
            </div>

            {overrideError && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{overrideError}</div>}
            <div className="modal-actions">
              <button type="button" className="btn-neutral" onClick={() => setOverrideModal(null)} disabled={overrideSaving}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
