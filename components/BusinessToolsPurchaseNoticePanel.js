'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  BUSINESS_TOOLS_NOTICE_LIMIT, BUSINESS_TOOLS_FAQ_URL_LIMIT, BUSINESS_TOOLS_FAQ_LABEL_LIMIT,
  businessToolsNoticeSettings, businessToolsNoticePayload, businessToolsNoticeDraft,
  businessToolsNoticeChanged, businessToolsFaqAvailable, businessToolsFaqOperation,
  businessToolsFaqPreview, businessToolsAccountNoticePreview, businessToolsNoticeSaveConfirmed
} from '@/lib/business-tools-notices';

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '0.8rem' };
const field = { display: 'grid', gap: '0.3rem' };
const muted = { color: 'var(--muted)' };
// An untouched FAQ follows the refreshed server settings during a notice-only edit.
// Edited FAQ fields stay in the draft for explicit conflict review.
const reconcileDraft = (draft, previous, next) => businessToolsFaqOperation(previous, draft) === 'keep'
  ? { ...businessToolsNoticeDraft(next), purchaseNoticeEn: draft.purchaseNoticeEn, purchaseNoticeFr: draft.purchaseNoticeFr }
  : draft;

function FaqLink({ link, language }) {
  if (!link) return <span style={muted}>No FAQ link</span>;
  return <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: 'anywhere' }}>{link.label || (/^fr/i.test(language) ? 'Consulter la FAQ' : 'Read the FAQ')} ↗</a>;
}

function NoticePreview({ plan, draft, saved = false, unavailable = false }) {
  return <div style={grid}>{['En', 'Fr'].map((language) => {
    const french = language === 'Fr';
    const locale = french ? 'fr-CD' : 'en';
    const name = french ? plan.nameFr || plan.name || plan.code : plan.name || plan.code;
    const text = draft[`purchaseNotice${language}`];
    const link = draft.faqEnabled ? businessToolsFaqPreview(draft, locale) : null;
    return <div key={language} style={{ display: 'grid', alignContent: 'start', gap: '0.55rem', minWidth: 0, padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
      <strong>{french ? 'French' : 'English'}</strong>
      <div data-testid={saved ? `saved-purchase-notice-${language.toLowerCase()}` : undefined} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{unavailable ? 'Status unavailable' : text ? text.replaceAll('{0}', name) : `Uses the default ${french ? 'French' : 'English'} benefits.`}</div>
      {!unavailable ? <div><FaqLink link={link} language={locale} /></div> : null}
    </div>;
  })}</div>;
}

export function BusinessToolsPurchaseNoticePanel({ plan, canManage, busy = false, onPlanSaved, onBusyChange }) {
  const { refreshSession } = useAuth();
  const [saved, setSaved] = useState(() => businessToolsNoticeSettings(plan));
  const [draft, setDraft] = useState(() => businessToolsNoticeDraft(plan));
  const [baseVersion, setBaseVersion] = useState(plan.version);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requiresRefresh, setRequiresRefresh] = useState(false);
  const [reviewRequired, setReviewRequired] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [denied, setDenied] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const request = useRef(0);
  const lock = useRef(false);
  const changed = businessToolsNoticeChanged(saved, draft);
  const faqAvailable = businessToolsFaqAvailable(saved);
  const linkOperation = businessToolsFaqOperation(saved, draft);
  const current = useRef(null);
  current.current = { saved, changed, baseVersion, requiresRefresh, reviewRequired };
  useEffect(() => () => { request.current += 1; }, []);
  useEffect(() => {
    const next = businessToolsNoticeSettings(plan);
    if (!next || next === current.current.saved) return;
    setSaved(next);
    if (!current.current.changed && !current.current.requiresRefresh && !current.current.reviewRequired) {
      setDraft(businessToolsNoticeDraft(next)); setBaseVersion(next.version);
    } else if (next.version !== current.current.baseVersion) {
      const previous = current.current.saved;
      setDraft((value) => reconcileDraft(value, previous, next));
      setReviewRequired(true);
      setError('The plan changed. Review the latest saved settings before applying your draft.');
    }
  }, [plan]);

  const showError = async (err, prefix = '') => {
    if (err?.status === 401) await refreshSession(true);
    setError(`${prefix}${err?.status === 403 ? 'Permission denied. ' : ''}${err?.message || 'Unable to load or save purchase settings.'}`);
  };
  const refresh = async () => {
    if (lock.current || busy) return;
    lock.current = true; setLoading(true); setError(null); setInfo(null);
    const sequence = ++request.current;
    const keepDraft = current.current.changed || current.current.reviewRequired;
    const previous = current.current.saved;
    try {
      const plans = await api.businessTools.plans.list();
      if (sequence !== request.current) return;
      const target = Array.isArray(plans) ? plans.find((entry) => entry.code === plan.code) : null;
      if (!target) { setMissing(true); throw new Error('This plan is unavailable. Reload the plan list to choose another plan.'); }
      const next = businessToolsNoticeSettings(target);
      if (!next) throw new Error('Purchase settings are unavailable. Deploy the updated backend and refresh.');
      setSaved(next);
      if (!keepDraft) { setDraft(businessToolsNoticeDraft(next)); setBaseVersion(next.version); }
      else setDraft((value) => reconcileDraft(value, previous, next));
      setReviewRequired(Boolean(keepDraft));
      setRequiresRefresh(false); setUnverified(false); setMissing(false); onPlanSaved?.(next, { mutation: false });
      setInfo(keepDraft ? 'Latest settings loaded. Your draft is kept; review the saved settings before continuing.' : 'Saved settings refreshed.');
    } catch (err) { if (sequence === request.current) await showError(err); }
    finally { if (sequence === request.current) { lock.current = false; setLoading(false); } }
  };
  const save = async () => {
    if (!canManage || denied || busy || lock.current || !saved || !changed || requiresRefresh || reviewRequired || unverified || missing) return;
    let payload;
    try { payload = businessToolsNoticePayload(draft, baseVersion, reason, linkOperation); }
    catch (err) { setError(err.message); return; }
    lock.current = true; setSaving(true); setError(null); setInfo(null); onBusyChange?.(true);
    const sequence = ++request.current;
    try {
      const response = await api.businessTools.plans.updatePurchaseNotice(saved.code, payload);
      if (sequence !== request.current) return;
      const next = businessToolsNoticeSettings(response);
      if (!businessToolsNoticeSaveConfirmed(next, saved, payload)) {
        setUnverified(true); setRequiresRefresh(true);
        throw new Error('The save response could not be confirmed. Refresh saved settings before editing again.');
      }
      setSaved(next); setDraft(businessToolsNoticeDraft(next)); setBaseVersion(next.version); setReason('');
      onPlanSaved?.(next, { mutation: true, previousVersion: payload.version });
      setInfo('Purchase notices and FAQ settings saved.');
    } catch (err) {
      if (sequence === request.current) {
        if (err?.status === 403) setDenied(true);
        if (err?.status === 404) setMissing(true);
        const uncertain = !err?.status || err.status >= 500;
        if (err?.status === 409 || uncertain) setRequiresRefresh(true);
        await showError(err, err?.status === 409 ? 'The plan changed concurrently. Refresh and review the saved settings; your draft is kept. ' : uncertain ? 'Refresh saved settings before retrying; your draft is kept. ' : '');
      }
    } finally {
      onBusyChange?.(false);
      if (sequence === request.current) { lock.current = false; setSaving(false); }
    }
  };
  const disabled = !canManage || denied || busy || loading || saving || !saved || unverified || missing;
  const updateDraft = (key, value) => { setDraft((previous) => ({ ...previous, [key]: value })); setInfo(null); };
  return <section className="card business-tools-notices" aria-label="Purchase notices" style={{ display: 'grid', gap: '0.8rem' }}>
    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
      <div><h2 style={{ margin: 0 }}>Purchase notices & FAQ</h2><div style={{ marginTop: '0.3rem', ...muted }}>Benefits and an optional FAQ for {plan.tool === 'BUNDLE' ? 'the all-tools bundle' : 'this tool'}, in both pricing modes.</div></div>
      <button type="button" className="btn-neutral btn-sm" disabled={loading || saving || busy} onClick={() => void refresh()}>{loading ? 'Refreshing…' : requiresRefresh ? 'Refresh before retrying' : 'Refresh saved settings'}</button>
    </div>
    {!saved || unverified ? <div role="status">Purchase settings unavailable. Deploy the updated backend and refresh before editing.</div> : null}
    {error ? <div role="alert" className="alert alert-error">{error}</div> : null}
    {info ? <div role="status" className="alert alert-success">{info}</div> : null}
    {!canManage || denied ? <div style={muted}>Read only — Super Admin required to change purchase notices and FAQ links.</div> : null}
    <fieldset disabled={disabled} style={{ display: 'grid', gap: '0.8rem', border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className="sr-only">Purchase notice and FAQ settings</legend>
      <div style={grid}>{['En', 'Fr'].map((language) => <label key={language} style={field}>
        <span>{language === 'En' ? 'English' : 'French'} benefits</span>
        <textarea aria-label={`Purchase notice (${language === 'En' ? 'English' : 'French'})`} rows={4} maxLength={BUSINESS_TOOLS_NOTICE_LIMIT} value={draft[`purchaseNotice${language}`]} onChange={(event) => updateDraft(`purchaseNotice${language}`, event.target.value)} />
        <small style={muted}>{draft[`purchaseNotice${language}`].length}/4,000 · Blank uses the default</small>
      </label>)}</div>
      <small style={muted}>Plain text. {'{0}'} inserts the localized plan name. Inactive offers can still provide benefits and FAQ links.</small>
      <div style={{ display: 'grid', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto' }} checked={draft.faqEnabled} disabled={disabled || !faqAvailable} onChange={(event) => updateDraft('faqEnabled', event.target.checked)} /><span>FAQ link enabled</span></label>
        {!faqAvailable ? <small role="status" style={muted}>FAQ settings are unavailable on this backend. Notice-only saves preserve any existing link.</small> : draft.faqEnabled ? <div style={grid}>{[
          ['url', 'Primary / English FAQ URL', BUSINESS_TOOLS_FAQ_URL_LIMIT], ['urlFr', 'French FAQ URL (optional)', BUSINESS_TOOLS_FAQ_URL_LIMIT],
          ['labelEn', 'English link label (optional)', BUSINESS_TOOLS_FAQ_LABEL_LIMIT], ['labelFr', 'French link label (optional)', BUSINESS_TOOLS_FAQ_LABEL_LIMIT]
        ].map(([key, label, limit]) => <label key={key} style={field}><span>{label}</span><input type={key.startsWith('url') ? 'url' : 'text'} maxLength={limit} value={draft[key]} required={key === 'url'} onChange={(event) => updateDraft(key, event.target.value)} />{key === 'urlFr' ? <small style={muted}>Blank uses the primary URL</small> : null}</label>)}</div> : <small style={muted}>{linkOperation === 'remove' ? 'Saving will remove this plan’s FAQ link. Benefits stay in place.' : 'No FAQ link configured for this plan.'}</small>}
      </div>
    </fieldset>
    <details><summary style={{ cursor: 'pointer' }}>Preview English & French</summary><div style={{ marginTop: '0.7rem' }}><NoticePreview plan={saved || plan} draft={draft} /></div></details>
    <details open={reviewRequired || undefined}><summary style={{ cursor: 'pointer' }}>Saved settings · version {saved?.version ?? 'unavailable'}</summary><div style={{ marginTop: '0.7rem' }}><NoticePreview plan={saved || plan} draft={businessToolsNoticeDraft(saved)} saved unavailable={!saved || unverified} /></div></details>
    {reviewRequired ? <div className="alert" role="status" style={{ display: 'grid', gap: '0.5rem' }}><span>Your draft uses version {baseVersion}. Review the saved settings above (version {saved?.version}) before applying it.</span><button type="button" className="btn-neutral" disabled={disabled || requiresRefresh} style={{ width: 'fit-content' }} onClick={() => { setBaseVersion(saved.version); setReviewRequired(false); setError(null); setInfo('Draft kept with the reviewed version. Save when ready.'); }}>I reviewed the latest settings — keep my draft</button></div> : null}
    {canManage && !denied ? <>
      <label style={field}><span>Reason for change</span><textarea aria-label="Notice audit reason" rows={2} maxLength={1000} value={reason} disabled={disabled} onChange={(event) => setReason(event.target.value)} /></label>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' }}>
        <button type="button" className="btn-primary" disabled={disabled || !changed || !reason.trim() || requiresRefresh || reviewRequired} onClick={() => void save()}>{saving ? 'Saving…' : 'Save purchase notices & FAQ'}</button>
        <button type="button" className="btn-neutral" disabled={disabled || (!draft.purchaseNoticeEn && !draft.purchaseNoticeFr)} onClick={() => setDraft((previous) => ({ ...previous, purchaseNoticeEn: '', purchaseNoticeFr: '' }))}>Use default benefits</button>
        <button type="button" className="btn-neutral" disabled={disabled || (!changed && !reviewRequired)} onClick={() => { setDraft(businessToolsNoticeDraft(saved)); setBaseVersion(saved.version); setReviewRequired(false); setError(null); setInfo(null); }}>Discard changes</button>
        <span style={muted}>{changed ? 'Unsaved changes' : 'No unsaved changes'}</span>
      </div>
    </> : null}
    {saved ? <AccountNoticePreview key={`${saved.code}:${saved.version}`} tool={saved.tool || 'BUNDLE'} refreshSession={refreshSession} /> : null}
  </section>;
}

function AccountNoticePreview({ tool, refreshSession }) {
  const [accountId, setAccountId] = useState('');
  const [language, setLanguage] = useState('en');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const request = useRef(0), lock = useRef(false);
  useEffect(() => () => { request.current += 1; }, []);
  const preview = async () => {
    if (lock.current) return;
    if (!/^[1-9]\d*$/.test(accountId.trim()) || !Number.isSafeInteger(Number(accountId))) { setError('Enter a positive account ID.'); return; }
    lock.current = true; setLoading(true); setError(null); setResult(null);
    const sequence = ++request.current;
    try {
      const access = await api.businessTools.accounts.getAccess(accountId.trim(), language);
      if (sequence !== request.current) return;
      setResult(businessToolsAccountNoticePreview(access, tool));
    } catch (err) {
      if (sequence === request.current) {
        if (err?.status === 401) await refreshSession(true);
        setError(err?.message || 'Unable to load this account’s saved offer.');
      }
    } finally { if (sequence === request.current) { lock.current = false; setLoading(false); } }
  };
  return <details style={{ borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}><summary style={{ cursor: 'pointer' }}>Preview saved offer for an account</summary><div style={{ display: 'grid', gap: '0.7rem', marginTop: '0.7rem' }}>
    <div style={{ ...grid, alignItems: 'end' }}>
      <label style={field}><span>Account ID</span><input inputMode="numeric" value={accountId} disabled={loading} onChange={(event) => { setAccountId(event.target.value); setResult(null); }} /></label>
      <label style={field}><span>Preview language</span><select value={language} disabled={loading} onChange={(event) => { setLanguage(event.target.value); setResult(null); }}><option value="en">English</option><option value="fr-CD">French (fr-CD)</option></select></label>
      <button type="button" className="btn-neutral" disabled={loading || !accountId.trim()} onClick={() => void preview()}>{loading ? 'Loading…' : 'Load saved account offer'}</button>
    </div>
    {error ? <div role="alert">{error}</div> : null}
    {result ? <div style={{ display: 'grid', gap: '0.6rem' }}><div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{result.notice || 'No resolved benefits returned.'}</div><div><FaqLink link={result.link} language={language} />{result.linkSource ? <small style={muted}> · {result.linkSource}</small> : null}</div></div> : null}
  </div></details>;
}
