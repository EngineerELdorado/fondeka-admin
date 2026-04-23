'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = { name: '', alpha2Code: '', alpha3Code: '', defaultKycLevel: '', registrationBlocked: false };
const SAVINGS_ENABLED_KEY = 'savings.enabled';

const toPayload = (state) => {
  const payload = {
    name: state.name,
    alpha2Code: state.alpha2Code,
    alpha3Code: state.alpha3Code
  };
  if (state.defaultKycLevel !== undefined) {
    payload.defaultKycLevel = state.defaultKycLevel === '' ? null : state.defaultKycLevel;
  }
  payload.registrationBlocked = Boolean(state.registrationBlocked);
  return payload;
};

const parseLevelInput = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return NaN;
  return parsed;
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

export default function CountriesPage() {
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
  const [savingsFlag, setSavingsFlag] = useState(null);
  const [savingsCountryOverride, setSavingsCountryOverride] = useState(null);
  const [savingsAccessLoading, setSavingsAccessLoading] = useState(false);
  const [savingsAccessSaving, setSavingsAccessSaving] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.countries.list(params);
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
  }, [page, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'alpha2Code', label: 'Alpha-2' },
    { key: 'alpha3Code', label: 'Alpha-3' },
    {
      key: 'defaultKycLevel',
      label: 'Default KYC',
      render: (row) => (row?.defaultKycLevel === null || row?.defaultKycLevel === undefined ? 'Global' : row.defaultKycLevel)
    },
    {
      key: 'registrationBlocked',
      label: 'Registration',
      render: (row) =>
        row?.registrationBlocked ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: '#FEF2F2', color: '#B91C1C' }}>
            Blocked
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: '#ECFDF3', color: '#15803D' }}>
            Allowed
          </span>
        )
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
      name: row.name ?? '',
      alpha2Code: row.alpha2Code ?? '',
      alpha3Code: row.alpha3Code ?? '',
      defaultKycLevel: row.defaultKycLevel ?? '',
      registrationBlocked: Boolean(row.registrationBlocked)
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

  const loadSavingsAccess = async (country) => {
    const countryCode = String(country?.alpha2Code || '').trim().toUpperCase();
    if (!countryCode) {
      setSavingsFlag(null);
      setSavingsCountryOverride(null);
      return;
    }
    setSavingsAccessLoading(true);
    try {
      const [flagRes, overridesRes] = await Promise.all([
        api.featureFlags.get(SAVINGS_ENABLED_KEY).catch((err) => {
          if (err?.status === 404) return { key: SAVINGS_ENABLED_KEY, enabled: true };
          throw err;
        }),
        api.featureFlags.listCountryOverrides(SAVINGS_ENABLED_KEY).catch((err) => {
          if (err?.status === 404) return [];
          throw err;
        })
      ]);
      const normalizedCode = countryCode.toUpperCase();
      const override = (Array.isArray(overridesRes) ? overridesRes : []).find(
        (entry) => String(entry?.countryCode ?? entry?.country_code ?? '').trim().toUpperCase() === normalizedCode
      );
      setSavingsFlag(flagRes || { key: SAVINGS_ENABLED_KEY, enabled: true });
      setSavingsCountryOverride(override || null);
    } catch (err) {
      setError(err?.message || 'Failed to load savings access for country');
      setSavingsFlag(null);
      setSavingsCountryOverride(null);
    } finally {
      setSavingsAccessLoading(false);
    }
  };

  useEffect(() => {
    if (!showDetail || !selected?.alpha2Code) return;
    loadSavingsAccess(selected);
  }, [showDetail, selected?.alpha2Code]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveSavingsCountryOverride = async (enabled) => {
    const countryCode = String(selected?.alpha2Code || '').trim().toUpperCase();
    if (!countryCode) return;
    setSavingsAccessSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.featureFlags.upsertCountryOverride(SAVINGS_ENABLED_KEY, countryCode, { enabled: Boolean(enabled) });
      await loadSavingsAccess(selected);
      setInfo(`Savings ${enabled ? 'enabled' : 'disabled'} for ${countryCode}.`);
    } catch (err) {
      setError(err?.message || 'Failed to save savings access override');
    } finally {
      setSavingsAccessSaving(false);
    }
  };

  const handleClearSavingsCountryOverride = async () => {
    const countryCode = String(selected?.alpha2Code || '').trim().toUpperCase();
    if (!countryCode) return;
    setSavingsAccessSaving(true);
    setError(null);
    setInfo(null);
    try {
      await api.featureFlags.removeCountryOverride(SAVINGS_ENABLED_KEY, countryCode);
      await loadSavingsAccess(selected);
      setInfo(`Savings access for ${countryCode} now inherits the global setting.`);
    } catch (err) {
      setError(err?.message || 'Failed to clear savings access override');
    } finally {
      setSavingsAccessSaving(false);
    }
  };

  const handleCreate = async () => {
    setError(null);
    setInfo(null);
    try {
      const level = parseLevelInput(draft.defaultKycLevel);
      if (Number.isNaN(level)) {
        setError('Default KYC level must be an integer >= 0.');
        return;
      }
      await api.countries.create(toPayload({ ...draft, defaultKycLevel: level === null ? '' : level }));
      setInfo('Created country.');
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
      const level = parseLevelInput(draft.defaultKycLevel);
      if (Number.isNaN(level)) {
        setError('Default KYC level must be an integer >= 0.');
        return;
      }
      await api.countries.update(selected.id, toPayload({ ...draft, defaultKycLevel: level === null ? '' : level }));
      setInfo(`Updated country ${selected.id}.`);
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
      await api.countries.remove(id);
      setInfo(`Deleted country ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="name">Name</label>
        <input id="name" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="alpha2Code">Alpha-2 code</label>
        <input id="alpha2Code" value={draft.alpha2Code} onChange={(e) => setDraft((p) => ({ ...p, alpha2Code: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="alpha3Code">Alpha-3 code</label>
        <input id="alpha3Code" value={draft.alpha3Code} onChange={(e) => setDraft((p) => ({ ...p, alpha3Code: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="defaultKycLevel">Default KYC level (optional)</label>
        <input
          id="defaultKycLevel"
          type="number"
          min={0}
          step={1}
          value={draft.defaultKycLevel}
          onChange={(e) => setDraft((p) => ({ ...p, defaultKycLevel: e.target.value }))}
          placeholder="Uses global default"
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          id="registrationBlocked"
          type="checkbox"
          checked={Boolean(draft.registrationBlocked)}
          onChange={(e) => setDraft((p) => ({ ...p, registrationBlocked: e.target.checked }))}
        />
        <label htmlFor="registrationBlocked">Block registration for this country</label>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Countries</div>
          <div style={{ color: 'var(--muted)' }}>Manage country codes, KYC defaults, and registration blocking.</div>
        </div>
        <Link href="/dashboard/geo" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Geo hub
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
          Add country
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No countries found" />

      {showCreate && (
        <Modal title="Add country" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit country ${selected?.id}`} onClose={() => setShowEdit(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowEdit(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleUpdate} className="btn-primary">Save</button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Details ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <DetailGrid
              rows={[
                { label: 'ID', value: selected?.id },
                { label: 'Name', value: selected?.name },
                { label: 'Alpha-2', value: selected?.alpha2Code },
                { label: 'Alpha-3', value: selected?.alpha3Code },
                { label: 'Default KYC', value: selected?.defaultKycLevel ?? 'Global default' },
                { label: 'Registration blocked', value: selected?.registrationBlocked ? 'Yes' : 'No' }
              ]}
            />

            <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gap: '0.2rem' }}>
                <div style={{ fontWeight: 800 }}>Savings access</div>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  Country-level control for <code>{SAVINGS_ENABLED_KEY}</code>. This uses the same feature flag override system as the feature-flags page.
                </div>
              </div>

              {savingsAccessLoading ? (
                <div style={{ color: 'var(--muted)' }}>Loading savings access…</div>
              ) : (
                <>
                  <DetailGrid
                    rows={[
                      { label: 'Global default', value: savingsFlag?.enabled === false ? 'Disabled' : 'Enabled' },
                      {
                        label: 'Country override',
                        value: savingsCountryOverride ? (savingsCountryOverride.enabled ? 'Enabled' : 'Disabled') : 'Inherited'
                      },
                      {
                        label: 'Effective access',
                        value: savingsCountryOverride ? (savingsCountryOverride.enabled ? 'Enabled' : 'Disabled') : savingsFlag?.enabled === false ? 'Disabled' : 'Enabled'
                      }
                    ]}
                  />

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn-success"
                      onClick={() => handleSaveSavingsCountryOverride(true)}
                      disabled={savingsAccessSaving}
                    >
                      {savingsAccessSaving ? 'Saving…' : 'Enable for country'}
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => handleSaveSavingsCountryOverride(false)}
                      disabled={savingsAccessSaving}
                    >
                      {savingsAccessSaving ? 'Saving…' : 'Disable for country'}
                    </button>
                    <button
                      type="button"
                      className="btn-neutral"
                      onClick={handleClearSavingsCountryOverride}
                      disabled={savingsAccessSaving || !savingsCountryOverride}
                    >
                      Clear override
                    </button>
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
            Delete country <strong>{confirmDelete.name || confirmDelete.id}</strong>? This cannot be undone.
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
