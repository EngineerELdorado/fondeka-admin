'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { CatalogSelect } from '@/components/CatalogSelect';
import { failoverActivation, failoverCodes, failoverConfiguration, failoverDraft, failoverFingerprint, failoverReason, failoverResource, failoverRoutes, failoverUtcInput, failoverUtcValue, newFailoverRule } from '@/lib/payout-failover';
import { Alert, Card, Field, ValidationReport, formatInstant, useFailoverError } from './Common';
import { failureConditionLabel } from '@/lib/failover-presentation';
import { SetupStep } from '@/components/failover/Experience';
import PreviewPanel from './PreviewPanel';

export default function PolicyPanel({ capabilities, canPublish, onRevision, onPolicy, view = 'setup', onSetup }) {
  const [saved, setSaved] = useState(null), [draft, setDraft] = useState(null), [baseline, setBaseline] = useState(null), [baseRevision, setBaseRevision] = useState(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [verified, setVerified] = useState(false), [reviewRequired, setReviewRequired] = useState(false);
  const [error, setError] = useState(''), [info, setInfo] = useState(''), [reason, setReason] = useState('');
  const [activationReason, setActivationReason] = useState(''), [cutover, setCutover] = useState(null);
  const [routes, setRoutes] = useState([]), [routesLoading, setRoutesLoading] = useState(true), [routesError, setRoutesError] = useState('');
  const fail = useFailoverError(setError), routeFail = useFailoverError(setRoutesError);
  const sequence = useRef(0), lock = useRef(false), current = useRef({});
  const validation = useMemo(() => {
    if (!draft) return { payload: null, error: '' };
    try { return { payload: failoverConfiguration(draft, capabilities), error: '' }; }
    catch (err) { return { payload: null, error: err.message }; }
  }, [draft, capabilities]);
  const changed = Boolean(draft && baseline && failoverFingerprint(validation.payload || draft) !== failoverFingerprint(baseline));
  current.current = { changed, baseRevision };
  const accept = useCallback((response, preserveDraft = false) => {
    const resource = failoverResource(response);
    setSaved(resource); setVerified(true); onRevision(resource.policy.revision); onPolicy?.(resource);
    if (preserveDraft && current.current.changed) {
      if (resource.policy.revision !== current.current.baseRevision) setReviewRequired(true);
    } else {
      setDraft(failoverDraft(resource.policy.configuration)); setBaseline(resource.policy.configuration);
      setBaseRevision(resource.policy.revision); setReviewRequired(false);
    }
    return resource;
  }, [onRevision, onPolicy]);
  const load = useCallback(async (preserveDraft = true, clearError = true) => {
    const token = ++sequence.current;
    setLoading(true); if (clearError) { setError(''); setInfo(''); }
    try {
      const response = await api.payoutFailover.policy();
      if (token === sequence.current) accept(response, preserveDraft);
    } catch (err) { if (token === sequence.current) { setVerified(false); await fail(err); } }
    finally { if (token === sequence.current) setLoading(false); }
  }, [accept, fail]);
  useEffect(() => { void load(); return () => { sequence.current += 1; }; }, [load]);
  const loadRoutes = useCallback(async () => {
    setRoutesLoading(true); setRoutesError('');
    try { setRoutes(await api.paymentMethodPaymentProviders.options({ paymentMethodType: 'MOBILE_MONEY' })); }
    catch (err) { await routeFail(err); }
    finally { setRoutesLoading(false); }
  }, [routeFail]);
  useEffect(() => { void loadRoutes(); }, [loadRoutes]);
  const replaceDraft = () => {
    setDraft(failoverDraft(saved.policy.configuration)); setBaseline(saved.policy.configuration); setBaseRevision(saved.policy.revision);
    setReviewRequired(false); setError(''); setInfo('Draft now matches the current saved revision.');
  };
  async function write(action) {
    if (!canPublish || lock.current || loading || !saved || !verified || reviewRequired) return;
    let payload;
    try {
      payload = action === 'publish'
        ? { expectedRevision: baseRevision, reason: failoverReason(reason), configuration: failoverConfiguration(draft, capabilities) }
        : failoverActivation(saved.policy, action === 'enable', cutover, activationReason);
    } catch (err) { setError(err.message); return; }
    lock.current = true; setBusy(true); setError(''); setInfo('');
    let committed = false;
    try {
      const response = action === 'publish' ? await api.payoutFailover.publish(payload) : await api.payoutFailover.activate(payload);
      committed = true;
      const confirmed = failoverResource(response);
      if (confirmed.policy.source !== 'DATABASE' || confirmed.policy.revision <= payload.expectedRevision) throw new Error('The backend did not confirm a newly published revision.');
      const resource = accept(response, action !== 'publish');
      if (action === 'publish') setReason(''); else { setActivationReason(''); setCutover(null); }
      setInfo('Published revision ' + resource.policy.revision + '. ' + (resource.policy.effectiveEnabled ? 'Configured on; cutover, rollout and eligibility checks still apply.' : resource.policy.emergencyDisabled ? 'The infrastructure emergency switch suppresses failover.' : 'New alternate claims are paused.'));
    } catch (err) {
      if (committed) { setVerified(false); setReviewRequired(true); }
      await fail(committed ? new Error('The write succeeded, but its saved state could not be confirmed. Refresh before publishing again. ' + err.message) : err);
      if (err.status === 409) {
        await load(true, false);
        setReviewRequired(true);
        setError('Another admin published a newer revision. Your draft is retained. Review the current policy and your draft before retrying.');
      }
    } finally { lock.current = false; setBusy(false); }
  }
  const policy = saved?.policy, disabled = !canPublish || busy || loading || !verified;
  const sourceRoutes = failoverRoutes(routes, capabilities);
  const reasonReady = reason.trim().length > 0 && reason.trim().length <= 1000;
  return <div className="failover-card">
    <Card title="Saved setup">
      <div className="failover-heading"><strong data-testid="failover-policy-status">{policy ? 'Backups ' + (policy.effectiveEnabled ? 'ON' : 'OFF') + ' · Saved version ' + policy.revision : 'Status unavailable'}</strong><button type="button" className="btn-neutral" disabled={loading || busy} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh saved policy'}</button></div>
      {policy ? <details className="failover-technical"><summary>Saved configuration details</summary><div className="failover-grid"><span>Configured switch: {policy.configuration.enabled ? 'Enabled' : 'Paused'}</span><span>Emergency switch: {policy.emergencyDisabled ? 'SUPPRESSING FAILOVER' : 'Off'}</span><span>Payments created after: {formatInstant(policy.configuration.createdAfter)}</span><span>Earliest allowed start: {formatInstant(policy.cutoverFloor)}</span><span>Updated: {formatInstant(policy.updatedAt)}</span><span>Actor: {policy.updatedByAdminId ?? 'Deployment'}</span></div></details> : null}
      {!verified && !loading ? <Alert>Saved state is unavailable. Refresh before publishing or activating.</Alert> : null}
      {policy?.emergencyDisabled ? <Alert>The infrastructure emergency switch is on. Dashboard changes cannot bypass it.</Alert> : null}
      <Alert>{error}</Alert><Alert success>{info}</Alert>
      {saved ? <details className="failover-technical" open={saved.validation.issues.some((issue) => issue.severity === 'ERROR')}><summary>Saved setup checks</summary><ValidationReport report={saved.validation} title="Saved setup" /></details> : null}
    </Card>
    {view === 'activation' && policy ? <Card title="Turn payout backups on or pause them">
      <p>This uses the saved backup rules and customer accounts. It never includes unsaved edits. Pausing stops new backup attempts; already-reserved attempts and ordinary payment processing continue.</p>
      {changed ? <div className="failover-notice">You have unsaved setup changes. These controls use the previously saved version; your draft remains separate.</div> : null}
      {!policy.configuration.rules.some((rule) => rule.enabled) ? <div className="failover-notice">Save at least one enabled backup rule before turning on from this screen. {onSetup ? <button type="button" className="btn-neutral btn-sm" onClick={onSetup}>Go to backup setup</button> : null}</div> : null}
      {canPublish ? <><div className="failover-grid">
        <Field label="Start for payments created after (UTC)" help="Choose a future time when turning on or resuming." tip="This is a boundary on the original payment creation time. Older payments are excluded even if their error arrives later. Resuming requires a new future time that cannot move behind the saved minimum."><input type="datetime-local" step="1" value={failoverUtcInput(cutover)} disabled={disabled || policy.configuration.enabled} onChange={(event) => setCutover(failoverUtcValue(event.target.value))} /></Field>
        <Field label="Reason for turning on or pausing" help="Required audit note. Explain the pilot, rollout or incident."><textarea rows={2} maxLength={1000} disabled={disabled} value={activationReason} onChange={(event) => setActivationReason(event.target.value)} /></Field>
      </div><div className="failover-actions"><button type="button" className="btn-primary" disabled={disabled || reviewRequired || policy.configuration.enabled || !policy.configuration.rules.some((rule) => rule.enabled) || !activationReason.trim() || !cutover} onClick={() => void write('enable')}>Turn on payout backups</button><button type="button" className="btn-danger" disabled={disabled || reviewRequired || !policy.configuration.enabled || !activationReason.trim()} onClick={() => void write('pause')}>Pause payout backups</button></div></> : <span>Read only. Super Admin access is required to change the policy.</span>}
    </Card> : null}
    {reviewRequired && saved ? <Card title="Review the newer saved revision">
      <p>Your draft has not been replaced. Publishing is blocked until the current saved state is available and you review these differences. A pause or activation may also have changed the configured switch.</p>
      <div className="failover-grid"><div><h3>Current saved revision {policy.revision}</h3><pre>{JSON.stringify(policy.configuration, null, 2)}</pre></div><div><h3>Your draft (based on revision {baseRevision})</h3><pre>{JSON.stringify(validation.payload || draft, null, 2)}</pre></div></div>
      {canPublish ? <div className="failover-actions"><button type="button" className="btn-neutral" disabled={!verified || loading || busy} onClick={() => { setBaseRevision(policy.revision); setBaseline(policy.configuration); setReviewRequired(false); setError(''); }}>I reviewed the differences; keep my draft</button><button type="button" className="btn-neutral" disabled={!verified || loading || busy} onClick={replaceDraft}>Replace draft with saved policy</button></div> : null}
    </Card> : null}
    {view === 'setup' && draft ? <Card title="Configure payout backups">
      <p>Create the allowed primary-to-backup route pairs, choose which customer accounts are covered, then save the complete setup. Rules are checked from top to bottom.</p>
      <Alert>{routesError}</Alert><div className="failover-actions"><button type="button" className="btn-neutral btn-sm" disabled={routesLoading || busy} onClick={() => void loadRoutes()}>{routesLoading ? 'Loading routes…' : 'Refresh route catalog'}</button><small>Inactive supported routes can be prepared while disabled. Server validation decides whether they can be activated.</small></div>
      <fieldset disabled={disabled} className="failover-card" style={{ border: 0, padding: 0, margin: 0 }}>
        <SetupStep number="1" title="Choose primary and backup routes">The primary is pawaPay. The backup is Maplerad for the same mobile-money method and payout action.</SetupStep>
        {draft.rules.map((rule, index) => {
          const source = routes.find((route) => String(route.id) === String(rule.sourceRouteId));
          const targets = source ? failoverRoutes(routes, capabilities, source) : [];
          const change = (key, value) => setDraft((previous) => ({ ...previous, rules: previous.rules.map((item, at) => at === index ? { ...item, [key]: value } : item) }));
          return <article key={rule.id} className="failover-rule-summary" aria-label={'Failover rule ' + (index + 1)}>
            <div className="failover-heading"><strong>Rule {index + 1}</strong><div className="failover-actions"><button type="button" className="btn-neutral btn-sm" disabled={disabled || index === 0} aria-label={'Move rule ' + (index + 1) + ' up'} onClick={() => setDraft((previous) => { const rules = [...previous.rules]; [rules[index - 1], rules[index]] = [rules[index], rules[index - 1]]; return { ...previous, rules }; })}>Move up</button><button type="button" className="btn-neutral btn-sm" disabled={disabled || index + 1 === draft.rules.length} aria-label={'Move rule ' + (index + 1) + ' down'} onClick={() => setDraft((previous) => { const rules = [...previous.rules]; [rules[index + 1], rules[index]] = [rules[index], rules[index + 1]]; return { ...previous, rules }; })}>Move down</button><button type="button" className="btn-danger btn-sm" onClick={() => setDraft({ ...draft, rules: draft.rules.filter((_, at) => at !== index) })}>Remove rule</button></div></div>
            <details className="failover-technical"><summary>Rule identifier</summary><code>{rule.id}</code></details><div className="failover-grid"><Field label={'Rule ' + (index + 1) + ' name (optional)'}><input maxLength={120} value={rule.name || ''} onChange={(event) => change('name', event.target.value)} /></Field></div>
            <label className="failover-check"><input type="checkbox" checked={rule.enabled} onChange={(event) => change('enabled', event.target.checked)} />Use this backup rule</label>
            <div className="failover-grid"><Field label={'Rule ' + (index + 1) + ' primary route'}><CatalogSelect kind="payment-route" records={sourceRoutes} value={rule.sourceRouteId} loading={routesLoading} disabled={disabled} onChange={(event) => change('sourceRouteId', event.target.value)}><option value="">Choose a source route</option>{sourceRoutes.map((route) => <option key={route.id} value={route.id}>{route.paymentMethodName + ' · ' + route.paymentProviderName + ' · #' + route.id}</option>)}</CatalogSelect></Field>
              <Field label={'Rule ' + (index + 1) + ' backup route'} help="Target must use the identical mobile-money method and compatible payout action."><CatalogSelect kind="payment-route" records={targets} value={rule.targetRouteId} loading={routesLoading} disabled={disabled || !source} onChange={(event) => change('targetRouteId', event.target.value)}><option value="">Choose a target route</option>{targets.map((route) => <option key={route.id} value={route.id}>{route.paymentMethodName + ' · ' + route.paymentProviderName + ' · #' + route.id}</option>)}</CatalogSelect></Field></div>
            <div className="failover-card"><strong>When can this backup be used?</strong><small>Choose confirmed, immediate rejection conditions. Timeouts and accepted requests cannot trigger a backup.</small>{failoverCodes(capabilities).map((entry) => <label className="failover-check" key={entry.code}><input type="checkbox" checked={rule.rejectionCodes.includes(entry.code)} onChange={(event) => change('rejectionCodes', event.target.checked ? [...rule.rejectionCodes, entry.code] : rule.rejectionCodes.filter((code) => code !== entry.code))} /><span>{failureConditionLabel(entry.code)}<small>{entry.code}</small><small style={{ display: 'block' }}>{entry.explanation}</small></span></label>)}
              {rule.rejectionCodes.filter((code) => !failoverCodes(capabilities).some((entry) => entry.code === code)).map((code) => <span key={code}>Unsupported saved code: {code}. Remove this rule or refresh capabilities before publishing.</span>)}
            </div>
          </article>;
        })}
        {canPublish ? <button type="button" className="btn-neutral" disabled={disabled || draft.rules.length >= 100} onClick={() => setDraft({ ...draft, rules: [...draft.rules, newFailoverRule()] })}>Add a backup route pair</button> : null}
<SetupStep number="2" title="Choose customer accounts">Enter customer account IDs from Accounts. A blank list covers all eligible accounts, including future matching payments.</SetupStep>
        <Field label="Customer account IDs" help="Comma or newline separated. Use account IDs, not Business IDs." tip="Blank means all otherwise eligible accounts, not an empty pilot. Start with explicit account IDs if you want a limited rollout."><textarea rows={3} value={draft.accountIds} onChange={(event) => setDraft({ ...draft, accountIds: event.target.value })} /></Field>
        <p className="failover-notice">Coverage in this draft: {String(draft.accountIds).trim() ? 'selected customer accounts' : 'all eligible accounts'}.</p>
        <details className="failover-technical"><summary>Advanced: enabled value and creation boundary in this draft</summary><div className="failover-card">
          <label className="failover-check"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />Keep backups enabled when this setup is saved</label>
          <Field label="Draft payment creation boundary (UTC)" help="Keep the saved time when editing an active setup. Turning on requires a future boundary."><input type="datetime-local" step="1" value={failoverUtcInput(draft.createdAfter)} onChange={(event) => setDraft({ ...draft, createdAfter: failoverUtcValue(event.target.value) })} /></Field>
        </div></details>
      </fieldset>
      <small>{draft.rules.length}/100 rules. Stable IDs are preserved across edits and reordering. Removing a rule does not reset previous attempts.</small>
      {validation.error ? <Alert>{validation.error}</Alert> : null}
      <SetupStep number="3" title="Save your setup">Saving replaces the complete configuration. {draft.enabled ? 'This draft is enabled, so saving applies changes to live backup checks immediately.' : 'This draft is off. Save it first, then use Turn on / pause to enable it.'}</SetupStep>
      {canPublish ? <><Field label="Reason for this setup change" help="Required audit note describing what changed."><textarea rows={2} maxLength={1000} value={reason} disabled={disabled} onChange={(event) => setReason(event.target.value)} /></Field><div className="failover-actions"><button type="button" className="btn-primary" disabled={disabled || reviewRequired || !changed && policy.source !== 'DEPLOYMENT' || !validation.payload || !reasonReady} onClick={() => void write('publish')}>{busy ? 'Saving setup…' : 'Save backup rules'}</button><button type="button" className="btn-neutral" disabled={disabled || !changed} onClick={replaceDraft}>Discard unsaved changes</button><span>{changed ? 'Unsaved changes · based on revision ' + baseRevision : 'Draft matches saved configuration'}</span></div></> : null}
    </Card> : null}
    <div hidden={view !== 'setup'}><PreviewPanel capabilities={capabilities} configuration={validation.payload} saved={saved} routes={sourceRoutes} /></div>
    <details className="card failover-technical" hidden={view !== 'setup'}><summary>Supported providers and fixed safeguards</summary><div className="failover-card" style={{ marginTop: '.8rem' }}>
      <p>Maximum {capabilities.maximumProviders} providers. {capabilities.requiresSynchronousRejection ? 'A correlated synchronous rejection is required.' : ''} {capabilities.preservesCustomerQuote ? 'The customer quote is preserved.' : ''} {capabilities.wholeUnitsOnly ? 'Whole units only.' : ''} {capabilities.sameCurrencyOnly ? 'Same currency only.' : ''}</p>
      <p>Timeout fallback: {capabilities.allowsTimeoutFallback ? 'Supported' : 'Unavailable'}. Manual resubmit: {capabilities.allowsManualResubmit ? 'Supported' : 'Unavailable'}.</p>
      {capabilities.providers.filter((provider) => provider.sourceSupported || provider.targetSupported).map((provider) => <div className="failover-rule-summary" key={provider.provider}><strong>{provider.provider} · Live lookup {provider.liveStatusCheckSupported ? 'supported' : 'UNSUPPORTED'}</strong><span>{provider.explanation}</span></div>)}
      <p>Account routing, recipient funding constraints, cutover and attempt guards still apply. An empty rule list allows no switching.</p>
    </div></details>
  </div>;
}
