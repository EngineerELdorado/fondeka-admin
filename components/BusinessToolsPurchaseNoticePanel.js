'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { BUSINESS_TOOLS_NOTICE_LIMIT, businessToolsNoticeSettings, businessToolsNoticePayload, businessToolsNoticeDraft, sameBusinessToolsNotices } from '@/lib/business-tools-notices';

export function BusinessToolsPurchaseNoticePanel({ plan, canManage, busy = false, onPlanSaved, onBusyChange }) {
  const { refreshSession } = useAuth();
  const [saved, setSaved] = useState(() => businessToolsNoticeSettings(plan));
  const [draft, setDraft] = useState(() => businessToolsNoticeDraft(plan));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requiresRefresh, setRequiresRefresh] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const request = useRef(0);
  const lock = useRef(false);
  const changed = Boolean(saved && (draft.purchaseNoticeEn.trim() !== (saved.purchaseNoticeEn || '') || draft.purchaseNoticeFr.trim() !== (saved.purchaseNoticeFr || '')));
  const current = useRef({ saved, changed }); current.current = { saved, changed };
  useEffect(() => () => { request.current += 1; }, []);
  useEffect(() => {
    const next = businessToolsNoticeSettings(plan);
    if (!next || next === current.current.saved) return;
    const sameCopy = sameBusinessToolsNotices(current.current.saved, next);
    setSaved(next);
    if (!current.current.changed) setDraft(businessToolsNoticeDraft(next));
    else if (!sameCopy) {
      setRequiresRefresh(true);
      setError('The saved notices changed. Refresh saved notices before retrying. Your draft has been kept.');
    }
  }, [plan]);

  const showError = async (err, prefix = '') => {
    if (err?.status === 401) await refreshSession(true);
    setError(`${prefix}${err?.status === 403 ? 'Permission denied. ' : ''}${err?.message || 'Unable to load or save purchase notices.'}`);
  };
  const refresh = async () => {
    if (lock.current || busy) return;
    lock.current = true; setLoading(true); setError(null); setInfo(null);
    const sequence = ++request.current;
    const keepDraft = current.current.changed;
    try {
      const plans = await api.businessTools.plans.list();
      const next = businessToolsNoticeSettings(Array.isArray(plans) ? plans.find((entry) => entry.code === plan.code) : null);
      if (!next) throw new Error('Purchase notice settings are unavailable. Deploy the updated backend and refresh.');
      if (sequence !== request.current) return;
      setSaved(next); if (!keepDraft) setDraft(businessToolsNoticeDraft(next));
      setRequiresRefresh(false); setUnverified(false); onPlanSaved?.(next, { mutation: false });
      setInfo(keepDraft ? 'Saved notices refreshed. Review them below; your draft has been kept.' : 'Saved notices refreshed.');
    } catch (err) { if (sequence === request.current) await showError(err); }
    finally { if (sequence === request.current) { lock.current = false; setLoading(false); } }
  };
  const save = async () => {
    if (!canManage || busy || lock.current || !saved || !changed || requiresRefresh || unverified) return;
    let payload;
    try { payload = businessToolsNoticePayload(draft, saved.version, reason); }
    catch (err) { setError(err.message); return; }
    lock.current = true; setSaving(true); setError(null); setInfo(null); onBusyChange?.(true);
    const sequence = ++request.current;
    try {
      const response = await api.businessTools.plans.updatePurchaseNotice(saved.code, payload);
      if (sequence !== request.current) return;
      const next = businessToolsNoticeSettings(response);
      if (!next || next.code !== saved.code) {
        setUnverified(true);
        throw new Error('Notices were saved, but the returned saved state is unavailable. Refresh saved notices before editing again.');
      }
      setSaved(next); setDraft(businessToolsNoticeDraft(next)); setReason('');
      onPlanSaved?.(next, { mutation: true, previousVersion: payload.version });
      setInfo('Purchase notices saved. Clients receive them when they next refresh Business Tools access.');
    } catch (err) {
      if (sequence === request.current) {
        if (err?.status === 409) setRequiresRefresh(true);
        await showError(err, err?.status === 409 ? 'The plan changed concurrently. Refresh saved notices before retrying. Your draft has been kept. ' : '');
      }
    } finally {
      onBusyChange?.(false);
      if (sequence === request.current) { lock.current = false; setSaving(false); }
    }
  };
  const disabled = !canManage || busy || loading || saving || !saved || unverified;
  return <section className="card business-tools-notices" aria-label="Purchase notices" style={{ display: 'grid', gap: '0.8rem' }}>
    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}><div><h2 style={{ margin: 0, fontSize: '1.1rem' }}>Purchase notices</h2><div style={{ marginTop: '0.3rem', color: 'var(--muted)', fontSize: '13px' }}>Message shown before buying {plan.name || plan.code}.</div></div><button type="button" className="btn-neutral btn-sm" disabled={loading || saving || busy} onClick={() => void refresh()}>{loading ? 'Refreshing…' : 'Refresh saved notices'}</button></div>
    {!saved || unverified ? <div role="status">Purchase notice settings unavailable. Deploy the updated backend and refresh before editing.</div> : null}
    {error ? <div role="alert" className="alert alert-error">{error}</div> : null}
    {info ? <div role="status" className="alert alert-success">{info}</div> : null}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '0.8rem' }}>
      {['En', 'Fr'].map((language) => <div key={language} style={{ display: 'grid', gap: '0.5rem', minWidth: 0 }}>
        {canManage ? <label style={{ display: 'grid', gap: '0.3rem' }}><span>Purchase notice ({language === 'En' ? 'English' : 'French'})</span><textarea aria-label={`Purchase notice (${language === 'En' ? 'English' : 'French'})`} rows={4} maxLength={BUSINESS_TOOLS_NOTICE_LIMIT} value={draft[`purchaseNotice${language}`]} disabled={disabled} onChange={(event) => { setDraft((previous) => ({ ...previous, [`purchaseNotice${language}`]: event.target.value })); setInfo(null); }} /><small style={{ color: 'var(--muted)' }}>{draft[`purchaseNotice${language}`].length}/4,000 characters</small></label> : null}
        <div style={{ padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '10px', overflowWrap: 'anywhere' }}><strong style={{ fontSize: '12px' }}>Saved notice ({language === 'En' ? 'English' : 'French'})</strong><div data-testid={`saved-purchase-notice-${language.toLowerCase()}`} style={{ marginTop: '0.35rem', whiteSpace: 'pre-wrap', color: 'var(--muted)', fontSize: '13px' }}>{!saved || unverified ? 'Status unavailable' : saved[`purchaseNotice${language}`] || `Uses the default ${language === 'En' ? 'English' : 'French'} notice.`}</div></div>
      </div>)}
    </div>
    <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Plain text. Leave a language blank to use its default notice. Optional <code>{'{0}'}</code> inserts the plan’s localized name. This message does not change what the purchase unlocks.</div>
    {canManage ? <>
      <label style={{ display: 'grid', gap: '0.3rem' }}><span>Notice audit reason</span><textarea aria-label="Notice audit reason" rows={2} maxLength={1000} value={reason} disabled={disabled} onChange={(event) => setReason(event.target.value)} /></label>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' }}><button type="button" className="btn-primary" disabled={disabled || !changed || !reason.trim() || requiresRefresh} onClick={() => void save()}>{saving ? 'Saving…' : 'Save purchase notices'}</button><button type="button" className="btn-neutral" disabled={disabled || (!draft.purchaseNoticeEn && !draft.purchaseNoticeFr)} onClick={() => setDraft({ purchaseNoticeEn: '', purchaseNoticeFr: '' })}>Use default notices</button><button type="button" className="btn-neutral" disabled={disabled || !changed} onClick={() => { setDraft(businessToolsNoticeDraft(saved)); setError(null); }}>Discard notice changes</button><span style={{ color: 'var(--muted)', fontSize: '13px' }}>{changed ? 'Unsaved notice changes' : 'No unsaved notice changes'}</span></div>
    </> : <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Read only — Super Admin required to change purchase notices.</div>}
  </section>;
}
