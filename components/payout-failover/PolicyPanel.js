'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { CatalogSelect } from '@/components/CatalogSelect';
import { failoverActivation, failoverCodes, failoverConfiguration, failoverDraft, failoverFingerprint, failoverReason, failoverResource, failoverRoutes, failoverUtcInput, failoverUtcValue, newFailoverRule } from '@/lib/payout-failover';
import { Alert, Card, Field, ValidationReport, formatInstant, useFailoverError } from './Common';
import PreviewPanel from './PreviewPanel';

export default function PolicyPanel({ capabilities, canPublish, onRevision }) {
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
    setSaved(resource); setVerified(true); onRevision(resource.policy.revision);
    if (preserveDraft && current.current.changed) {
      if (resource.policy.revision !== current.current.baseRevision) setReviewRequired(true);
    } else {
      setDraft(failoverDraft(resource.policy.configuration)); setBaseline(resource.policy.configuration);
      setBaseRevision(resource.policy.revision); setReviewRequired(false);
    }
    return resource;
  }, [onRevision]);
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
    <Card title="Saved policy">
      <div className="failover-heading"><strong data-testid="failover-policy-status">{policy ? 'Revision ' + policy.revision + ' · ' + policy.source + ' · ' + (policy.effectiveEnabled ? 'Effective switch ON' : 'Effective switch OFF') : 'Status unavailable'}</strong><button type="button" className="btn-neutral" disabled={loading || busy} onClick={() => void load()}>{loading ? 'Refreshing…' : 'Refresh saved policy'}</button></div>
      {policy ? <div className="failover-grid"><span>Configured: {policy.configuration.enabled ? 'Enabled' : 'Paused'}</span><span>Emergency switch: {policy.emergencyDisabled ? 'SUPPRESSING FAILOVER' : 'Off'}</span><span>Cutover: {formatInstant(policy.configuration.createdAfter)}</span><span>Cutover floor: {formatInstant(policy.cutoverFloor)}</span><span>Updated: {formatInstant(policy.updatedAt)}</span><span>Actor: {policy.updatedByAdminId ?? 'Deployment'}</span></div> : null}
      {!verified && !loading ? <Alert>Saved state is unavailable. Refresh before publishing or activating.</Alert> : null}
      {policy?.emergencyDisabled ? <Alert>The infrastructure emergency switch is on. Dashboard changes cannot bypass it.</Alert> : null}
      <Alert>{error}</Alert><Alert success>{info}</Alert>
      {saved ? <ValidationReport report={saved.validation} title="Saved policy validation" /> : null}
    </Card>
    {policy ? <Card title="Enable / pause">
      <p>These actions publish a new revision using the saved rules and rollout accounts. Unsaved editor changes are kept separately. Pausing works even if a saved route is now invalid.</p>
      {canPublish ? <><div className="failover-grid">
        <Field label="Future activation cutover (UTC)" help="Required for activation or resumption. It cannot precede the cutover floor."><input type="datetime-local" step="1" value={failoverUtcInput(cutover)} disabled={disabled || policy.configuration.enabled} onChange={(event) => setCutover(failoverUtcValue(event.target.value))} /></Field>
        <Field label="Activation / pause reason"><textarea rows={2} maxLength={1000} disabled={disabled} value={activationReason} onChange={(event) => setActivationReason(event.target.value)} /></Field>
      </div><div className="failover-actions"><button type="button" className="btn-primary" disabled={disabled || reviewRequired || policy.configuration.enabled || !activationReason.trim() || !cutover} onClick={() => void write('enable')}>Enable / resume failover</button><button type="button" className="btn-danger" disabled={disabled || reviewRequired || !policy.configuration.enabled || !activationReason.trim()} onClick={() => void write('pause')}>Pause new alternate claims</button></div></> : <span>Read only. Super Admin access is required to change the policy.</span>}
    </Card> : null}
    {reviewRequired && saved ? <Card title="Review the newer saved revision">
      <p>Your draft has not been replaced. Publishing is blocked until the current saved state is available and you review these differences. A pause or activation may also have changed the configured switch.</p>
      <div className="failover-grid"><div><h3>Current saved revision {policy.revision}</h3><pre>{JSON.stringify(policy.configuration, null, 2)}</pre></div><div><h3>Your draft (based on revision {baseRevision})</h3><pre>{JSON.stringify(validation.payload || draft, null, 2)}</pre></div></div>
      {canPublish ? <div className="failover-actions"><button type="button" className="btn-neutral" disabled={!verified || loading || busy} onClick={() => { setBaseRevision(policy.revision); setBaseline(policy.configuration); setReviewRequired(false); setError(''); }}>I reviewed the differences; keep my draft</button><button type="button" className="btn-neutral" disabled={!verified || loading || busy} onClick={replaceDraft}>Replace draft with saved policy</button></div> : null}
    </Card> : null}
    {draft ? <Card title="Ordered rules & rollout">
      <p>Publishing replaces the complete configuration immediately. Rules use this order, independently of primary-provider rank. Empty rollout IDs cover all otherwise eligible accounts.</p>
      <Alert>{routesError}</Alert><div className="failover-actions"><button type="button" className="btn-neutral btn-sm" disabled={routesLoading || busy} onClick={() => void loadRoutes()}>{routesLoading ? 'Loading routes…' : 'Refresh route catalog'}</button><small>Inactive supported routes can be prepared while disabled. Server validation decides whether they can be activated.</small></div>
      <fieldset disabled={disabled} className="failover-card" style={{ border: 0, padding: 0, margin: 0 }}>
        <label className="failover-check"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />Publish with failover enabled</label>
        <div className="failover-grid">
          <Field label="Policy cutover (UTC)" help="Keep the existing instant when editing an enabled policy. First activation/resumption requires a future instant."><input type="datetime-local" step="1" value={failoverUtcInput(draft.createdAfter)} onChange={(event) => setDraft({ ...draft, createdAfter: failoverUtcValue(event.target.value) })} /></Field>
          <Field label="Rollout account IDs" help="Comma or newline separated. Blank means all otherwise eligible accounts, not an empty pilot."><textarea rows={3} value={draft.accountIds} onChange={(event) => setDraft({ ...draft, accountIds: event.target.value })} /></Field>
        </div>
        {draft.rules.map((rule, index) => {
          const source = routes.find((route) => String(route.id) === String(rule.sourceRouteId));
          const targets = source ? failoverRoutes(routes, capabilities, source) : [];
          const change = (key, value) => setDraft((previous) => ({ ...previous, rules: previous.rules.map((item, at) => at === index ? { ...item, [key]: value } : item) }));
          return <article key={rule.id} className="failover-rule-summary" aria-label={'Failover rule ' + (index + 1)}>
            <div className="failover-heading"><strong>Rule {index + 1}</strong><div className="failover-actions"><button type="button" className="btn-neutral btn-sm" disabled={disabled || index === 0} aria-label={'Move rule ' + (index + 1) + ' up'} onClick={() => setDraft((previous) => { const rules = [...previous.rules]; [rules[index - 1], rules[index]] = [rules[index], rules[index - 1]]; return { ...previous, rules }; })}>Move up</button><button type="button" className="btn-neutral btn-sm" disabled={disabled || index + 1 === draft.rules.length} aria-label={'Move rule ' + (index + 1) + ' down'} onClick={() => setDraft((previous) => { const rules = [...previous.rules]; [rules[index + 1], rules[index]] = [rules[index], rules[index + 1]]; return { ...previous, rules }; })}>Move down</button><button type="button" className="btn-danger btn-sm" onClick={() => setDraft({ ...draft, rules: draft.rules.filter((_, at) => at !== index) })}>Remove rule</button></div></div>
            <div className="failover-grid"><Field label={'Rule ' + (index + 1) + ' stable ID'}><input value={rule.id} readOnly /></Field><Field label={'Rule ' + (index + 1) + ' name'}><input maxLength={120} value={rule.name || ''} onChange={(event) => change('name', event.target.value)} /></Field></div>
            <label className="failover-check"><input type="checkbox" checked={rule.enabled} onChange={(event) => change('enabled', event.target.checked)} />Rule enabled</label>
            <div className="failover-grid"><Field label={'Rule ' + (index + 1) + ' source route'}><CatalogSelect kind="payment-route" records={sourceRoutes} value={rule.sourceRouteId} loading={routesLoading} disabled={disabled} onChange={(event) => change('sourceRouteId', event.target.value)}><option value="">Choose a source route</option>{sourceRoutes.map((route) => <option key={route.id} value={route.id}>{route.paymentMethodName + ' · ' + route.paymentProviderName + ' · #' + route.id}</option>)}</CatalogSelect></Field>
              <Field label={'Rule ' + (index + 1) + ' target route'} help="Target must use the identical mobile-money method and compatible payout action."><CatalogSelect kind="payment-route" records={targets} value={rule.targetRouteId} loading={routesLoading} disabled={disabled || !source} onChange={(event) => change('targetRouteId', event.target.value)}><option value="">Choose a target route</option>{targets.map((route) => <option key={route.id} value={route.id}>{route.paymentMethodName + ' · ' + route.paymentProviderName + ' · #' + route.id}</option>)}</CatalogSelect></Field></div>
            <div className="failover-card"><strong>Correlated synchronous rejection codes</strong>{failoverCodes(capabilities).map((entry) => <label className="failover-check" key={entry.code}><input type="checkbox" checked={rule.rejectionCodes.includes(entry.code)} onChange={(event) => change('rejectionCodes', event.target.checked ? [...rule.rejectionCodes, entry.code] : rule.rejectionCodes.filter((code) => code !== entry.code))} /><span>{entry.code}<small style={{ display: 'block' }}>{entry.explanation}</small></span></label>)}
              {rule.rejectionCodes.filter((code) => !failoverCodes(capabilities).some((entry) => entry.code === code)).map((code) => <span key={code}>Unsupported saved code: {code}. Remove this rule or refresh capabilities before publishing.</span>)}
            </div>
          </article>;
        })}
        {canPublish ? <button type="button" className="btn-neutral" disabled={disabled || draft.rules.length >= 100} onClick={() => setDraft({ ...draft, rules: [...draft.rules, newFailoverRule()] })}>Add failover rule</button> : null}
      </fieldset>
      <small>{draft.rules.length}/100 rules. Stable IDs are preserved across edits and reordering. Removing a rule does not reset previous attempts.</small>
      {validation.error ? <Alert>{validation.error}</Alert> : null}
      {canPublish ? <><Field label="Policy publication reason"><textarea rows={2} maxLength={1000} value={reason} disabled={disabled} onChange={(event) => setReason(event.target.value)} /></Field><div className="failover-actions"><button type="button" className="btn-primary" disabled={disabled || reviewRequired || !changed && policy.source !== 'DEPLOYMENT' || !validation.payload || !reasonReady} onClick={() => void write('publish')}>{busy ? 'Publishing…' : 'Publish policy'}</button><button type="button" className="btn-neutral" disabled={disabled || !changed} onClick={replaceDraft}>Discard draft changes</button><span>{changed ? 'Unsaved changes · based on revision ' + baseRevision : 'Draft matches saved configuration'}</span></div></> : null}
    </Card> : null}
    <PreviewPanel capabilities={capabilities} configuration={validation.payload} saved={saved} routes={sourceRoutes} />
    <Card title="Provider capabilities & fixed limits">
      <p>Maximum {capabilities.maximumProviders} providers. {capabilities.requiresSynchronousRejection ? 'A correlated synchronous rejection is required.' : ''} {capabilities.preservesCustomerQuote ? 'The customer quote is preserved.' : ''} {capabilities.wholeUnitsOnly ? 'Whole units only.' : ''} {capabilities.sameCurrencyOnly ? 'Same currency only.' : ''}</p>
      <p>Timeout fallback: {capabilities.allowsTimeoutFallback ? 'Supported' : 'Unavailable'}. Manual resubmit: {capabilities.allowsManualResubmit ? 'Supported' : 'Unavailable'}.</p>
      {capabilities.providers.filter((provider) => provider.sourceSupported || provider.targetSupported).map((provider) => <div className="failover-rule-summary" key={provider.provider}><strong>{provider.provider} · Live lookup {provider.liveStatusCheckSupported ? 'supported' : 'UNSUPPORTED'}</strong><span>{provider.explanation}</span></div>)}
      <p>Account routing, recipient funding constraints, cutover and attempt guards still apply. An empty rule list allows no switching.</p>
    </Card>
  </div>;
}
