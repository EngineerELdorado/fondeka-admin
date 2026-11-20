'use client';

import { useCatalogCodes } from '@/lib/use-catalog-codes';

import { regulatorVisibleFields } from '@/lib/regulator-presentation';

import { useAuth } from '@/contexts/AuthContext';

import { useEffect, useRef, useState } from 'react';
import { PresentationLink as Link } from '@/components/RegulatorPresentation';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';
import { CountrySelect } from '@/components/CountrySelect';
import COUNTRIES from '@/data/countries';
import { fundingScopeOptions, normalizeFundingExemptions, paymentProviderPayload, paymentProviderDraft, providerPolicySnapshot, providerPolicyPermissions, providerFundingPolicy } from '@/lib/payment-provider-policy';

const SAME_FUNDING_DESTINATION_SCOPE_OPTIONS = fundingScopeOptions;
const countryOptions = [...new Map(COUNTRIES.filter((country) => country.cca2 !== 'XK').map((country) => [country.cca2, { ...country, name: country.cca2 === 'CD' ? 'DR Congo' : country.cca2 === 'CG' ? 'Republic of the Congo (Congo-Brazzaville)' : country.name }])).values()];
const emptyState = {
  name: '',
  active: true,
  requireSameFundingDestinationForPayout: false,
  sameFundingDestinationScope: 'SAME_PROVIDER',
  sameFundingDestinationExemptCountryCodes: []
};
const fallbackProviderNames = ['MAPLERAD', 'PAWAPAY', 'UNIPAYMENT', 'BTCPAY_SERVER', 'BITCART'];

const normalizeSameFundingDestinationScope = (value) =>
  SAME_FUNDING_DESTINATION_SCOPE_OPTIONS.includes(String(value || '').trim().toUpperCase())
    ? String(value || '').trim().toUpperCase()
    : 'SAME_PROVIDER';

const toPayload = (state) => paymentProviderPayload(state, countryOptions);
const formatSameFundingPolicy = providerFundingPolicy;

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

const DetailGrid = ({ rows }) => { const { enableRegulatorMode } = useAuth(); return (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '0.6rem' }}>
    {regulatorVisibleFields(rows, enableRegulatorMode).map((row) => (
      <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.6rem', border: `1px solid var(--border)`, borderRadius: '10px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{row.label}</div>
        <div style={{ fontWeight: 700 }}>{row.value ?? '—'}</div>
      </div>
    ))}
  </div>); };

export default function PaymentProvidersPage() {
  const { session } = useAuth();
  const { canWrite } = providerPolicyPermissions(session);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false), [needsReload, setNeedsReload] = useState(false);
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
  const { options: paymentProviderNameOptions } = useCatalogCodes('paymentProviders', 'name', fallbackProviderNames, [draft.name]);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      const res = await api.paymentProviders.list(params);
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

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'active', label: 'Active' },
    {
      key: 'sameFundingPolicy',
      label: 'Payout source policy',
      render: (row) => formatSameFundingPolicy(row)
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openDetail(row)} className="btn-neutral">View</button>
          <button type="button" disabled={!canWrite || busy} onClick={() => void openEdit(row)} className="btn-neutral">Edit</button>
          <button type="button" disabled={!canWrite || busy} onClick={() => { if (canWrite && !lock.current) setConfirmDelete(row); }} className="btn-danger">Delete</button>
        </div>
      )
    }
  ];

  const openCreate = () => {
    if (!canWrite || lock.current) return;
    setNeedsReload(false);
    setDraft({ ...emptyState, sameFundingDestinationExemptCountryCodes: rows.length > 0 && !rows.some((row) => Array.isArray(row.sameFundingDestinationExemptCountryCodes)) ? null : [] });
    setShowCreate(true);
    setInfo(null);
    setError(null);
  };

  const openEdit = async (row) => {
    if (!canWrite || lock.current) return;
    lock.current = true; setBusy(true); setError(null); setInfo(null);
    try {
      const current = await api.paymentProviders.get(row.id);
      setSelected(current); setDraft(paymentProviderDraft(current)); setNeedsReload(false); setShowEdit(true);
    } catch (err) { setError(err.message || 'Could not load the provider.'); }
    finally { lock.current = false; setBusy(false); }
  };

  const openDetail = (row) => {
    setSelected(row);
    setShowDetail(true);
    setInfo(null);
    setError(null);
  };

  const saveProvider = async (create) => {
    if (!canWrite || lock.current || needsReload || (!create && !selected?.id)) return;
    let payload;
    try { payload = toPayload(draft); } catch (err) { setError(err.message); return; }
    lock.current = true; setBusy(true); setError(null); setInfo(null);
    let started = false;
    try {
      if (!create) {
        const current = await api.paymentProviders.get(selected.id);
        if (providerPolicySnapshot(current) !== providerPolicySnapshot(selected)) { setNeedsReload(true); throw new Error('This provider changed on the server. Reload and review it before saving. Your draft is still shown.'); }
      }
      started = true;
      const result = create ? await api.paymentProviders.create(payload) : await api.paymentProviders.update(selected.id, payload);
      if (Object.hasOwn(payload, 'sameFundingDestinationExemptCountryCodes')) {
        const expected = [...payload.sameFundingDestinationExemptCountryCodes].sort();
        const actual = Array.isArray(result?.sameFundingDestinationExemptCountryCodes) ? normalizeFundingExemptions(result.sameFundingDestinationExemptCountryCodes).sort() : null;
        if ((actual === null && expected.length > 0) || (actual !== null && JSON.stringify(actual) !== JSON.stringify(expected))) throw new Error('The backend did not confirm the country exceptions. Refresh the provider before making another change.');
      }
      setInfo(create ? 'Created payment provider.' : `Updated payment provider ${selected.id}. New routing decisions use the saved policy.`);
      setShowCreate(false); setShowEdit(false); await fetchRows();
    } catch (err) {
      const uncertain = started && (!err.status || err.status >= 500);
      setError(`${err.message || 'Could not save the provider.'}${uncertain ? ' The outcome is unconfirmed; reload saved settings before another submission.' : ''}`);
      if (uncertain) setNeedsReload(true);
    } finally { lock.current = false; setBusy(false); }
  };
  const handleCreate = () => saveProvider(true);
  const handleUpdate = () => saveProvider(false);

  const handleDelete = async () => {
    if (!canWrite || lock.current) return;
    if (!confirmDelete?.id) return;
    const id = confirmDelete.id;
    setError(null);
    setInfo(null);
    try {
      await api.paymentProviders.remove(id);
      setInfo(`Deleted payment provider ${id}.`);
      setConfirmDelete(null);
      fetchRows();
    } catch (err) {
      setError(err.message);
    }
  };

  const renderForm = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '0.75rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="name">Name</label>
        <input disabled={!canWrite || busy} id="name" list="paymentProviderNameOptions" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
        <datalist id="paymentProviderNameOptions">
          {paymentProviderNameOptions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input disabled={!canWrite || busy} id="active" type="checkbox" style={{ width: 'auto', flexShrink: 0 }} checked={draft.active} onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))} />
        <label htmlFor="active">Active</label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          id="requireSameFundingDestinationForPayout"
          type="checkbox"
          style={{ width: 'auto', flexShrink: 0 }}
          disabled={!canWrite || busy}
          checked={draft.requireSameFundingDestinationForPayout}
          onChange={(e) => setDraft((p) => ({ ...p, requireSameFundingDestinationForPayout: e.target.checked }))}
        />
        <label htmlFor="requireSameFundingDestinationForPayout">Require same funding destination for payout</label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="sameFundingDestinationScope">Same funding destination scope</label>
        <select
          id="sameFundingDestinationScope"
          value={draft.sameFundingDestinationScope || ''}
          onChange={(e) => setDraft((p) => ({ ...p, sameFundingDestinationScope: e.target.value || null }))}
          disabled={!canWrite || busy || !draft.requireSameFundingDestinationForPayout}
        >
          {draft.sameFundingDestinationScope === null && <option value="">Same provider (default)</option>}
          {SAME_FUNDING_DESTINATION_SCOPE_OPTIONS.map((scope) => (
            <option key={scope} value={scope}>
              {scope}
            </option>
          ))}
        </select>
        <div style={{ color: 'var(--muted)', fontSize: '12px', lineHeight: 1.4 }}>
          SAME_PROVIDER requires a prior funding destination through this provider. ANY_PROVIDER accepts a prior funding destination through any mobile-money provider.
        </div>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '.5rem' }}>
        <label htmlFor="sameFundingDestinationExemptCountryCodes">Destination-country exceptions</label>
        <CountrySelect id="sameFundingDestinationExemptCountryCodes" aria-label="Destination-country exceptions" records={countryOptions} multiple emptyLabel="No country exceptions" value={draft.sameFundingDestinationExemptCountryCodes || []}
          disabled={!canWrite || busy || draft.sameFundingDestinationExemptCountryCodes === null}
          onChange={(event) => setDraft((value) => ({ ...value, sameFundingDestinationExemptCountryCodes: Array.from(event.target.selectedOptions, (option) => option.value) }))} />
        {draft.sameFundingDestinationExemptCountryCodes === null ? <div role="status">Country exceptions are unavailable on this backend. Other provider settings can still be saved without changing its exception list.</div> : <small>No selections means no country exceptions. Removing every selection sends an empty list when saved.</small>}
        <small>Uses the destination country of the payment method on the provider route, not the sender’s profile, app country or request headers. Missing route countries remain restricted.</small>
        <small>Exceptions remove only this provider’s prior-funding check. Number validation, KYC, account access, routes, amounts, balances and fees still apply. Turning the main check off preserves this list for later use.</small>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Payment Providers</div>
          <div style={{ color: 'var(--muted)' }}>Manage payment providers and ranking.</div>
        </div>
        <Link href="/dashboard/payments" style={{ padding: '0.55rem 0.9rem', borderRadius: '10px', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)' }}>
          ← Payments hub
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
        <button type="button" onClick={fetchRows} disabled={loading || busy} className="btn-primary">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button type="button" onClick={openCreate} disabled={!canWrite || busy} className="btn-success">
          Add provider
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={rows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No payment providers found" />

      {showCreate && (
        <Modal title="Add payment provider" onClose={() => { if (!lock.current) setShowCreate(false); }}>
          {error && <div role="alert">{error}</div>}
          {needsReload && <button type="button" className="btn-neutral" onClick={() => { setShowCreate(false); void fetchRows(); }}>Review saved providers</button>}
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => { if (!lock.current) setShowCreate(false); }} disabled={busy} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} disabled={busy || needsReload || !canWrite} className="btn-success">{busy ? 'Saving…' : 'Create'}</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit payment provider ${selected?.id}`} onClose={() => { if (!lock.current) setShowEdit(false); }}>
          {error && <div role="alert">{error}</div>}
          {needsReload && <button type="button" className="btn-neutral" disabled={busy} onClick={() => void openEdit(selected)}>Reload provider (replace draft)</button>}
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => { if (!lock.current) setShowEdit(false); }} disabled={busy} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleUpdate} disabled={busy || needsReload || !canWrite} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}

      {showDetail && (
        <Modal title={`Details ${selected?.id}`} onClose={() => setShowDetail(false)}>
          <DetailGrid
            rows={[
              { label: 'ID', value: selected?.id },
              { label: 'Name', value: selected?.name },
              { label: 'Active', value: selected?.active ? 'Yes' : 'No' },
              { label: 'Require same funding destination', value: selected?.requireSameFundingDestinationForPayout ? 'Yes' : 'No' },
              { label: 'Same funding destination scope', value: selected?.requireSameFundingDestinationForPayout ? normalizeSameFundingDestinationScope(selected?.sameFundingDestinationScope) : '—' },
              { label: 'Payout source policy', value: formatSameFundingPolicy(selected) },
              { label: 'Destination-country exceptions', value: Array.isArray(selected?.sameFundingDestinationExemptCountryCodes) ? selected.sameFundingDestinationExemptCountryCodes.map((code) => `${countryOptions.find((country) => country.cca2 === code)?.name || code} (${code})`).join(', ') || 'None' : 'Not reported' },
              { label: 'Created', value: selected?.createdAt },
              { label: 'Updated', value: selected?.updatedAt }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete payment provider <strong>{confirmDelete.name || confirmDelete.id}</strong>? This cannot be undone.
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
