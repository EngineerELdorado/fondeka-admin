'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { PresentationLink as Link } from '@/components/RegulatorPresentation';
import { ContactExportAudience } from '@/components/ContactExportAudience';
import { isRegulatorRestrictedService } from '@/lib/regulator-presentation';
import { api } from '@/lib/api';
import { canExportContacts, contactAudienceFields, contactExportAudience, contactExportDownload, contactExportFields, contactExportJob, contactExportPayload, emptyContactAudience, isContactExportId } from '@/lib/contact-exports';

const grid = { display: 'grid', gap: '0.85rem', minWidth: 0 };
const actions = { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' };
const date = (value) => new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
const statusCopy = { QUEUED: 'Waiting for a worker.', RUNNING: 'Generating and uploading the CSV.', READY: 'Your CSV is ready.', FAILED: 'Export failed. You can start another job.', EXPIRED: 'This export has expired. Start another job to generate a new file.' };

export function ContactExports({ initialJobId = '' }) {
  const { session, adminProfile, refreshSession, enableRegulatorMode } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = canExportContacts(session);
  const identity = adminProfile?.id ?? session?.tokens?.accessToken?.payload?.sub ?? session?.tokens?.idToken?.payload?.sub;
  const storageKey = identity == null ? null : `fondeka:contact-export:${identity}`;
  const [catalog, setCatalog] = useState(null), [fields, setFields] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(true), [schemaError, setSchemaError] = useState(''), [schemaReload, setSchemaReload] = useState(0);
  const [addField, setAddField] = useState('');
  const [audienceMode, setAudienceMode] = useState('ALL'), [filters, setFilters] = useState(emptyContactAudience);
  const [jobId, setJobId] = useState(''), [job, setJob] = useState(null), [lookup, setLookup] = useState('');
  const [initialised, setInitialised] = useState(false), [loadingJob, setLoadingJob] = useState(false), [jobReload, setJobReload] = useState(0);
  const [creating, setCreating] = useState(false), [error, setError] = useState(''), [jobError, setJobError] = useState('');
  const [now, setNow] = useState(Date.now);
  const createLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const remember = useCallback((id) => { if (storageKey) { try { localStorage.setItem(storageKey, id); } catch {} } }, [storageKey]);
  const displayError = useCallback((err) => {
    if (err?.status === 401) void refreshSession(true);
    if (err?.status === 404) return 'Contact exports are unavailable on this backend. Deploy the export API, then refresh.';
    return (err?.status === 403 ? 'Permission denied. ' : '') + (err?.message || 'Unable to contact the export service. Please retry.');
  }, [refreshSession]);

  useEffect(() => {
    if (!allowed) return undefined;
    let cancelled = false;
    setSchemaLoading(true); setSchemaError('');
    api.accounts.contactExports.fields().then((response) => {
      if (cancelled) return;
      const next = contactExportFields(response);
      setCatalog(next); setFields((previous) => previous ?? [...next.defaultFields]);
    }).catch((err) => { if (!cancelled) { setCatalog(null); setSchemaError(displayError(err)); } })
      .finally(() => { if (!cancelled) setSchemaLoading(false); });
    return () => { cancelled = true; };
  }, [allowed, schemaReload, displayError]);

  useEffect(() => {
    if (!allowed) return;
    let stored = '';
    if (storageKey) { try { stored = localStorage.getItem(storageKey) || ''; } catch {} }
    const id = initialJobId || stored;
    if (id && !isContactExportId(id)) { setJobError('Enter a valid export job ID.'); setJobId(''); setJob(null); }
    else { setJobId(id); setLookup(id); setJob((previous) => previous?.jobId === id ? previous : null); }
    setInitialised(true);
  }, [allowed, initialJobId, storageKey]);

  useEffect(() => {
    if (!allowed || !initialised || !jobId) return undefined;
    let cancelled = false, timer, busy = false;
    const read = async () => {
      if (cancelled || busy || document.visibilityState === 'hidden') return;
      clearTimeout(timer); busy = true; setLoadingJob(true);
      let poll = true;
      try {
        const response = await api.accounts.contactExports.get(jobId);
        if (cancelled) return;
        const next = contactExportJob(response, jobId);
        setJob(next); setJobError(''); setNow(Date.now()); remember(next.jobId);
        poll = ['QUEUED', 'RUNNING'].includes(next.status);
      } catch (err) {
        if (cancelled) return;
        setJobError(err?.status === 404 ? 'Export not found, or you do not have access to it. Check the job ID.' : displayError(err));
        if ([400, 403, 404].includes(err?.status)) { setJob(null); poll = false; }
      } finally {
        busy = false;
        if (!cancelled) { setLoadingJob(false); if (poll) timer = setTimeout(read, 4000); }
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') void read(); };
    void read();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, [allowed, initialised, jobId, jobReload, remember, displayError]);

  useEffect(() => {
    if (!job) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [job]);

  const validation = useMemo(() => {
    if (!catalog || !fields) return { payload: null, error: '' };
    try {
      const audience = audienceMode === 'ALL' ? {} : contactExportAudience(filters);
      if (audienceMode === 'FILTERED' && !Object.keys(audience).length) throw new Error('Add at least one filter, or choose all existing accounts.');
      if (enableRegulatorMode !== false && Object.entries(audience).some(([key, value]) => isRegulatorRestrictedService(key) || ['transactionServices', 'transactionActions'].includes(key) && isRegulatorRestrictedService(value))) throw new Error('Some filters are unavailable in this presentation. Clear filters before starting an export.');
      return { payload: contactExportPayload(fields, catalog, audience), error: '' };
    } catch (err) { return { payload: null, error: err.message }; }
  }, [catalog, fields, filters, audienceMode, enableRegulatorMode]);
  const active = job && ['QUEUED', 'RUNNING'].includes(job.status) && Date.parse(job.expiresAt) > now;
  const disabled = creating || Boolean(active) || !initialised || loadingJob;
  const available = catalog?.availableFields.filter((field) => !fields?.includes(field.name)) || [];
  const label = (name) => catalog?.availableFields.find((field) => field.name === name)?.label || name;
  const expired = job && Date.parse(job.expiresAt) <= now;
  const status = expired ? 'EXPIRED' : job?.status;
  const download = !jobError ? contactExportDownload(job, now) : null;

  async function start() {
    if (!allowed || disabled || !catalog || !validation.payload || createLock.current) return;
    createLock.current = true; setCreating(true); setError('');
    try {
      const next = contactExportJob(await api.accounts.contactExports.create(validation.payload));
      remember(next.jobId);
      if (!mounted.current) return;
      setJob(next); setJobId(next.jobId); setLookup(next.jobId); setJobError('');
      router.replace(`${pathname}?jobId=${encodeURIComponent(next.jobId)}`, { scroll: false });
    } catch (err) { if (mounted.current) setError(displayError(err)); }
    finally { createLock.current = false; if (mounted.current) setCreating(false); }
  }
  function openJob(event) {
    event.preventDefault();
    const id = lookup.trim();
    if (!isContactExportId(id)) { setJobError('Enter a valid export job ID.'); return; }
    setJob((previous) => previous?.jobId === id ? previous : null); setJobId(id); setJobError(''); setJobReload((value) => value + 1);
    router.replace(`${pathname}?jobId=${encodeURIComponent(id)}`, { scroll: false });
  }
  function move(index, direction) {
    setFields((previous) => { const next = [...previous]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next; });
  }

  if (!allowed) return <section className="card"><h1>Contact exports</h1><div role="alert">Permission denied. Admin or Super Admin access is required.</div></section>;
  return <div style={grid}>
    <header className="card" style={{ ...actions, justifyContent: 'space-between' }}><div><h1 style={{ margin: 0 }}>Contact exports</h1><p style={{ color: 'var(--muted)', marginBottom: 0 }}>Create a CSV of customer accounts. Exports run in the background and remain available for 24 hours.</p></div><Link className="btn-neutral" href="/dashboard/accounts/accounts">Back to Accounts</Link></header>

    {jobId ? <section className="card" aria-label="Export progress" style={grid}>
      <div style={{ ...actions, justifyContent: 'space-between' }}><h2 style={{ margin: 0 }}>Latest export</h2><strong role="status">{status || (loadingJob ? 'Loading…' : 'Status unavailable')}</strong></div>
      {job ? <>
        <div>{statusCopy[status]} <strong>{job.rowCount.toLocaleString()} rows processed</strong></div>
        {status === 'FAILED' && job.error ? <div role="alert" className="alert alert-error">{job.error}</div> : null}
        <div style={actions}>
          {download ? <a className="btn-primary" href={download} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Download CSV</a> : null}
          <button type="button" className="btn-neutral" disabled={loadingJob || creating} onClick={() => setJobReload((value) => value + 1)}>{loadingJob ? 'Refreshing…' : status === 'READY' ? 'Refresh download link' : 'Refresh status'}</button>
        </div>
        {status === 'READY' && !download ? <div>The download link is unavailable or has expired. Refresh it to download.</div> : null}
        {download ? <small style={{ color: 'var(--muted)' }}>Download link valid until {date(job.downloadUrlExpiresAt)}.</small> : null}
        <details><summary style={{ cursor: 'pointer' }}>Saved export settings</summary><div style={{ ...grid, marginTop: '0.7rem' }}>
          <div style={{ overflowWrap: 'anywhere' }}>Job ID: {job.jobId}</div><div>Created: {date(job.createdAt)} · File expires: {date(job.expiresAt)}</div>
          <div>Columns, in order: {job.fields.map(label).join(', ')}</div>
          {Object.keys(job.audience || {}).length ? Object.entries(job.audience).map(([key, value]) => enableRegulatorMode !== false && (isRegulatorRestrictedService(key) || ['transactionServices', 'transactionActions'].includes(key) && isRegulatorRestrictedService(value)) ? <div key={key}>Filter hidden in this presentation.</div> : <div key={key} style={{ overflowWrap: 'anywhere' }}>{contactAudienceFields.find(([name]) => name === key)?.[1] || key}: {Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value)}</div>) : <div>Audience: all existing accounts</div>}
        </div></details>
      </> : <button type="button" className="btn-neutral" disabled={loadingJob} onClick={() => setJobReload((value) => value + 1)}>Refresh status</button>}
    </section> : null}
    {jobError ? <div role="alert" className="alert alert-error">{jobError}</div> : null}
    <details className="card"><summary style={{ cursor: 'pointer' }}>Open an export by job ID</summary><form onSubmit={openJob} style={{ ...actions, marginTop: '0.7rem' }}><label style={{ display: 'grid', gap: '0.3rem', flex: '1 1 260px' }}>Job ID<input value={lookup} onChange={(event) => setLookup(event.target.value)} disabled={creating} /></label><button className="btn-neutral" type="submit" disabled={creating || loadingJob}>Open export</button></form></details>

    <section className="card" style={grid}>
      <div style={{ ...actions, justifyContent: 'space-between' }}><h2 style={{ margin: 0 }}>CSV columns</h2><button type="button" className="btn-neutral btn-sm" disabled={disabled || schemaLoading} onClick={() => setSchemaReload((value) => value + 1)}>Refresh columns</button></div>
      {schemaLoading ? <div role="status">Loading available columns…</div> : null}
      {schemaError ? <div role="alert" className="alert alert-error">{schemaError}</div> : null}
      {catalog ? <fieldset disabled={disabled || schemaLoading} style={{ border: 0, padding: 0, margin: 0, ...grid }}>
        <div style={{ color: 'var(--muted)' }}>Choose columns and arrange their CSV order.</div>
        <ol aria-label="Selected CSV columns" style={{ display: 'grid', gap: '0.4rem', margin: 0, padding: 0, listStyle: 'none' }}>{fields?.map((name, index) => <li key={name} style={{ ...actions, justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}><span>{index + 1}. {label(name)}</span><div style={actions}><button type="button" className="btn-neutral btn-sm" aria-label={`Move ${label(name)} up`} disabled={disabled || index === 0} onClick={() => move(index, -1)}>↑</button><button type="button" className="btn-neutral btn-sm" aria-label={`Move ${label(name)} down`} disabled={disabled || index === fields.length - 1} onClick={() => move(index, 1)}>↓</button><button type="button" className="btn-neutral btn-sm" aria-label={`Remove ${label(name)}`} onClick={() => setFields((previous) => previous.filter((field) => field !== name))}>Remove</button></div></li>)}</ol>
        <div style={actions}><label style={{ display: 'grid', gap: '0.3rem', flex: '1 1 220px' }}>Add column<select value={addField} onChange={(event) => setAddField(event.target.value)}><option value="">Choose a column…</option>{available.map((field) => <option key={field.name} value={field.name}>{field.label}</option>)}</select></label><button type="button" className="btn-neutral" disabled={disabled || !available.some((field) => field.name === addField)} onClick={() => { setFields((previous) => [...previous, addField]); setAddField(''); }}>Add column</button><button type="button" className="btn-neutral" onClick={() => { setFields([...catalog.defaultFields]); setAddField(''); }}>Use default columns</button></div>
      </fieldset> : null}
    </section>
    <section className="card" style={grid}>
      <h2 style={{ margin: 0 }}>Audience</h2>
      <label style={{ display: 'grid', gap: '0.3rem', maxWidth: '420px' }}>Accounts to export<select disabled={disabled} value={audienceMode} onChange={(event) => setAudienceMode(event.target.value)}><option value="ALL">All existing accounts</option><option value="FILTERED">Selected audience / filters</option></select></label>
      {audienceMode === 'FILTERED' ? <><ContactExportAudience filters={filters} onChange={(key, value) => setFilters((previous) => ({ ...previous, [key]: value }))} disabled={disabled} /><div><button type="button" className="btn-neutral btn-sm" disabled={disabled} onClick={() => setFilters(emptyContactAudience())}>Clear filters</button></div></> : null}
    </section>
    <section className="card" style={grid}>
      <div><strong>{fields?.length || 0} columns</strong> · {audienceMode === 'ALL' ? 'All existing accounts' : 'Filtered customer audience'}</div>
      {validation.error ? <div role="alert">{validation.error}</div> : null}
      {error ? <div role="alert" className="alert alert-error">{error}</div> : null}
      {active ? <div>One export is already queued or running. You can start another when it finishes.</div> : null}
      <div><button type="button" className="btn-primary" disabled={disabled || schemaLoading || !validation.payload} onClick={() => void start()}>{creating ? 'Starting export…' : 'Start contact export'}</button></div>
      <small style={{ color: 'var(--muted)' }}>Creates a CSV only. No campaign or email is sent. Exported contacts do not indicate marketing subscription status.</small>
    </section>
  </div>;
}
