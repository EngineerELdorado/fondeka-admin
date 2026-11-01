'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { CatalogSelect } from '@/components/CatalogSelect';
import { payoutActivation, payoutDefaultsDraft, failoverCodes, failoverConfiguration, failoverDraft, failoverDraftChanged, failoverReason, failoverResource, failoverRoutes, failoverUtcInput, failoverUtcValue, newFailoverRule } from '@/lib/payout-failover';
import { Alert, Card, Field, ValidationReport, formatInstant, useFailoverError } from './Common';
import { failureConditionLabel } from '@/lib/failover-presentation';
import { SetupStep } from '@/components/failover/Experience';
import PreviewPanel from './PreviewPanel';
import RoutingRulesEditor from './RoutingRulesEditor';
import DefaultsPanel from './DefaultsPanel';
import ProviderContracts from './ProviderContracts';
import PolicySaveBar from '@/components/failover/PolicySaveBar';
import ActivationControls from '@/components/failover/ActivationControls';

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
  const changed = failoverDraftChanged(draft, baseline, validation.payload);
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
    if (!canPublish || lock.current || loading || !saved || !verified || action !== 'pause' && (!capabilitiesReady || reviewRequired)) return;
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
        setError('Another admin published a newer revision. Your draft is retained. Review the saved policy and draft before saving or turning on.');
      }
    } finally { lock.current = false; setBusy(false); }
  }
  const policy = saved?.policy, disabled = !canPublish || !capabilitiesReady || busy || loading || !verified;
  const activationDisabled = !canPublish || busy || loading || !verified;
  const activationBlockedReason = loading ? 'Loading the saved policy…' : !verified ? 'Refresh the saved policy before changing automatic failover.'
    : policy?.configuration.enabled ? '' : !capabilitiesReady ? 'Refresh provider information before turning on automatic failover.'
      : reviewRequired ? 'Review the newer saved version before turning on automatic failover.' : cutoverMode === 'manual' && !cutover ? 'Choose a future UTC start time before turning on automatic failover.' : '';
  const sourceRoutes = failoverRoutes(routes, capabilities);
  const emptyRuleLists = policy && policy.configuration.rules.length === 0 && !policy.configuration.routingRules?.length;
  const scopedSupported = Boolean(draft && Object.hasOwn(draft, 'routingRules') || Array.isArray(capabilities.scopePrecedence));
  const importDefaults = (configuration) => {
    if (lock.current || loading || !verified || !canPublish || !capabilitiesReady || !draft) return;
    setDraft(payoutDefaultsDraft(draft, configuration));
    setError(''); setInfo('Disabled defaults copied to your local draft. Account IDs are retained. Review and save separately.');
  };
  const reasonReady = reason.trim().length > 0 && reason.trim().length <= 1000;
  const saveDisabledReason = busy ? 'Wait for the current request to finish.' : loading ? 'Loading saved settings…' : !verified ? 'Refresh the saved policy before saving.'
    : !capabilitiesReady ? 'Refresh provider information before saving.' : reviewRequired ? 'Review the newer saved version before saving.'
      : validation.error || (!validation.payload ? 'Complete the configuration before saving.' : !changed && policy?.source !== 'DEPLOYMENT' ? 'Make a configuration change to save.' : !reasonReady ? 'Enter an audit reason to enable Save changes.' : '');
  return <div className="failover-card">
    <Card>
      <div className="failover-heading"><strong data-testid="failover-policy-status">{policy ? 'Backups ' + (policy.effectiveEnabled ? 'ON' : 'OFF') + ' · Saved version ' + policy.revision : 'Status unavailable'}</strong><button type="button" className="btn-neutral" disabled={loading || busy} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh saved policy'}</button></div>
      {policy ? <details className="failover-technical" open={saved.validation.issues.some((issue) => issue.severity === 'ERROR')}><summary>Saved policy details & checks</summary><div className="failover-grid"><span>Configured switch: {policy.configuration.enabled ? 'Enabled' : 'Paused'}</span><span>Emergency switch: {policy.emergencyDisabled ? 'SUPPRESSING FAILOVER' : 'Off'}</span><span>Payments created after: {formatInstant(policy.configuration.createdAfter)}</span><span>Earliest allowed start: {formatInstant(policy.cutoverFloor)}</span><span>Updated: {formatInstant(policy.updatedAt)}</span><span>Actor: {policy.updatedByAdminId ?? 'Deployment'}</span></div><ValidationReport report={saved.validation} title="Saved setup" /></details> : null}
      {!verified && !loading ? <Alert>Saved state is unavailable. Refresh before publishing or activating.</Alert> : null}
      {!capabilitiesReady ? <Alert>Provider capabilities are unavailable or refreshing. Saving and turning on are disabled; you can still turn off a verified saved policy. Your draft is retained.</Alert> : null}
      {policy?.emergencyDisabled ? <Alert>The infrastructure emergency switch is on. Dashboard changes cannot bypass it.</Alert> : null}
      {view !== 'setup' || !draft ? <Alert>{error}</Alert> : null}<Alert success>{info}</Alert>
    </Card>
    {view === 'setup' && draft ? <PolicySaveBar canPublish={canPublish} changed={changed} busy={busy} disabled={disabled} disabledReason={saveDisabledReason} version={baseRevision} enabled={draft.enabled} reason={reason} onReason={setReason} onSave={() => void write('publish')} onDiscard={replaceDraft} error={error} /> : null}
    {view === 'activation' && policy ? <Card title="Automatic failover">
      {changed ? <div className="failover-notice">Unsaved edits stay separate. This changes the saved policy only.</div> : null}
      {emptyRuleLists && !policy.configuration.enabled ? <div className="failover-notice">No saved rules. Turning on uses validated environment defaults and your saved account restrictions.</div> : null}
      {canPublish ? <ActivationControls enabled={policy.configuration.enabled} busy={busy} disabled={activationDisabled} blockedReason={activationBlockedReason} reason={activationReason} onReason={setActivationReason} onSubmit={(action) => void write(action)}>
        <div className="failover-grid">
          <Field label="Payout start time" help="Older payouts stay excluded." tip="Automatic start is normally 30 seconds ahead. An existing future start or cutover floor can be preserved. The confirmed time appears after success."><select disabled={disabled} value={cutoverMode} onChange={(event) => setCutoverMode(event.target.value)}><option value="automatic">Automatic safe start (backend chooses)</option><option value="manual">Choose a future UTC time</option></select></Field>
          {cutoverMode === 'manual' ? <Field label="Start for payments created after (UTC)" help="A future UTC time is required when specified." tip="This boundary uses the original payment creation time. It cannot move behind the saved minimum. A payment that was queued or uncertain earlier cannot be adopted."><input type="datetime-local" step="1" value={failoverUtcInput(cutover)} disabled={disabled} onChange={(event) => setCutover(failoverUtcValue(event.target.value))} /></Field> : null}
        </div>
      </ActivationControls> : <span>Read only. Super Admin access is required to change the policy.</span>}
      <details className="failover-technical"><summary>How on / off changes apply</summary><p>Uses saved rules and account restrictions, including blocked scopes. Turning off keeps this setup and needs no future start time. Already-claimed attempts and recovery continue; it does not cancel or refund payments.</p><p>When both saved rule lists are empty, turning on discovers and validates environment defaults. Nonempty rule lists are preserved. Unsaved edits are never included.</p>{policy.configuration.createdAfter ? <p>Payments created after: {formatInstant(policy.configuration.createdAfter)}. Earlier payouts stay excluded.</p> : null}</details>
    </Card> : null}
    {reviewRequired && saved ? <Card title="Review the newer saved revision">
      <p>Your draft has not been replaced. Publishing is blocked until the current saved state is available and you review these differences. A pause or activation may also have changed the configured switch.</p>
      <details className="failover-technical"><summary>Compare saved policy and draft</summary><div className="failover-grid"><div><h3>Current saved revision {policy.revision}</h3><pre>{JSON.stringify(policy.configuration, null, 2)}</pre></div><div><h3>Your draft (based on revision {baseRevision})</h3><pre>{JSON.stringify(validation.payload || draft, null, 2)}</pre></div></div></details>
      {canPublish ? <div className="failover-actions"><button type="button" className="btn-neutral" disabled={!verified || loading || busy} onClick={() => { setBaseRevision(policy.revision); setBaseline(policy.configuration); setReviewRequired(false); setError(''); }}>I reviewed the differences; keep my draft</button><button type="button" className="btn-neutral" disabled={!verified || loading || busy} onClick={replaceDraft}>Replace draft with saved policy</button></div> : null}
    </Card> : null}
    <div hidden={view !== 'setup'}><DefaultsPanel active={active && view === 'setup'} canImport={!disabled && !reviewRequired} onImport={importDefaults} /></div>
    {view === 'setup' && draft ? <Card title="Configure payout backups">
      {validation.error ? <Alert>{validation.error}</Alert> : null}
      <Alert>{routesError}</Alert><div className="failover-actions"><button type="button" className="btn-neutral btn-sm" disabled={routesLoading || busy} onClick={() => void loadRoutes()}>{routesLoading ? 'Loading routes…' : 'Refresh route catalog'}</button></div>
      <fieldset disabled={disabled} className="failover-card" style={{ border: 0, padding: 0, margin: 0 }}>
        <SetupStep number="1" title="Provider defaults & overrides" />
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
        <SetupStep number="2" title="Customer accounts" />
        <Field label="Customer account IDs" help="Comma or newline separated. Use account IDs, not Business IDs." tip="Blank means all otherwise eligible accounts, not an empty pilot. Start with explicit account IDs if you want a limited rollout."><textarea rows={3} value={draft.accountIds} onChange={(event) => setDraft({ ...draft, accountIds: event.target.value })} /></Field>
        <p className="failover-notice">Coverage in this draft: {String(draft.accountIds).trim() ? 'selected customer accounts' : 'all eligible accounts'}.</p>
        <details className="failover-technical"><summary>Advanced: enabled value and creation boundary in this draft</summary><div className="failover-card">
          <label className="failover-check"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />Keep backups enabled when this setup is saved</label>
          <Field label="Draft payment creation boundary (UTC)" help="Keep the saved time when editing an active setup. Turning on requires a future boundary."><input type="datetime-local" step="1" value={failoverUtcInput(draft.createdAfter)} onChange={(event) => setDraft({ ...draft, createdAfter: failoverUtcValue(event.target.value) })} /></Field>
        </div></details>
      </fieldset>
      <small>{draft.rules.length}/100 explicit route-pair rules. Stable IDs are preserved across edits and reordering. Removing a rule does not reset previous attempts.</small>
      <details className="failover-technical"><summary>Saving and activation</summary><p>Save changes in the bar above the editor, with an audit reason. This replaces all rules and account settings together. {draft.enabled ? 'This draft is on, so saving applies changes immediately.' : 'This draft is off. Save first, then use Turn on / pause to enable it.'} Inactive supported routes can be prepared while off; the backend validates them before activation.</p></details>
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
