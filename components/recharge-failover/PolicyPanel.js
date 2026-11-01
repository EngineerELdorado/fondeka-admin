'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { failoverActivation, failoverFingerprint, failoverReason, failoverUtcInput, failoverUtcValue } from '@/lib/payout-failover';
import { rechargeConfiguration, rechargeDraft, rechargeResource } from '@/lib/recharge-failover';
import { Alert, Card, Field, formatInstant, useFailoverError } from '@/components/payout-failover/Common';
import { failureConditionLabel } from '@/lib/failover-presentation';
import { SetupStep } from '@/components/failover/Experience';
import ProductSummary from './ProductSummary';
import PreviewPanel from './PreviewPanel';

export default function PolicyPanel({ capabilities, canPublish, onPolicy, onInspect, onBusyChange, incoming, view = 'setup', onSetup }) {
  const [saved, setSaved] = useState(null), [draft, setDraft] = useState(null), [baseline, setBaseline] = useState(null), [baseRevision, setBaseRevision] = useState(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [verified, setVerified] = useState(false), [reviewRequired, setReviewRequired] = useState(false);
  const [error, setError] = useState(''), [info, setInfo] = useState(''), [reason, setReason] = useState(''), [activationReason, setActivationReason] = useState(''), [cutover, setCutover] = useState(null);
  const sequence = useRef(0), lock = useRef(false), current = useRef({}), applied = useRef(null);
  const fail = useFailoverError(setError);
  const validation = useMemo(() => {
    if (!draft) return { payload: null, error: '' };
    try { return { payload: rechargeConfiguration(draft, capabilities), error: '' }; }
    catch (err) { return { payload: null, error: err.message }; }
  }, [draft, capabilities]);
  const changed = Boolean(draft && baseline && failoverFingerprint(validation.payload || draft) !== failoverFingerprint(baseline));
  current.current = { changed, baseRevision };
  const accept = useCallback((response, preserve = false) => {
    const snapshot = rechargeResource(response);
    setSaved(snapshot); setVerified(true); onPolicy(snapshot);
    if (preserve && current.current.changed) {
      if (snapshot.revision !== current.current.baseRevision) setReviewRequired(true);
    } else {
      setDraft(rechargeDraft(snapshot.configuration)); setBaseline(snapshot.configuration); setBaseRevision(snapshot.revision); setReviewRequired(false);
    }
    return snapshot;
  }, [onPolicy]);
  const load = useCallback(async (clearError = true) => {
    const token = ++sequence.current;
    setLoading(true); if (clearError) { setError(''); setInfo(''); }
    try { const response = await api.rechargeFailover.policy(); if (token === sequence.current) accept(response, true); }
    catch (err) { if (token === sequence.current) { setVerified(false); await fail(err); } }
    finally { if (token === sequence.current) setLoading(false); }
  }, [accept, fail]);
  useEffect(() => { void load(); return () => { sequence.current += 1; }; }, [load]);
  useEffect(() => {
    if (!incoming || applied.current === incoming.token || !draft) return;
    applied.current = incoming.token;
    const exists = draft.rules.some((rule) => rule.id === incoming.rule.id);
    if (!exists && draft.rules.length >= 100) { setError('At most 100 mappings are allowed. Remove a mapping before adding this reviewed pair.'); return; }
    setDraft((previous) => ({ ...previous, rules: exists ? previous.rules.map((rule) => rule.id === incoming.rule.id ? incoming.rule : rule) : [...previous.rules, incoming.rule] }));
    setInfo('Reviewed pair added to this draft. Select Save recharge backup rules to update the saved setup.');
  }, [incoming, draft]);
  const resetDraft = () => {
    setDraft(rechargeDraft(saved.configuration)); setBaseline(saved.configuration); setBaseRevision(saved.revision); setReviewRequired(false); setError('');
  };
  async function write(action) {
    if (!canPublish || lock.current || !verified || loading || !saved || reviewRequired) return;
    let payload;
    try {
      payload = action === 'publish' ? { expectedRevision: baseRevision, reason: failoverReason(reason), configuration: rechargeConfiguration(draft, capabilities) }
        : failoverActivation(saved, action === 'enable', cutover, activationReason);
    } catch (err) { setError(err.message); return; }
    lock.current = true; setBusy(true); onBusyChange(true); setError(''); setInfo('');
    let committed = false;
    try {
      const response = action === 'publish' ? await api.rechargeFailover.publish(payload) : await api.rechargeFailover.activate(payload);
      committed = true;
      const snapshot = rechargeResource(response);
      if (snapshot.revision <= payload.expectedRevision) throw new Error('The backend did not confirm a newly published recharge revision.');
      accept(response, action !== 'publish');
      if (action === 'publish') setReason(''); else { setActivationReason(''); setCutover(null); }
      setInfo('Published recharge revision ' + snapshot.revision + '. ' + (snapshot.emergencyDisabled ? 'The deployment emergency switch blocks new claims.' : snapshot.configuration.enabled ? 'Configured on; cutover, product approvals and eligibility still apply.' : 'New claims are paused. Existing attempt and refund protections remain active.'));
    } catch (err) {
      if (committed) { setVerified(false); setReviewRequired(true); }
      await fail(committed ? new Error('The write succeeded, but its saved state is unavailable. Refresh before editing again. ' + err.message) : err);
      if (err.status === 409) { await load(false); setReviewRequired(true); setError('Another administrator published a newer recharge revision. Your draft is retained. Review the current policy and draft before publishing again.'); }
    } finally { lock.current = false; setBusy(false); onBusyChange(false); }
  }
  const disabled = loading || busy || !verified || Boolean(incoming && applied.current !== incoming.token);
  const move = (index, offset) => setDraft((previous) => { const rules = [...previous.rules]; [rules[index], rules[index + offset]] = [rules[index + offset], rules[index]]; return { ...previous, rules }; });
  return <div className="failover-card">
    <Card title="Saved recharge setup">
      <div className="failover-heading"><strong data-testid="recharge-policy-status">{saved ? 'Backups ' + (saved.configuration.enabled && !saved.emergencyDisabled ? 'ON' : 'OFF') + ' · Saved version ' + saved.revision : 'Status unavailable'}</strong><button type="button" className="btn-neutral" disabled={loading || busy} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh recharge policy'}</button></div>
      {saved ? <details className="failover-technical"><summary>Saved configuration details</summary><div className="failover-grid"><span>Configured: {saved.configuration.enabled ? 'Enabled' : 'Paused'}</span><span>Deployment emergency switch: {saved.emergencyDisabled ? 'SUPPRESSING CLAIMS' : 'Off'}</span><span>Purchases created after: {formatInstant(saved.configuration.createdAfter)}</span><span>Earliest allowed start: {formatInstant(saved.cutoverFloor)}</span></div></details> : null}
      {!verified && !loading ? <Alert>Saved policy unavailable. Refresh before making changes.</Alert> : null}
      {saved?.emergencyDisabled ? <Alert>The deployment emergency switch is active. Dashboard policy changes cannot bypass it.</Alert> : null}
      <Alert>{error}</Alert><Alert success>{info}</Alert>
    </Card>
    {view === 'activation' && saved ? <Card title="Turn recharge backups on or pause them">
      <p>Uses the saved product pairs and covered accounts. Unsaved changes are not enabled. Pausing stops new backup attempts; already-reserved attempts and recovery continue.</p>
      {changed ? <div className="failover-notice">You have unsaved product-pair or account changes. These controls use the previously saved version.</div> : null}
      {!saved.configuration.rules.some((rule) => rule.enabled) ? <div className="failover-notice">Save at least one enabled, reviewed product pair before turning on from this screen. {onSetup ? <button type="button" className="btn-neutral btn-sm" onClick={onSetup}>Go to backup setup</button> : null}</div> : null}
      {canPublish ? <>
      <div className="failover-grid"><Field label="Start for purchases created after (UTC)" help="Choose a future time when turning on or resuming." tip="This uses the original purchase creation time. Older purchases, including paused-period and permanent-legacy purchases, cannot be adopted by moving the boundary backwards."><input type="datetime-local" step="1" disabled={disabled || saved.configuration.enabled} value={failoverUtcInput(cutover)} onChange={(event) => setCutover(failoverUtcValue(event.target.value))} /></Field><Field label="Reason for turning on or pausing" help="Required audit note for this rollout or incident."><textarea rows={2} maxLength={1000} disabled={disabled} value={activationReason} onChange={(event) => setActivationReason(event.target.value)} /></Field></div>
      <div className="failover-actions"><button type="button" className="btn-primary" disabled={disabled || reviewRequired || saved.configuration.enabled || !saved.configuration.rules.some((rule) => rule.enabled) || !cutover || !activationReason.trim()} onClick={() => void write('enable')}>Turn on recharge backups</button><button type="button" className="btn-danger" disabled={disabled || reviewRequired || !saved.configuration.enabled || !activationReason.trim()} onClick={() => void write('pause')}>Pause recharge backups</button></div>
      </> : <p>Read-only access. A Super Admin can enable or pause this saved setup.</p>}
    </Card> : null}
    {reviewRequired && saved ? <Card title="Review concurrent recharge changes">
      <p>The draft is retained. Review saved state before updating the expected revision. Publishing and activation remain blocked until confirmed state is available.</p>
      <div className="failover-grid"><div><strong>Current saved revision {saved.revision}</strong><pre>{JSON.stringify(saved.configuration, null, 2)}</pre></div><div><strong>Draft based on revision {baseRevision}</strong><pre>{JSON.stringify(validation.payload || draft, null, 2)}</pre></div></div>
      <div className="failover-actions"><button type="button" className="btn-neutral" disabled={disabled} onClick={() => { setBaseRevision(saved.revision); setBaseline(saved.configuration); setReviewRequired(false); setError(''); }}>I reviewed recharge differences; keep my draft</button><button type="button" className="btn-neutral" disabled={disabled} onClick={resetDraft}>Replace recharge draft with saved policy</button></div>
    </Card> : null}
    {view === 'setup' && draft ? <Card title="Save reviewed product pairs and covered accounts">
      <p>Review the product pairs copied from inspection, choose the covered customer accounts, then save. The first matching enabled pair is used. Each direction needs its own reviewed pair.</p>
      {!canPublish ? <small>You can prepare a local draft for preview. Only Super Admins can publish or activate it.</small> : null}
      <fieldset disabled={disabled} className="failover-card" style={{ border: 0, margin: 0, padding: 0 }}>
        <SetupStep number="1" title="Review the product pairs in this draft">Use product inspection to add or update a pair. Amounts and approval fingerprints cannot be edited here.</SetupStep>
        {draft.rules.map((rule, index) => <article className="failover-rule-summary" key={rule.id} aria-label={'Recharge mapping ' + (index + 1)}>
          <div className="failover-heading"><strong>Pair {index + 1} · {rule.country} · {rule.type} · {rule.networkIdentity}</strong><div className="failover-actions"><button type="button" className="btn-neutral btn-sm" aria-label={'Move recharge mapping ' + (index + 1) + ' up'} disabled={disabled || index === 0} onClick={() => move(index, -1)}>Move up</button><button type="button" className="btn-neutral btn-sm" aria-label={'Move recharge mapping ' + (index + 1) + ' down'} disabled={disabled || index + 1 === draft.rules.length} onClick={() => move(index, 1)}>Move down</button><button type="button" className="btn-danger btn-sm" onClick={() => setDraft((previous) => ({ ...previous, rules: previous.rules.filter((item) => item.id !== rule.id) }))}>Remove pair</button></div></div>
          <details className="failover-technical"><summary>Pair identifier</summary><code>{rule.id}</code></details><label className="failover-check"><input type="checkbox" checked={rule.enabled} onChange={(event) => setDraft((previous) => ({ ...previous, rules: previous.rules.map((item) => item.id === rule.id ? { ...item, enabled: event.target.checked } : item) }))} />Use this product pair</label>
          <div className="failover-grid"><ProductSummary product={rule.source} title="Primary provider product" /><ProductSummary product={rule.target} title="Backup provider product" /></div>
          <span>Approval expiry: {formatInstant(rule.expiresAt)}{Date.parse(rule.expiresAt) <= Date.now() ? ' · EXPIRED — review before activation' : ''}</span><span>Allowed extra supplier cost: {rule.maxAdditionalCost} {rule.source.currency}</span><span>Allowed primary failure: {rule.failureCodes.map(failureConditionLabel).join('; ')}</span>
          <details><summary style={{ cursor: 'pointer' }}>Recorded benefits review</summary><p style={{ whiteSpace: 'pre-wrap' }}>{rule.benefitsReview}</p></details>
          <button type="button" className="btn-neutral" onClick={() => onInspect(rule)}>Reinspect or edit this pair</button>
        </article>)}
        <button type="button" className="btn-neutral" disabled={disabled || draft.rules.length >= 100} onClick={() => onInspect(null)}>Review another product pair</button>
        <SetupStep number="2" title="Choose customer accounts">Use IDs from Accounts, not Business IDs. A blank list covers all otherwise eligible accounts.</SetupStep>
        <Field label="Customer account IDs" help="Up to 1,000 comma/newline-separated IDs." tip="A blank list covers all eligible accounts; it is not an empty pilot. Enter specific customer account IDs for a limited rollout."><textarea rows={3} value={draft.accountIds} onChange={(event) => setDraft((previous) => ({ ...previous, accountIds: event.target.value }))} /></Field>
        <p className="failover-notice">Coverage in this draft: {String(draft.accountIds).trim() ? 'selected customer accounts' : 'all eligible accounts'}.</p>
        <details className="failover-technical"><summary>Advanced: enabled value and creation boundary in this draft</summary><div className="failover-card"><label className="failover-check"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((previous) => ({ ...previous, enabled: event.target.checked }))} />Keep recharge backups enabled when this setup is saved</label><Field label="Draft purchase creation boundary (UTC)" help="Keep the saved boundary when editing an active setup."><input type="datetime-local" step="1" value={failoverUtcInput(draft.createdAfter)} onChange={(event) => setDraft((previous) => ({ ...previous, createdAfter: failoverUtcValue(event.target.value) }))} /></Field></div></details>
      </fieldset>
      <small>{draft.rules.length}/100 product pairs. Product amounts and fingerprints can be changed only by inspecting and reviewing a pair. Inspections not copied into this draft remain separate.</small>
      {validation.error ? <Alert>{validation.error}</Alert> : null}
      <SetupStep number="3" title="Save the complete setup">{draft.enabled ? 'This draft is enabled. Saving applies the complete setup to live backup checks immediately.' : 'Saving this off setup does not turn backups on. Use Turn on / pause after saving.'}</SetupStep>
      {canPublish ? <><Field label="Reason for this setup change" help="Required audit note describing the reviewed products or account changes."><textarea rows={2} maxLength={1000} value={reason} disabled={disabled} onChange={(event) => setReason(event.target.value)} /></Field><div className="failover-actions"><button type="button" className="btn-primary" disabled={disabled || reviewRequired || !changed && saved.revision !== 0 || !validation.payload || !reason.trim()} onClick={() => void write('publish')}>{busy ? 'Saving recharge setup…' : 'Save recharge backup rules'}</button><button type="button" className="btn-neutral" disabled={disabled || !changed} onClick={resetDraft}>Discard unsaved changes</button></div></> : null}
      {!canPublish ? <button type="button" className="btn-neutral" disabled={disabled || !changed} onClick={resetDraft}>Discard recharge preview draft</button> : null}
      <span>{changed ? 'Unsaved recharge draft · based on revision ' + baseRevision : 'Recharge draft matches saved policy'}</span>
    </Card> : null}
    <div hidden={view !== 'setup'}><PreviewPanel saved={saved} configuration={validation.payload} capabilities={capabilities} /></div>
  </div>;
}
