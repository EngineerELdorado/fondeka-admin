'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { failoverActivation, failoverFingerprint, failoverReason, failoverUtcInput, failoverUtcValue } from '@/lib/payout-failover';
import { rechargeConfiguration, rechargeDraft, rechargeResource } from '@/lib/recharge-failover';
import { Alert, Card, Field, formatInstant, useFailoverError } from '@/components/payout-failover/Common';
import ProductSummary from './ProductSummary';
import PreviewPanel from './PreviewPanel';

export default function PolicyPanel({ capabilities, canPublish, onPolicy, onInspect, onBusyChange, incoming }) {
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
    setInfo('Reviewed mapping added to the local draft. Publish explicitly to change the saved policy.');
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
    <Card title="Saved recharge policy">
      <div className="failover-heading"><strong data-testid="recharge-policy-status">{saved ? 'Revision ' + saved.revision + ' · Effective switch ' + (saved.configuration.enabled && !saved.emergencyDisabled ? 'ON' : 'OFF') : 'Status unavailable'}</strong><button type="button" className="btn-neutral" disabled={loading || busy} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh recharge policy'}</button></div>
      {saved ? <div className="failover-grid"><span>Configured: {saved.configuration.enabled ? 'Enabled' : 'Paused'}</span><span>Deployment emergency switch: {saved.emergencyDisabled ? 'SUPPRESSING CLAIMS' : 'Off'}</span><span>Cutover: {formatInstant(saved.configuration.createdAfter)}</span><span>Cutover floor: {formatInstant(saved.cutoverFloor)}</span></div> : null}
      {!verified && !loading ? <Alert>Saved policy unavailable. Refresh before making changes.</Alert> : null}
      {saved?.emergencyDisabled ? <Alert>The deployment emergency switch is active. Dashboard policy changes cannot bypass it.</Alert> : null}
      <Alert>{error}</Alert><Alert success>{info}</Alert>
    </Card>
    {canPublish && saved ? <Card title="Enable / pause recharge failover">
      <p>Uses the saved mappings and rollout accounts, preserving local drafts. Pause does not need a reachable provider catalog. An already committed provider attempt may still be sent.</p>
      <div className="failover-grid"><Field label="Recharge activation cutover (UTC)" help="Activation/resumption requires a future instant at or after the established cutover floor."><input type="datetime-local" step="1" disabled={disabled || saved.configuration.enabled} value={failoverUtcInput(cutover)} onChange={(event) => setCutover(failoverUtcValue(event.target.value))} /></Field><Field label="Recharge activation / pause reason"><textarea rows={2} maxLength={1000} disabled={disabled} value={activationReason} onChange={(event) => setActivationReason(event.target.value)} /></Field></div>
      <div className="failover-actions"><button type="button" className="btn-primary" disabled={disabled || reviewRequired || saved.configuration.enabled || !cutover || !activationReason.trim()} onClick={() => void write('enable')}>Enable / resume recharge failover</button><button type="button" className="btn-danger" disabled={disabled || reviewRequired || !saved.configuration.enabled || !activationReason.trim()} onClick={() => void write('pause')}>Pause new recharge claims</button></div>
    </Card> : null}
    {reviewRequired && saved ? <Card title="Review concurrent recharge changes">
      <p>The draft is retained. Review saved state before updating the expected revision. Publishing and activation remain blocked until confirmed state is available.</p>
      <div className="failover-grid"><div><strong>Current saved revision {saved.revision}</strong><pre>{JSON.stringify(saved.configuration, null, 2)}</pre></div><div><strong>Draft based on revision {baseRevision}</strong><pre>{JSON.stringify(validation.payload || draft, null, 2)}</pre></div></div>
      <div className="failover-actions"><button type="button" className="btn-neutral" disabled={disabled} onClick={() => { setBaseRevision(saved.revision); setBaseline(saved.configuration); setReviewRequired(false); setError(''); }}>I reviewed recharge differences; keep my draft</button><button type="button" className="btn-neutral" disabled={disabled} onClick={resetDraft}>Replace recharge draft with saved policy</button></div>
    </Card> : null}
    {draft ? <Card title="Local recharge policy draft">
      <p>Mappings run in list order. The source product, country and type match exactly; a reverse direction needs a separate reviewed mapping. Publish replaces the complete document immediately.</p>
      {!canPublish ? <small>You can prepare a local draft for preview. Only Super Admins can publish or activate it.</small> : null}
      <fieldset disabled={disabled} className="failover-card" style={{ border: 0, margin: 0, padding: 0 }}>
        <label className="failover-check"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((previous) => ({ ...previous, enabled: event.target.checked }))} />Recharge draft enabled</label>
        <div className="failover-grid"><Field label="Recharge draft cutover (UTC)"><input type="datetime-local" step="1" value={failoverUtcInput(draft.createdAfter)} onChange={(event) => setDraft((previous) => ({ ...previous, createdAfter: failoverUtcValue(event.target.value) }))} /></Field><Field label="Recharge rollout account IDs" help="Up to 1,000 comma/newline-separated IDs. Blank allows all otherwise eligible accounts."><textarea rows={3} value={draft.accountIds} onChange={(event) => setDraft((previous) => ({ ...previous, accountIds: event.target.value }))} /></Field></div>
        {draft.rules.map((rule, index) => <article className="failover-rule-summary" key={rule.id} aria-label={'Recharge mapping ' + (index + 1)}>
          <div className="failover-heading"><strong>Mapping {index + 1} · {rule.country} · {rule.type} · {rule.networkIdentity}</strong><div className="failover-actions"><button type="button" className="btn-neutral btn-sm" aria-label={'Move recharge mapping ' + (index + 1) + ' up'} disabled={disabled || index === 0} onClick={() => move(index, -1)}>Move up</button><button type="button" className="btn-neutral btn-sm" aria-label={'Move recharge mapping ' + (index + 1) + ' down'} disabled={disabled || index + 1 === draft.rules.length} onClick={() => move(index, 1)}>Move down</button><button type="button" className="btn-danger btn-sm" onClick={() => setDraft((previous) => ({ ...previous, rules: previous.rules.filter((item) => item.id !== rule.id) }))}>Remove mapping</button></div></div>
          <small>Stable ID: {rule.id}</small><label className="failover-check"><input type="checkbox" checked={rule.enabled} onChange={(event) => setDraft((previous) => ({ ...previous, rules: previous.rules.map((item) => item.id === rule.id ? { ...item, enabled: event.target.checked } : item) }))} />Mapping enabled</label>
          <div className="failover-grid"><ProductSummary product={rule.source} title="Approved source" /><ProductSummary product={rule.target} title="Approved target" /></div>
          <span>Approval expiry: {formatInstant(rule.expiresAt)}{Date.parse(rule.expiresAt) <= Date.now() ? ' · EXPIRED — review before activation' : ''}</span><span>Maximum additional supplier cost: {rule.maxAdditionalCost} {rule.source.currency}</span><span>Executable source conditions: {rule.failureCodes.join(', ')}</span>
          <details><summary style={{ cursor: 'pointer' }}>Recorded benefits review</summary><p style={{ whiteSpace: 'pre-wrap' }}>{rule.benefitsReview}</p></details>
          <button type="button" className="btn-neutral" onClick={() => onInspect(rule)}>Inspect / edit this mapping</button>
        </article>)}
        <button type="button" className="btn-neutral" disabled={disabled || draft.rules.length >= 100} onClick={() => onInspect(null)}>Inspect a new product pair</button>
      </fieldset>
      <small>{draft.rules.length}/100 mappings. Product amounts and fingerprints can be changed only by inspecting and reviewing a pair. Inspections not copied into this draft remain separate.</small>
      {validation.error ? <Alert>{validation.error}</Alert> : null}
      {canPublish ? <><Field label="Recharge publication reason"><textarea rows={2} maxLength={1000} value={reason} disabled={disabled} onChange={(event) => setReason(event.target.value)} /></Field><div className="failover-actions"><button type="button" className="btn-primary" disabled={disabled || reviewRequired || !changed && saved.revision !== 0 || !validation.payload || !reason.trim()} onClick={() => void write('publish')}>{busy ? 'Publishing recharge policy…' : 'Publish recharge policy'}</button><button type="button" className="btn-neutral" disabled={disabled || !changed} onClick={resetDraft}>Discard recharge draft</button></div></> : null}
      {!canPublish ? <button type="button" className="btn-neutral" disabled={disabled || !changed} onClick={resetDraft}>Discard recharge preview draft</button> : null}
      <span>{changed ? 'Unsaved recharge draft · based on revision ' + baseRevision : 'Recharge draft matches saved policy'}</span>
    </Card> : null}
    <PreviewPanel saved={saved} configuration={validation.payload} capabilities={capabilities} />
  </div>;
}
