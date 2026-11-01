'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { CatalogSelect } from '@/components/CatalogSelect';
import { payoutActivation, payoutDefaultsDraft, failoverCodes, failoverConfiguration, failoverDraft, failoverFingerprint, failoverReason, failoverResource, failoverRoutes, failoverUtcInput, failoverUtcValue, newFailoverRule } from '@/lib/payout-failover';
import { Alert, Card, Field, ValidationReport, formatInstant, useFailoverError } from './Common';
import { failureConditionLabel } from '@/lib/failover-presentation';
import { SetupStep } from '@/components/failover/Experience';
import PreviewPanel from './PreviewPanel';
import RoutingRulesEditor from './RoutingRulesEditor';
import DefaultsPanel from './DefaultsPanel';
import ProviderContracts from './ProviderContracts';

export default function PolicyPanel({ capabilities, capabilitiesReady = true, canPublish, onRevision, onPolicy, view = 'setup', active = true }) {
  const [saved, setSaved] = useState(null), [draft, setDraft] = useState(null), [baseline, setBaseline] = useState(null), [baseRevision, setBaseRevision] = useState(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [verified, setVerified] = useState(false), [reviewRequired, setReviewRequired] = useState(false);
  const [error, setError] = useState(''), [info, setInfo] = useState(''), [reason, setReason] = useState('');
  const [activationReason, setActivationReason] = useState(''), [cutover, setCutover] = useState(null), [cutoverMode, setCutoverMode] = useState('automatic');
  const [routes, setRoutes] = useState([]), [methods, setMethods] = useState([]), [routesLoading, setRoutesLoading] = useState(true), [routesError, setRoutesError] = useState('');
  const fail = useFailoverError(setError), routeFail = useFailoverError(setRoutesError);
  const sequence = useRef(0), lock = useRef(false), current = useRef({});
  const validation = useMemo(() => {
    if (!draft) return { payload: null, error: '' };
    try { return { payload: failoverConfiguration(draft, capabilities, routes), error: '' }; }
    catch (err) { return { payload: null, error: err.message }; }
  }, [draft, capabilities, routes]);
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
    try {
      const results = await Promise.allSettled([api.paymentMethodPaymentProviders.options({ paymentMethodType: 'MOBILE_MONEY' }), api.paymentMethods.options({ type: 'MOBILE_MONEY' })]);
      if (results[0].status === 'fulfilled') setRoutes(results[0].value);
      if (results[1].status === 'fulfilled') setMethods(results[1].value.filter((method) => method.type === 'MOBILE_MONEY'));
      const failure = results.find((result) => result.status === 'rejected');
      if (failure) throw failure.reason;
    }
    catch (err) { await routeFail(err); }
    finally { setRoutesLoading(false); }
  }, [routeFail]);
  useEffect(() => { void loadRoutes(); }, [loadRoutes]);
  const replaceDraft = () => {
    setDraft(failoverDraft(saved.policy.configuration)); setBaseline(saved.policy.configuration); setBaseRevision(saved.policy.revision);
    setReviewRequired(false); setError(''); setInfo('Draft now matches the current saved revision.');
  };
  async function write(action) {
    if (!canPublish || !capabilitiesReady || lock.current || loading || !saved || !verified || reviewRequired) return;
    let payload;
    try {
      payload = action === 'publish'
        ? { expectedRevision: baseRevision, reason: failoverReason(reason), configuration: failoverConfiguration(draft, capabilities, routes) }
        : payoutActivation(saved.policy, action === 'enable', cutoverMode === 'manual' ? cutover : null, activationReason);
    } catch (err) { setError(err.message); return; }
    lock.current = true; setBusy(true); setError(''); setInfo('');
    let committed = false;
    try {
      const response = action === 'publish' ? await api.payoutFailover.publish(payload) : await api.payoutFailover.activate(payload);
      committed = true;
      const confirmed = failoverResource(response);
      if (confirmed.policy.source !== 'DATABASE' || confirmed.policy.revision <= payload.expectedRevision) throw new Error('The backend did not confirm a newly published revision.');
      const resource = accept(response, action !== 'publish');
      if (action === 'publish') setReason(''); else { setActivationReason(''); setCutover(null); setCutoverMode('automatic'); }
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
  const policy = saved?.policy, disabled = !canPublish || !capabilitiesReady || busy || loading || !verified;
  const sourceRoutes = failoverRoutes(routes, capabilities);
  const emptyRuleLists = policy && policy.configuration.rules.length === 0 && !policy.configuration.routingRules?.length;
  const scopedSupported = Boolean(draft && Object.hasOwn(draft, 'routingRules') || Array.isArray(capabilities.scopePrecedence));
  const importDefaults = (configuration) => {
    if (lock.current || loading || !verified || !canPublish || !capabilitiesReady || !draft) return;
    setDraft(payoutDefaultsDraft(draft, configuration));
    setError(''); setInfo('Disabled defaults copied to your local draft. Account IDs are retained. Review and save separately.');
  };
  const reasonReady = reason.trim().length > 0 && reason.trim().length <= 1000;
  return <div className="failover-card">
    <Card title="Saved setup">
      <div className="failover-heading"><strong data-testid="failover-policy-status">{policy ? 'Backups ' + (policy.effectiveEnabled ? 'ON' : 'OFF') + ' · Saved version ' + policy.revision : 'Status unavailable'}</strong><button type="button" className="btn-neutral" disabled={loading || busy} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh saved policy'}</button></div>
      {policy?.configuration.createdAfter ? <p>Saved payment creation boundary: <strong>{formatInstant(policy.configuration.createdAfter)}</strong>. Earlier payouts remain excluded.</p> : null}
      {policy ? <details className="failover-technical"><summary>Saved configuration details</summary><div className="failover-grid"><span>Configured switch: {policy.configuration.enabled ? 'Enabled' : 'Paused'}</span><span>Emergency switch: {policy.emergencyDisabled ? 'SUPPRESSING FAILOVER' : 'Off'}</span><span>Payments created after: {formatInstant(policy.configuration.createdAfter)}</span><span>Earliest allowed start: {formatInstant(policy.cutoverFloor)}</span><span>Updated: {formatInstant(policy.updatedAt)}</span><span>Actor: {policy.updatedByAdminId ?? 'Deployment'}</span></div></details> : null}
      {!verified && !loading ? <Alert>Saved state is unavailable. Refresh before publishing or activating.</Alert> : null}
      {!capabilitiesReady ? <Alert>Provider capabilities are unavailable or refreshing. Saving and activation are disabled; your draft is retained.</Alert> : null}
      {policy?.emergencyDisabled ? <Alert>The infrastructure emergency switch is on. Dashboard changes cannot bypass it.</Alert> : null}
      <Alert>{error}</Alert><Alert success>{info}</Alert>
      {saved ? <details className="failover-technical" open={saved.validation.issues.some((issue) => issue.severity === 'ERROR')}><summary>Saved setup checks</summary><ValidationReport report={saved.validation} title="Saved setup" /></details> : null}
    </Card>
    {view === 'activation' && policy ? <Card title="Turn payout backups on or pause them">
      <p>This uses the saved backup rules and customer accounts. It never includes unsaved edits. Pausing stops new backup attempts; already-reserved attempts and ordinary payment processing continue.</p>
      {changed ? <div className="failover-notice">You have unsaved setup changes. These controls use the previously saved version; your draft remains separate.</div> : null}
      {emptyRuleLists ? <div className="failover-notice">Both saved rule lists are empty. Turning on asks the backend to discover and validate environment defaults, keeping the saved customer account restrictions. Review the presets under Backup setup first.</div> : <p>Saved route pairs and scoped overrides are preserved, including blocked scopes. The backend will not replace them with defaults.</p>}
      {canPublish ? <><div className="failover-grid">
        <Field label="Payout start time" help="Applies to the original payment creation time. Older payouts stay excluded."><select disabled={disabled || policy.configuration.enabled} value={cutoverMode} onChange={(event) => setCutoverMode(event.target.value)}><option value="automatic">Automatic safe start (backend chooses)</option><option value="manual">Choose a future UTC time</option></select></Field>
        {cutoverMode === 'manual' ? <Field label="Start for payments created after (UTC)" help="A future UTC time is required when specified." tip="This boundary uses the original payment creation time. It cannot move behind the saved minimum. A payment that was queued or uncertain earlier cannot be adopted."><input type="datetime-local" step="1" value={failoverUtcInput(cutover)} disabled={disabled || policy.configuration.enabled} onChange={(event) => setCutover(failoverUtcValue(event.target.value))} /></Field> : <p>The backend normally chooses a start about 30 seconds ahead; an existing future start or cutover floor may be kept. The confirmed start appears after success.</p>}
        <Field label="Reason for turning on or pausing" help="Required audit note. Explain the pilot, rollout or incident."><textarea rows={2} maxLength={1000} disabled={disabled} value={activationReason} onChange={(event) => setActivationReason(event.target.value)} /></Field>
      </div><div className="failover-actions"><button type="button" className="btn-primary" disabled={disabled || reviewRequired || policy.configuration.enabled || !activationReason.trim() || cutoverMode === 'manual' && !cutover} onClick={() => void write('enable')}>Turn on payout backups</button><button type="button" className="btn-danger" disabled={disabled || reviewRequired || !policy.configuration.enabled || !activationReason.trim()} onClick={() => void write('pause')}>Pause payout backups</button></div></> : <span>Read only. Super Admin access is required to change the policy.</span>}
    </Card> : null}
    {reviewRequired && saved ? <Card title="Review the newer saved revision">
      <p>Your draft has not been replaced. Publishing is blocked until the current saved state is available and you review these differences. A pause or activation may also have changed the configured switch.</p>
      <div className="failover-grid"><div><h3>Current saved revision {policy.revision}</h3><pre>{JSON.stringify(policy.configuration, null, 2)}</pre></div><div><h3>Your draft (based on revision {baseRevision})</h3><pre>{JSON.stringify(validation.payload || draft, null, 2)}</pre></div></div>
      {canPublish ? <div className="failover-actions"><button type="button" className="btn-neutral" disabled={!verified || loading || busy} onClick={() => { setBaseRevision(policy.revision); setBaseline(policy.configuration); setReviewRequired(false); setError(''); }}>I reviewed the differences; keep my draft</button><button type="button" className="btn-neutral" disabled={!verified || loading || busy} onClick={replaceDraft}>Replace draft with saved policy</button></div> : null}
    </Card> : null}
    <div hidden={view !== 'setup'}><DefaultsPanel active={active && view === 'setup'} canImport={!disabled && !reviewRequired} onImport={importDefaults} /></div>
    {view === 'setup' && draft ? <Card title="Configure payout backups">
      <p>Review scoped defaults and overrides, choose customer accounts, then save the complete setup. Explicit route-pair rules remain available under Advanced and take priority over all scopes.</p>
      {validation.error ? <Alert>{validation.error}</Alert> : null}
      <Alert>{routesError}</Alert><div className="failover-actions"><button type="button" className="btn-neutral btn-sm" disabled={routesLoading || busy} onClick={() => void loadRoutes()}>{routesLoading ? 'Loading routes…' : 'Refresh route catalog'}</button><small>Inactive supported routes can be prepared while disabled. Server validation decides whether they can be activated.</small></div>
      <fieldset disabled={disabled} className="failover-card" style={{ border: 0, padding: 0, margin: 0 }}>
        <SetupStep number="1" title="Review defaults and exceptions">Execution allows up to {capabilities.maximumProviders} distinct providers under the reviewed contracts below. A blocked override stops inheritance; deleting it restores the broader setting.</SetupStep>
        {scopedSupported ? <RoutingRulesEditor rules={draft.routingRules || []} methods={methods} capabilities={capabilities} disabled={disabled} onChange={(routingRules) => setDraft((previous) => ({ ...previous, routingRules }))} /> : <p>Scoped rules are unavailable in this backend response. Existing route-pair rules can still be edited below.</p>}
        <details className="failover-technical"><summary>Advanced: explicit route-pair rules ({draft.rules.length})</summary><div className="failover-card">
        <p>These rules take priority for their source route, even when disabled. Their list order is preserved. A disabled explicit source-route rule also prevents scoped defaults for that source.</p>
        {draft.rules.map((rule, index) => {
          const source = routes.find((route) => String(route.id) === String(rule.sourceRouteId));
          const targets = source ? failoverRoutes(routes, capabilities, source) : [];
          const evidenceCodes = failoverCodes(capabilities, source?.paymentProviderName || '');
          const change = (key, value) => setDraft((previous) => ({ ...previous, rules: previous.rules.map((item, at) => at === index ? { ...item, [key]: value } : item) }));
          return <article key={rule.id} className="failover-rule-summary" aria-label={'Failover rule ' + (index + 1)}>
            <div className="failover-heading"><strong>Rule {index + 1}</strong><div className="failover-actions"><button type="button" className="btn-neutral btn-sm" disabled={disabled || index === 0} aria-label={'Move rule ' + (index + 1) + ' up'} onClick={() => setDraft((previous) => { const rules = [...previous.rules]; [rules[index - 1], rules[index]] = [rules[index], rules[index - 1]]; return { ...previous, rules }; })}>Move up</button><button type="button" className="btn-neutral btn-sm" disabled={disabled || index + 1 === draft.rules.length} aria-label={'Move rule ' + (index + 1) + ' down'} onClick={() => setDraft((previous) => { const rules = [...previous.rules]; [rules[index + 1], rules[index]] = [rules[index], rules[index + 1]]; return { ...previous, rules }; })}>Move down</button><button type="button" className="btn-danger btn-sm" onClick={() => setDraft({ ...draft, rules: draft.rules.filter((_, at) => at !== index) })}>Remove rule</button></div></div>
            <details className="failover-technical"><summary>Rule identifier</summary><code>{rule.id}</code></details><div className="failover-grid"><Field label={'Rule ' + (index + 1) + ' name (optional)'}><input maxLength={120} value={rule.name || ''} onChange={(event) => change('name', event.target.value)} /></Field></div>
            <label className="failover-check"><input type="checkbox" checked={rule.enabled} onChange={(event) => change('enabled', event.target.checked)} />Use this backup rule</label>
            <div className="failover-grid"><Field label={'Rule ' + (index + 1) + ' source route'} help="The provider that must confirm non-payment for this step. It can be the original provider or an earlier alternate."><CatalogSelect kind="payment-route" records={sourceRoutes} value={rule.sourceRouteId} loading={routesLoading} disabled={disabled} onChange={(event) => change('sourceRouteId', event.target.value)}><option value="">Choose a source route</option>{sourceRoutes.map((route) => <option key={route.id} value={route.id}>{route.paymentMethodName + ' · ' + route.paymentProviderName + ' · #' + route.id}</option>)}</CatalogSelect></Field>
              <Field label={'Rule ' + (index + 1) + ' backup route'} help="Target must use the identical mobile-money method and compatible payout action."><CatalogSelect kind="payment-route" records={targets} value={rule.targetRouteId} loading={routesLoading} disabled={disabled || !source} onChange={(event) => change('targetRouteId', event.target.value)}><option value="">Choose a target route</option>{targets.map((route) => <option key={route.id} value={route.id}>{route.paymentMethodName + ' · ' + route.paymentProviderName + ' · #' + route.id}</option>)}</CatalogSelect></Field></div>
            <div className="failover-card"><strong>What confirms non-payment for this source?</strong><small>{source ? `Showing reviewed ${source.paymentProviderName} evidence only. Acceptance, a generic HTTP error or a timeout alone cannot switch providers.` : 'Select a source route to see its reviewed evidence codes.'}</small>{evidenceCodes.map((entry) => <label className="failover-check" key={entry.code}><input type="checkbox" checked={rule.rejectionCodes.includes(entry.code)} onChange={(event) => change('rejectionCodes', event.target.checked ? [...rule.rejectionCodes, entry.code] : rule.rejectionCodes.filter((code) => code !== entry.code))} /><span>{failureConditionLabel(entry.code)}<small>{entry.code}</small><small style={{ display: 'block' }}>{entry.explanation}</small></span></label>)}
              {rule.rejectionCodes.filter((code) => !evidenceCodes.some((entry) => entry.code === code)).map((code) => <div key={code}><span>Saved evidence is unavailable or belongs to another source: {code}.</span> <button type="button" className="btn-neutral btn-sm" onClick={() => change('rejectionCodes', rule.rejectionCodes.filter((item) => item !== code))}>Remove {code}</button></div>)}
            </div>
          </article>;
        })}
        {canPublish ? <button type="button" className="btn-neutral" disabled={disabled || draft.rules.length >= 100} onClick={() => setDraft({ ...draft, rules: [...draft.rules, newFailoverRule()] })}>Add a backup route pair</button> : null}
        </div></details>
        <SetupStep number="2" title="Choose customer accounts">Enter customer account IDs from Accounts. A blank list covers all eligible accounts, including future matching payments.</SetupStep>
        <Field label="Customer account IDs" help="Comma or newline separated. Use account IDs, not Business IDs." tip="Blank means all otherwise eligible accounts, not an empty pilot. Start with explicit account IDs if you want a limited rollout."><textarea rows={3} value={draft.accountIds} onChange={(event) => setDraft({ ...draft, accountIds: event.target.value })} /></Field>
        <p className="failover-notice">Coverage in this draft: {String(draft.accountIds).trim() ? 'selected customer accounts' : 'all eligible accounts'}.</p>
        <details className="failover-technical"><summary>Advanced: enabled value and creation boundary in this draft</summary><div className="failover-card">
          <label className="failover-check"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />Keep backups enabled when this setup is saved</label>
          <Field label="Draft payment creation boundary (UTC)" help="Keep the saved time when editing an active setup. Turning on requires a future boundary."><input type="datetime-local" step="1" value={failoverUtcInput(draft.createdAfter)} onChange={(event) => setDraft({ ...draft, createdAfter: failoverUtcValue(event.target.value) })} /></Field>
        </div></details>
      </fieldset>
      <small>{draft.rules.length}/100 explicit route-pair rules. Stable IDs are preserved across edits and reordering. Removing a rule does not reset previous attempts.</small>
      <SetupStep number="3" title="Save your setup">Saving replaces the complete configuration. {draft.enabled ? 'This draft is enabled, so saving applies changes to live backup checks immediately.' : 'This draft is off. Save it first, then use Turn on / pause to enable it.'}</SetupStep>
      {canPublish ? <><Field label="Reason for this setup change" help="Required audit note describing what changed."><textarea rows={2} maxLength={1000} value={reason} disabled={disabled} onChange={(event) => setReason(event.target.value)} /></Field><div className="failover-actions"><button type="button" className="btn-primary" disabled={disabled || reviewRequired || !changed && policy.source !== 'DEPLOYMENT' || !validation.payload || !reasonReady} onClick={() => void write('publish')}>{busy ? 'Saving setup…' : 'Save backup rules'}</button><button type="button" className="btn-neutral" disabled={disabled || !changed} onClick={replaceDraft}>Discard unsaved changes</button><span>{changed ? 'Unsaved changes · based on revision ' + baseRevision : 'Draft matches saved configuration'}</span></div></> : null}
    </Card> : null}
    <div hidden={view !== 'setup'}><PreviewPanel capabilities={capabilities} configuration={validation.payload} saved={saved} routes={sourceRoutes} /></div>
    <details className="card failover-technical" hidden={view !== 'setup'}><summary>Supported providers and fixed safeguards</summary><div className="failover-card" style={{ marginTop: '.8rem' }}>
      <ProviderContracts capabilities={capabilities} />
      <p>Maximum {capabilities.maximumProviders} providers. {capabilities.requiresSynchronousRejection ? 'A correlated synchronous rejection is required.' : ''} {capabilities.preservesCustomerQuote ? 'The customer quote is preserved.' : ''} {capabilities.wholeUnitsOnly ? 'Whole units only.' : ''} {capabilities.sameCurrencyOnly ? 'Same currency only.' : ''}</p>
      {capabilities.maximumDraftProviders ? <p>Disabled scoped preferences can contain up to {capabilities.maximumDraftProviders} providers. This does not increase the {capabilities.maximumProviders}-provider execution limit.</p> : null}
      {Array.isArray(capabilities.scopePrecedence) ? <p>Backend scope precedence: {capabilities.scopePrecedence.join(' → ')}.</p> : null}
      <p>Timeout fallback: {capabilities.allowsTimeoutFallback ? 'Supported' : 'Unavailable'}. Manual resubmit: {capabilities.allowsManualResubmit ? 'Supported' : 'Unavailable'}.</p>
      <p>Account routing, recipient funding constraints, cutover and attempt guards still apply. With both rule lists empty, activation can discover validated defaults. A nonempty list is preserved as saved; blocked scopes never fall through to broader defaults.</p>
    </div></details>
  </div>;
}
