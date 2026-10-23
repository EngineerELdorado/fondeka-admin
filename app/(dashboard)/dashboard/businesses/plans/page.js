'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const normalizeGroups = (value) => Array.isArray(value)
  ? value.map((item) => String(item).trim().toUpperCase()).filter(Boolean)
  : typeof value === 'string' ? value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean) : [];

const moneyIsValid = (value) => /^\d+(\.\d{1,2})?$/.test(String(value)) && Number(value) >= 0.01;
const formatMoney = (amount, currency) => {
  if (Number(amount) === 0) return 'Not configured';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(Number(amount));
  } catch {
    return `${amount} ${currency || ''}`.trim();
  }
};

const Modal = ({ title, onClose, children }) => (
  <div className="modal-backdrop">
    <div className="modal-surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
        <strong>{title}</strong>
        <button type="button" className="btn-neutral" onClick={onClose}>×</button>
      </div>
      {children}
    </div>
  </div>
);

export default function BusinessToolsPlansPage() {
  const { session } = useAuth();
  const [plans, setPlans] = useState([]);
  const [prices, setPrices] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [draft, setDraft] = useState(null);
  const [priceDraft, setPriceDraft] = useState({ countryCode: '', amount: '', currency: 'USD' });
  const [planAuditReason, setPlanAuditReason] = useState('Updated Business Tools plan from admin dashboard');
  const [planSaveError, setPlanSaveError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [conflict, setConflict] = useState(null);

  const isSuperAdmin = useMemo(() => {
    const access = session?.tokens?.accessToken?.payload || {};
    const id = session?.tokens?.idToken?.payload || {};
    const groups = [...normalizeGroups(access?.['cognito:groups'] || access?.groups), ...normalizeGroups(id?.['cognito:groups'] || id?.groups)];
    return groups.includes('SUPER_ADMIN');
  }, [session]);

  const applyPlanToDraft = useCallback((plan) => {
    setDraft(plan ? {
      code: plan.code,
      name: plan.name || '',
      nameFr: plan.nameFr || '',
      billingMode: plan.billingMode || 'ONE_TIME',
      amount: String(plan.amount ?? ''),
      currency: String(plan.currency || '').toUpperCase(),
      active: Boolean(plan.active),
      version: plan.version
    } : null);
  }, []);

  const loadPlans = useCallback(async ({ preserveDraft = false } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.businessTools.plans.list();
      const list = Array.isArray(response) ? response : [];
      setPlans(list);
      const code = selectedCode || list[0]?.code || '';
      setSelectedCode(code);
      const current = list.find((plan) => plan.code === code) || null;
      if (!preserveDraft) applyPlanToDraft(current);
      return current;
    } catch (err) {
      setError(err?.message || 'Failed to load Business Tools plans.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyPlanToDraft, selectedCode]);

  const loadPrices = useCallback(async (code) => {
    if (!code) {
      setPrices([]);
      return;
    }
    try {
      const response = await api.businessTools.plans.listPrices(code);
      setPrices(Array.isArray(response) ? response : []);
    } catch (err) {
      setPrices([]);
      setError(err?.message || 'Failed to load country prices.');
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadPrices(selectedCode);
  }, [loadPrices, selectedCode]);

  const selectPlan = (code) => {
    setSelectedCode(code);
    setConflict(null);
    applyPlanToDraft(plans.find((plan) => plan.code === code));
  };

  const validatePlan = () => {
    if (!draft?.name.trim() || !draft?.nameFr.trim()) return 'English and French names are required.';
    if (!moneyIsValid(draft.amount)) return 'Price must be at least 0.01 with no more than two decimal places.';
    if (!/^[A-Z]{3}$/.test(draft.currency)) return 'Currency must be a three-letter uppercase ISO code.';
    if (!['ONE_TIME', 'MONTHLY', 'YEARLY'].includes(draft.billingMode)) return 'Select a valid billing mode.';
    if (!Number.isInteger(Number(draft.version)) || Number(draft.version) < 0) return 'The plan version is missing. Refresh the page before saving.';
    return null;
  };

  const requestPlanSave = async () => {
    if (saving) return;
    setPlanSaveError(null);
    const validationError = validatePlan();
    if (validationError) {
      setError(validationError);
      setPlanSaveError(validationError);
      return;
    }
    const reason = planAuditReason.trim();
    if (reason.length < 3) {
      const message = 'Enter a meaningful audit reason before saving.';
      setError(message);
      setPlanSaveError(message);
      return;
    }
    if (reason.length > 1000) {
      const message = 'Audit reason must be 1,000 characters or fewer.';
      setError(message);
      setPlanSaveError(message);
      return;
    }

    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const payload = {
        name: draft.name.trim(),
        nameFr: draft.nameFr.trim(),
        billingMode: draft.billingMode,
        amount: Number(draft.amount),
        currency: draft.currency,
        active: draft.active,
        version: draft.version,
        reason
      };
      const response = await api.businessTools.plans.update(draft.code, payload);
      const refreshed = await loadPlans();
      const updated = response && typeof response === 'object' ? response : refreshed;
      if (updated) {
        setPlans((previous) => previous.map((plan) => plan.code === updated.code ? updated : plan));
        applyPlanToDraft(updated);
      }
      await loadPrices(draft.code);
      setConflict(null);
      setPlanAuditReason('Updated Business Tools plan from admin dashboard');
      setInfo(`Plan ${draft.code} updated.`);
    } catch (err) {
      if (err?.status === 409) {
        const current = await loadPlans({ preserveDraft: true });
        if (current) {
          setDraft((previous) => ({ ...previous, version: current.version }));
          setConflict({ latestVersion: current.version, updatedAt: current.updatedAt });
        }
        const message = 'The plan changed on the server. Your inputs were preserved; review them against the refreshed version before resubmitting.';
        setError(message);
        setPlanSaveError(message);
      } else {
        const message = err?.message || 'Failed to save pricing configuration.';
        setError(message);
        setPlanSaveError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const requestPriceSave = () => {
    const countryCode = priceDraft.countryCode.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) return setError('Country must be a two-letter uppercase ISO code.');
    if (!moneyIsValid(priceDraft.amount)) return setError('Country price must be at least 0.01 with no more than two decimal places.');
    if (!/^[A-Z]{3}$/.test(priceDraft.currency)) return setError('Currency must be a three-letter uppercase ISO code.');
    setError(null);
    setConfirmation({ type: 'price', reason: '', acknowledged: false, error: '' });
  };

  const confirmSave = async () => {
    if (saving) return;
    const reason = confirmation?.reason?.trim() || '';
    if (reason.length < 3) return setConfirmation((previous) => ({ ...previous, error: 'Enter a meaningful audit reason.' }));
    if (reason.length > 1000) return setConfirmation((previous) => ({ ...previous, error: 'Reason must be 1,000 characters or fewer.' }));
    if (!confirmation?.acknowledged) return setConfirmation((previous) => ({ ...previous, error: 'Confirm that you reviewed the pricing change.' }));
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const countryCode = priceDraft.countryCode.trim().toUpperCase();
      await api.businessTools.plans.updatePrice(selectedCode, countryCode, {
        amount: Number(priceDraft.amount),
        currency: priceDraft.currency,
        reason
      });
      setPriceDraft({ countryCode: '', amount: '', currency: draft?.currency || 'USD' });
      const current = await loadPlans({ preserveDraft: true });
      if (current) setDraft((previous) => ({ ...previous, version: current.version }));
      await loadPrices(selectedCode);
      setInfo(`Country price for ${countryCode} saved.`);
      setConfirmation(null);
    } catch (err) {
      const message = err?.message || 'Failed to save country pricing configuration.';
      setError(message);
      setConfirmation((previous) => previous ? { ...previous, error: message } : previous);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="card" style={{ display: 'grid', gap: '0.55rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0 }}>Business Tools plans</h1>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)' }}>Configure purchase availability, the full base offer and account-country price overrides.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href="/dashboard/businesses" className="btn-neutral" style={{ textDecoration: 'none' }}>Businesses</Link>
            <Link href="/dashboard/businesses/migration" className="btn-neutral" style={{ textDecoration: 'none' }}>Migration</Link>
            <Link href="/dashboard/feature-flags" className="btn-neutral" style={{ textDecoration: 'none' }}>Enforcement flag</Link>
          </div>
        </div>
        <div style={{ padding: '0.7rem', borderRadius: '10px', background: 'var(--accent-soft)', fontSize: '13px' }}>
          Purchase availability, account entitlement, Business identity/KYB and enforcement are separate. Saving a plan never enables enforcement or grants access.
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {info ? <div className="alert alert-success">{info}</div> : null}
      {conflict ? <div className="card" style={{ color: '#92400E' }}>Latest server version: {conflict.latestVersion}. Last updated: {conflict.updatedAt ? new Date(conflict.updatedAt).toLocaleString() : 'unknown'}.</div> : null}

      <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <label style={{ display: 'grid', gap: '0.25rem', maxWidth: '460px' }}>
          <span>Plan</span>
          <select value={selectedCode} onChange={(event) => selectPlan(event.target.value)} disabled={loading}>
            {plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name || plan.code} ({plan.code})</option>)}
          </select>
        </label>
        {!draft && !loading ? <div>No Business Tools plans are configured.</div> : null}
        {draft ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
              <label style={{ display: 'grid', gap: '0.25rem' }}><span>Name (English)</span><input value={draft.name} disabled={!isSuperAdmin || saving} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} /></label>
              <label style={{ display: 'grid', gap: '0.25rem' }}><span>Name (French)</span><input value={draft.nameFr} disabled={!isSuperAdmin || saving} onChange={(e) => setDraft((p) => ({ ...p, nameFr: e.target.value }))} /></label>
              <label style={{ display: 'grid', gap: '0.25rem' }}>
                <span>Billing mode</span>
                <select value={draft.billingMode} disabled={!isSuperAdmin || saving} onChange={(e) => setDraft((p) => ({ ...p, billingMode: e.target.value }))}>
                  <option value="ONE_TIME">One-time</option><option value="MONTHLY">Monthly (no automatic renewal)</option><option value="YEARLY">Yearly (no automatic renewal)</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: '0.25rem' }}><span>Base price</span><input type="number" min="0.01" step="0.01" value={draft.amount} disabled={!isSuperAdmin || saving} onChange={(e) => setDraft((p) => ({ ...p, amount: e.target.value }))} /></label>
              <label style={{ display: 'grid', gap: '0.25rem' }}><span>Currency</span><input maxLength={3} value={draft.currency} disabled={!isSuperAdmin || saving} onChange={(e) => setDraft((p) => ({ ...p, currency: e.target.value.toUpperCase() }))} /></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.35rem' }}><input type="checkbox" checked={draft.active} disabled={!isSuperAdmin || saving} onChange={(e) => setDraft((p) => ({ ...p, active: e.target.checked }))} /><span>Enable new purchases</span></label>
            </div>
            {isSuperAdmin ? <div style={{ display: 'grid', gap: '0.6rem' }}>
              <label style={{ display: 'grid', gap: '0.25rem' }}><span>Audit reason</span><textarea rows={2} maxLength={1000} value={planAuditReason} disabled={saving} placeholder="Approved Business Tools plan update" onChange={(e) => setPlanAuditReason(e.target.value)} /></label>
              <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Clicking Save plan confirms the pricing change and submits it immediately.</div>
            </div> : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span><strong>{formatMoney(draft.amount, draft.currency)}</strong> · Version {draft.version} · {draft.active ? 'Purchases enabled' : 'Purchases disabled'}</span>
              {isSuperAdmin ? <button type="button" className="btn-primary" onClick={() => void requestPlanSave()} disabled={saving}>{saving ? 'Saving…' : 'Save plan'}</button> : <span style={{ color: 'var(--muted)' }}>Read only — Super Admin required to change pricing.</span>}
            </div>
            {planSaveError ? <div className="alert alert-error">{planSaveError}</div> : null}
          </>
        ) : null}
      </div>

      {draft ? (
        <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
          <div><strong>Country prices</strong><div style={{ color: 'var(--muted)', fontSize: '13px' }}>Selected from the account country. No override means the base price applies.</div></div>
          {prices.length ? (
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Country', 'Amount', 'Currency'].map((label) => <th key={label} style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>{label}</th>)}</tr></thead><tbody>{prices.map((price) => <tr key={price.id || price.countryCode}><td style={{ padding: '0.5rem' }}>{price.countryCode}</td><td style={{ padding: '0.5rem' }}>{price.amount}</td><td style={{ padding: '0.5rem' }}>{price.currency}</td></tr>)}</tbody></table></div>
          ) : <div style={{ color: 'var(--muted)' }}>No country overrides.</div>}
          {isSuperAdmin ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
              <label style={{ display: 'grid', gap: '0.25rem' }}><span>Country code</span><input maxLength={2} placeholder="CD" value={priceDraft.countryCode} onChange={(e) => setPriceDraft((p) => ({ ...p, countryCode: e.target.value.toUpperCase() }))} /></label>
              <label style={{ display: 'grid', gap: '0.25rem' }}><span>Amount</span><input type="number" min="0.01" step="0.01" value={priceDraft.amount} onChange={(e) => setPriceDraft((p) => ({ ...p, amount: e.target.value }))} /></label>
              <label style={{ display: 'grid', gap: '0.25rem' }}><span>Currency</span><input maxLength={3} value={priceDraft.currency} onChange={(e) => setPriceDraft((p) => ({ ...p, currency: e.target.value.toUpperCase() }))} /></label>
              <button type="button" className="btn-primary" onClick={requestPriceSave}>Review country price</button>
            </div>
          ) : null}
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Country-price overrides can be created or updated. The backend does not currently support deleting them.</div>
        </div>
      ) : null}

      {confirmation ? (
        <Modal title="Confirm pricing change" onClose={() => saving ? null : setConfirmation(null)}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ padding: '0.7rem', borderRadius: '10px', background: '#FFF7ED', color: '#92400E', fontSize: '13px' }}>This changes the offer for new purchases. It does not revoke existing access, grant access, or enable enforcement.</div>
            {confirmation.error ? <div className="alert alert-error">{confirmation.error}</div> : null}
            <label style={{ display: 'grid', gap: '0.25rem' }}><span>Audit reason</span><textarea autoFocus rows={3} maxLength={1000} value={confirmation.reason} onChange={(e) => setConfirmation((p) => ({ ...p, reason: e.target.value, error: '' }))} /></label>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}><input type="checkbox" checked={confirmation.acknowledged} onChange={(e) => setConfirmation((p) => ({ ...p, acknowledged: e.target.checked, error: '' }))} /><span>I reviewed the price, currency, availability and account-country behavior.</span></label>
            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{saving ? 'Submitting the pricing update to the backend…' : 'Enter an audit reason and check the confirmation before saving.'}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}><button type="button" className="btn-neutral" disabled={saving} onClick={() => setConfirmation(null)}>Cancel</button><button type="button" className="btn-primary" disabled={saving} onClick={() => void confirmSave()}>{saving ? 'Saving…' : 'Confirm and save'}</button></div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
