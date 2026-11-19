'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { PresentationLink as Link } from '@/components/RegulatorPresentation';
import { ContactExportAudience } from '@/components/ContactExportAudience';
import BusinessAudienceHelp from '@/components/BusinessAudienceHelp';
import { emptyVisibilityAudience, visibilityAudienceGroups, visibilityAudienceOptions, visibilityPermissions, visibilityPayload, readVisibilityPolicy, visibilityDraft, visibilitySnapshot } from '@/lib/customer-service-visibility';
import styles from './customer-service-visibility.module.css';

const audienceHelp = {
  'Completed transactions': 'Presence and counts cover completed transactions across the account, independently of the selected-action USD total.',
  'Completed USD volume': 'Lifetime completed principal, excluding fees, using saved transaction-time USD values. Selected actions, services, products and payment routes narrow this total. Failed and pending amounts never count. This is activity volume, not wallet balance.',
  'Recent and monthly activity': 'Monthly counts use the current UTC month and do not limit the lifetime USD total. Inactivity requires a positive number of days and includes accounts with no transactions.',
  'Transaction attributes': 'Selected attributes must match the same transaction. With no selected status, a completed transaction is required. Status selection affects transaction existence; USD volume still includes only completed transactions.'
};

export function CustomerServiceVisibilityWorkspace() {
  const { session, refreshSession } = useAuth();
  const { canRead, canWrite } = visibilityPermissions(session);
  const [saved, setSaved] = useState(null), [mode, setMode] = useState('UNRESTRICTED'), [filters, setFilters] = useState(emptyVisibilityAudience);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  const [readError, setReadError] = useState(''), [formError, setFormError] = useState(''), [info, setInfo] = useState('');
  const [invalidSaved, setInvalidSaved] = useState(false), [repair, setRepair] = useState(false), [needsReload, setNeedsReload] = useState(false), [denied, setDenied] = useState(false);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!canRead) return undefined;
    let active = true;
    setLoading(true); setReadError(''); setInfo('');
    api.customerServiceVisibilityPolicy.get().then((resource) => {
      const policy = readVisibilityPolicy(resource), draft = visibilityDraft(policy);
      if (active) { setSaved(policy); setMode(draft.mode); setFilters(draft.filters); setInvalidSaved(false); setRepair(false); setNeedsReload(false); setFormError(''); }
    }).catch(async (err) => {
      if (err.status === 401 || err.status === 403) { try { await refreshSession?.(true); } catch { /* Keep the policy error visible. */ } }
      if (active) {
        setReadError(err.status === 404 ? 'Customer service audience targeting is unavailable on this backend. Deploy the matching backend and migration before using this page.' : err.message || 'Could not load the saved visibility policy.');
        setInvalidSaved(err.status === 400); setRepair(false);
        if (err.status === 403) setDenied(true);
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [canRead, reload, refreshSession]);

  const ready = Boolean(saved && !readError || repair);
  const disabled = !canWrite || denied || busy || loading || needsReload;
  const save = async () => {
    if (!canWrite || denied || !ready || loading || lock.current || needsReload) return;
    let payload;
    try { payload = visibilityPayload(mode, filters); } catch (err) { setFormError(err.message); return; }
    lock.current = true; setBusy(true); setFormError(''); setInfo('');
    let writeStarted = false;
    try {
      let current;
      try { current = readVisibilityPolicy(await api.customerServiceVisibilityPolicy.get()); }
      catch (err) { if (!(repair && err.status === 400)) throw err; }
      if (current && (repair || visibilitySnapshot(current) !== visibilitySnapshot(saved))) { setNeedsReload(true); throw new Error('The saved audience changed. Reload and review it before saving. Your draft is still shown.'); }
      writeStarted = true;
      const result = readVisibilityPolicy(await api.customerServiceVisibilityPolicy.update(payload));
      if (visibilitySnapshot(result) !== visibilitySnapshot(payload)) throw new Error('The backend did not confirm the requested audience.');
      if (alive.current) {
        const next = visibilityDraft(result); setSaved(result); setMode(next.mode); setFilters(next.filters); setReadError(''); setInvalidSaved(false); setRepair(false);
        setInfo(result.audience ? 'Audience saved. Customers must match these criteria and their effective customer-service feature flag.' : 'Targeting removed. The existing global and account feature flags determine visibility.');
      }
    } catch (err) {
      if (err.status === 401 || err.status === 403) { try { await refreshSession?.(true); } catch { /* Preserve the save error and draft. */ } }
      if (alive.current) {
        const unknown = writeStarted && (!err.status || err.status >= 500);
        setFormError((err.message || 'Could not save the visibility policy.') + (unknown ? ' The outcome is unconfirmed. Reload saved targeting before another submission.' : ''));
        if (unknown || err.status === 409) setNeedsReload(true);
        if (err.status === 403) setDenied(true);
      }
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  if (!canRead) return <div className="card" role="alert">Admin, Super Admin or Assistant access is required to inspect customer service visibility.</div>;
  return <div className={styles.workspace}>
    <header className="card"><div className={styles.heading}><div><h1>Customer service visibility</h1><p>Choose who can see the customer-service floating button.</p></div><Link className="btn-neutral" href="/dashboard/feature-flags">Global switch &amp; account overrides</Link></div>
      <p>The effective global/account <code>customer_service.enabled</code> decision must be on, and the account must match this audience. An account override does not bypass targeting.</p>
      <small>Changes apply on the next normal account refresh. Other support entry points keep their existing behavior.</small>
    </header>
    {!canWrite || denied ? <div className="card">Read only. Admin or Super Admin access is required to change targeting.</div> : null}
    {loading ? <div className="card" role="status">Loading saved audience…</div> : null}
    {readError && <div className="card" role="alert"><p>{readError}</p>{invalidSaved && <p>Invalid saved targeting hides the floating button. It has not been replaced with an unrestricted audience.</p>}
      <div className={styles.actions}><button type="button" className="btn-neutral" disabled={loading || busy} onClick={() => { if (!lock.current) setReload((number) => number + 1); }}>Reload saved targeting</button>
        {invalidSaved && canWrite && !denied && !repair && <button type="button" className="btn-neutral" disabled={loading || busy} onClick={() => { setRepair(true); setMode('TARGETED'); setFilters(emptyVisibilityAudience()); setFormError(''); setNeedsReload(false); }}>Replace invalid saved targeting</button>}
      </div>
    </div>}
    {info && <div className="card" role="status">{info}</div>}
    {ready && <section className={`card ${styles.editor}`}>
      <div className={styles.heading}><h2>Audience targeting</h2><span>{repair ? 'Replacement draft' : saved?.audience ? 'Saved: restricted audience' : 'Saved: unrestricted'}</span></div>
      <label className={styles.field}><span>Who can see the button?</span><select aria-label="Audience targeting" value={mode} disabled={disabled} onChange={(event) => { setMode(event.target.value); setFormError(''); }}><option value="UNRESTRICTED">Unrestricted — feature flags only</option><option value="TARGETED">Accounts matching selected criteria</option></select></label>
      {mode === 'UNRESTRICTED' ? <p>No additional audience condition. Saving this choice removes all audience criteria while preserving global and account feature flags.</p> : <>
        <ContactExportAudience filters={filters} disabled={disabled} groups={visibilityAudienceGroups} options={visibilityAudienceOptions} initiallyOpen={['Completed transactions', 'Completed USD volume']} help={audienceHelp} onChange={(key, value) => { setFilters((previous) => ({ ...previous, [key]: value })); setFormError(''); }} />
        <BusinessAudienceHelp />
        <details><summary>How USD totals are counted</summary><p>Bounds are inclusive. The total uses saved USD amounts, then positive USD reference amounts, then the native amount for USD transactions. Local-currency records without saved USD values contribute zero; no live exchange rate is used.</p><p>Selected bill actions exclude unrelated wallet deposits from the total. Counts of completed transactions remain account-wide. A zero minimum can match an account with no completed transactions; add “Has completed transactions: Yes” to require one.</p></details>
      </>}
      {formError && <div role="alert">{formError}</div>}
      <div className={styles.actions}>
        {canWrite && !denied && <button type="button" className="btn-primary" disabled={disabled} onClick={() => void save()}>{busy ? 'Saving…' : 'Save audience targeting'}</button>}
        <button type="button" className="btn-neutral" disabled={busy || loading} onClick={() => { if (!lock.current) setReload((number) => number + 1); }}>Reload saved targeting (replace draft)</button>
      </div>
    </section>}
  </div>;
}

export default function CustomerServiceVisibilityPolicy() {
  const { session } = useAuth();
  const identity = session?.tokens?.accessToken?.payload?.sub || session?.tokens?.idToken?.payload?.sub || session?.tokens?.accessToken?.toString() || 'anonymous';
  return <CustomerServiceVisibilityWorkspace key={identity} />;
}
