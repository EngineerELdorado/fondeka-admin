'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { DataTable } from '@/components/DataTable';

const emptyState = {
  name: '',
  displayName: '',
  logoUrl: '',
  type: '',
  active: true,
  allowingCollection: false,
  allowingPayout: false,
  rank: '',
  countryId: '',
  defaultForFees: false,
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankInstructions: '',
  bankInstructionsEn: '',
  bankInstructionsFr: ''
};

const toPayload = (state) => ({
  name: state.name,
  displayName: state.displayName,
  logoUrl: state.logoUrl,
  type: state.type,
  active: Boolean(state.active),
  allowingCollection: Boolean(state.allowingCollection),
  allowingPayout: Boolean(state.allowingPayout),
  rank: state.rank === '' ? null : Number(state.rank),
  countryId: state.countryId === '' ? null : Number(state.countryId),
  defaultForFees: Boolean(state.defaultForFees),
  bankName: state.bankName || null,
  bankAccountName: state.bankAccountName || null,
  bankAccountNumber: state.bankAccountNumber || null,
  bankInstructions: state.bankInstructions || null,
  bankInstructionsEn: state.bankInstructionsEn || null,
  bankInstructionsFr: state.bankInstructionsFr || null
});

const toUpdatePayloadFromRow = (row, overrides = {}) => ({
  name: row.name,
  displayName: row.displayName,
  logoUrl: row.logoUrl,
  type: row.type,
  active: Boolean(row.active),
  allowingCollection: Boolean(row.allowingCollection),
  allowingPayout: Boolean(row.allowingPayout),
  rank: row.rank === '' ? null : Number(row.rank),
  countryId: row.countryId === '' ? null : Number(row.countryId),
  defaultForFees: false,
  bankName: row.bankName ?? null,
  bankAccountName: row.bankAccountName ?? null,
  bankAccountNumber: row.bankAccountNumber ?? null,
  bankInstructions: row.bankInstructions ?? null,
  bankInstructionsEn: row.bankInstructionsEn ?? null,
  bankInstructionsFr: row.bankInstructionsFr ?? null,
  ...overrides
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

const WARNING_ERROR_CODE = 'WARNING_MESSAGE';

const resolveFlagEnabled = (response) => {
  if (typeof response === 'boolean') return response;
  if (response && typeof response.enabled === 'boolean') return response.enabled;
  return true;
};

const paymentMethodRailFlagKey = (paymentMethodId, flow) => `payment.method.${paymentMethodId}.${flow}.enabled`;
const paymentMethodRailStateKey = (paymentMethodId, flow) => `${paymentMethodId}:${flow}`;

export default function PaymentMethodsPage() {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [countries, setCountries] = useState([]);
  const [arrangeBy, setArrangeBy] = useState('id');
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

  const getRailEnabled = (paymentMethodId, flow) => {
    const key = paymentMethodRailStateKey(paymentMethodId, flow);
    const value = railFlags[key];
    return typeof value === 'boolean' ? value : true;
  };

  const isRailLoading = (paymentMethodId, flow) => Boolean(railFlagsLoading[paymentMethodRailStateKey(paymentMethodId, flow)]);
  const isRailSaving = (paymentMethodId, flow) => Boolean(railFlagsSaving[paymentMethodRailStateKey(paymentMethodId, flow)]);

  const loadRailFlags = async (paymentMethods) => {
    const targets = (paymentMethods || [])
      .filter((row) => row?.id !== null && row?.id !== undefined)
      .flatMap((row) => [
        { paymentMethodId: row.id, flow: 'collection' },
        { paymentMethodId: row.id, flow: 'payout' }
      ]);
    if (targets.length === 0) return;

    setRailFlagsLoading((prev) => {
      const next = { ...prev };
      targets.forEach(({ paymentMethodId, flow }) => {
        next[paymentMethodRailStateKey(paymentMethodId, flow)] = true;
      });
      return next;
    });

    const settled = await Promise.allSettled(
      targets.map(async ({ paymentMethodId, flow }) => {
        try {
          const res = await api.featureFlags.get(paymentMethodRailFlagKey(paymentMethodId, flow));
          return { paymentMethodId, flow, enabled: resolveFlagEnabled(res) };
        } catch (err) {
          if (err?.status === 404) {
            return { paymentMethodId, flow, enabled: true };
          }
          return { paymentMethodId, flow, enabled: true, error: err };
        }
      })
    );

    setRailFlags((prev) => {
      const next = { ...prev };
      settled.forEach((result, index) => {
        const fallback = targets[index];
        const payload = result.status === 'fulfilled' ? result.value : { ...fallback, enabled: true };
        next[paymentMethodRailStateKey(payload.paymentMethodId, payload.flow)] = Boolean(payload.enabled);
      });
      return next;
    });

    setRailFlagsLoading((prev) => {
      const next = { ...prev };
      targets.forEach(({ paymentMethodId, flow }) => {
        next[paymentMethodRailStateKey(paymentMethodId, flow)] = false;
      });
      return next;
    });
  };

  const updateRailFlag = async (row, flow, enabled) => {
    if (!row?.id) return;
    const stateKey = paymentMethodRailStateKey(row.id, flow);
    setError(null);
    setWarning(null);
    setInfo(null);
    setRailFlagsSaving((prev) => ({ ...prev, [stateKey]: true }));
    try {
      const key = paymentMethodRailFlagKey(row.id, flow);
      await api.featureFlags.update(key, { enabled: Boolean(enabled) });
      setRailFlags((prev) => ({ ...prev, [stateKey]: Boolean(enabled) }));
      setInfo(`${row.displayName || row.name || `Payment method ${row.id}`} ${flow} ${enabled ? 'enabled' : 'blocked'}.`);
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
    const featureFlagKey = paymentMethodRailFlagKey(row.id, flow);
    setOverrideModal({
      featureFlagKey,
      label: `${row.displayName || row.name || `Payment method ${row.id}`} - ${flow}`
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

  const unsetOtherDefaults = async (keepId) => {
    try {
      const res = await api.paymentMethods.list(new URLSearchParams({ page: '0', size: '200' }));
      const list = Array.isArray(res) ? res : res?.content || [];
      const conflicts = (list || []).filter((pm) => pm.defaultForFees && pm.id !== keepId);
      await Promise.all(
        conflicts.map((pm) =>
          api.paymentMethods.update(pm.id, toUpdatePayloadFromRow(pm, { defaultForFees: false }))
        )
      );
    } catch (err) {
      setError(err.message);
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
      const res = await api.paymentMethods.list(params);
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

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await api.countries.list(new URLSearchParams({ page: '0', size: '200' }));
        const list = Array.isArray(res) ? res : res?.content || [];
        setCountries(list || []);
      } catch {
        // ignore silently
      }
    };
    fetchCountries();
  }, []);

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'displayName', label: 'Display' },
    { key: 'countryName', label: 'Country', render: (row) => row.countryName || 'GLOBAL' },
    { key: 'type', label: 'Type' },
    { key: 'rank', label: 'Rank' },
    { key: 'defaultForFees', label: 'Default for fees', render: (row) => (row.defaultForFees ? 'Yes' : 'No') },
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

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    if (arrangeBy === 'country') {
      arr.sort((a, b) => (a.countryName || 'GLOBAL').localeCompare(b.countryName || 'GLOBAL'));
    } else if (arrangeBy === 'type') {
      arr.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
    } else if (arrangeBy === 'active') {
      arr.sort((a, b) => Number(b.active) - Number(a.active));
    }
    return arr;
  }, [rows, arrangeBy]);

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
      name: row.name ?? '',
      displayName: row.displayName ?? '',
      logoUrl: row.logoUrl ?? '',
      type: row.type ?? '',
      active: Boolean(row.active),
      allowingCollection: Boolean(row.allowingCollection),
      allowingPayout: Boolean(row.allowingPayout),
      rank: row.rank ?? '',
      countryId: row.countryId ?? '',
      defaultForFees: Boolean(row.defaultForFees),
      bankName: row.bankName ?? '',
      bankAccountName: row.bankAccountName ?? '',
      bankAccountNumber: row.bankAccountNumber ?? '',
      bankInstructions: row.bankInstructions ?? '',
      bankInstructionsEn: row.bankInstructionsEn ?? '',
      bankInstructionsFr: row.bankInstructionsFr ?? ''
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
      const res = await api.paymentMethods.create(toPayload(draft));
      const newId = res?.id;
      if (draft.defaultForFees && newId) {
        await unsetOtherDefaults(newId);
      }
      setInfo('Created payment method.');
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
      await api.paymentMethods.update(selected.id, toPayload(draft));
      if (draft.defaultForFees) {
        await unsetOtherDefaults(selected.id);
      }
      setInfo(`Updated payment method ${selected.id}.`);
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
      await api.paymentMethods.remove(id);
      setInfo(`Deleted payment method ${id}.`);
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
        <label htmlFor="displayName">Display name</label>
        <input id="displayName" value={draft.displayName} onChange={(e) => setDraft((p) => ({ ...p, displayName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="type">Type</label>
        <input id="type" value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))} placeholder="e.g. MOBILE_MONEY" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="rank">Rank</label>
        <input id="rank" type="number" value={draft.rank} onChange={(e) => setDraft((p) => ({ ...p, rank: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="countryId">Country</label>
        <select id="countryId" value={draft.countryId} onChange={(e) => setDraft((p) => ({ ...p, countryId: e.target.value }))}>
          <option value="">GLOBAL</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.alpha2Code || c.alpha3Code || c.id})
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="logoUrl">Logo URL</label>
        <textarea
          id="logoUrl"
          rows={2}
          value={draft.logoUrl}
          onChange={(e) => setDraft((p) => ({ ...p, logoUrl: e.target.value }))}
          style={{ resize: 'vertical' }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="bankName">Bank name</label>
        <input id="bankName" value={draft.bankName} onChange={(e) => setDraft((p) => ({ ...p, bankName: e.target.value }))} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="bankAccountName">Account name</label>
        <input
          id="bankAccountName"
          value={draft.bankAccountName}
          onChange={(e) => setDraft((p) => ({ ...p, bankAccountName: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="bankAccountNumber">Account number</label>
        <input
          id="bankAccountNumber"
          value={draft.bankAccountNumber}
          onChange={(e) => setDraft((p) => ({ ...p, bankAccountNumber: e.target.value }))}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="bankInstructionsEn">Instructions (EN)</label>
        <textarea
          id="bankInstructionsEn"
          rows={3}
          value={draft.bankInstructionsEn}
          onChange={(e) => setDraft((p) => ({ ...p, bankInstructionsEn: e.target.value }))}
          style={{ resize: 'vertical' }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="bankInstructionsFr">Instructions (FR)</label>
        <textarea
          id="bankInstructionsFr"
          rows={3}
          value={draft.bankInstructionsFr}
          onChange={(e) => setDraft((p) => ({ ...p, bankInstructionsFr: e.target.value }))}
          style={{ resize: 'vertical' }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label htmlFor="bankInstructions">Instructions (generic)</label>
        <textarea
          id="bankInstructions"
          rows={3}
          value={draft.bankInstructions}
          onChange={(e) => setDraft((p) => ({ ...p, bankInstructions: e.target.value }))}
          style={{ resize: 'vertical' }}
        />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {[
          { key: 'active', label: 'Active', value: draft.active },
          { key: 'allowingCollection', label: 'Allow collection', value: draft.allowingCollection },
          { key: 'allowingPayout', label: 'Allow payout', value: draft.allowingPayout },
          { key: 'defaultForFees', label: 'Default for fees', value: draft.defaultForFees }
        ].map((item) => (
          <label
            key={item.key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.55rem 0.75rem',
              border: `1px solid var(--border)`,
              borderRadius: '10px',
              background: 'var(--surface)',
              cursor: 'pointer',
              minWidth: '200px'
            }}
          >
            <input
              type="checkbox"
              checked={item.value}
              onChange={(e) => setDraft((p) => ({ ...p, [item.key]: e.target.checked }))}
              style={{ width: '18px', height: '18px' }}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontWeight: 800, fontSize: '20px' }}>Payment Methods</div>
          <div style={{ color: 'var(--muted)' }}>Manage payment methods and eligibility.</div>
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
        <div>
          <label htmlFor="arrangeBy">Arrange by</label>
          <select id="arrangeBy" value={arrangeBy} onChange={(e) => setArrangeBy(e.target.value)}>
            <option value="id">Default</option>
            <option value="country">Country</option>
            <option value="type">Type</option>
            <option value="active">Active</option>
          </select>
        </div>
        <button type="button" onClick={fetchRows} disabled={loading} className="btn-primary">
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button type="button" onClick={openCreate} className="btn-success">
          Add method
        </button>
      </div>

      {error && <div className="card" style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
      {warning && <div className="card" style={{ color: '#a16207', background: '#fffbeb', border: '1px solid #fcd34d', fontWeight: 700 }}>{warning}</div>}
      {info && <div className="card" style={{ color: '#15803d', fontWeight: 700 }}>{info}</div>}

      <DataTable columns={columns} rows={sortedRows} page={page} pageSize={size} onPageChange={setPage} emptyLabel="No payment methods found" />

      {showCreate && (
        <Modal title="Add payment method" onClose={() => setShowCreate(false)}>
          {renderForm()}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-neutral">Cancel</button>
            <button type="button" onClick={handleCreate} className="btn-success">Create</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title={`Edit payment method ${selected?.id}`} onClose={() => setShowEdit(false)}>
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
              { label: 'Name', value: selected?.name },
              { label: 'Display', value: selected?.displayName },
              { label: 'Type', value: selected?.type },
              { label: 'Rank', value: selected?.rank },
              { label: 'Country', value: selected?.countryName || 'GLOBAL' },
              { label: 'Active', value: selected?.active ? 'Yes' : 'No' },
              { label: 'Allow collection', value: selected?.allowingCollection ? 'Yes' : 'No' },
              { label: 'Allow payout', value: selected?.allowingPayout ? 'Yes' : 'No' },
              { label: 'Default for fees', value: selected?.defaultForFees ? 'Yes' : 'No' },
              { label: 'Logo URL', value: selected?.logoUrl },
              { label: 'Bank name', value: selected?.bankName },
              { label: 'Account name', value: selected?.bankAccountName },
              { label: 'Account number', value: selected?.bankAccountNumber },
              { label: 'Instructions (EN)', value: selected?.bankInstructionsEn },
              { label: 'Instructions (FR)', value: selected?.bankInstructionsFr },
              { label: 'Instructions (generic)', value: selected?.bankInstructions },
              { label: 'Created', value: selected?.createdAt },
              { label: 'Updated', value: selected?.updatedAt }
            ]}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Confirm delete" onClose={() => setConfirmDelete(null)}>
          <div style={{ color: 'var(--muted)' }}>
            Delete payment method <strong>{confirmDelete.displayName || confirmDelete.name || confirmDelete.id}</strong>? This cannot be undone.
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
