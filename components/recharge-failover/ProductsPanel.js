'use client';

import { CountrySelect } from '@/components/CountrySelect';

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { failoverFingerprint, failoverUtcInput, failoverUtcValue, newFailoverRule } from '@/lib/payout-failover';
import { rechargeCodes, rechargeDecimalText, rechargeInspectionInput, rechargeInspectionRequest, rechargeInspectionResource, rechargeRule } from '@/lib/recharge-failover';
import { Alert, Card, Field, formatInstant, useFailoverError } from '@/components/payout-failover/Common';
import { SetupStep } from '@/components/failover/Experience';
import { failureConditionLabel } from '@/lib/failover-presentation';
import ProductSummary from './ProductSummary';

function Inspector({ side, country, type, input, onInput, inspection, onInspected, onInvalidated, capabilities }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const alive = useRef(true), lock = useRef(false), fail = useFailoverError(setError);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  let request = null;
  try { request = rechargeInspectionRequest({ country, type, ...input }, capabilities); } catch { /* Form may be incomplete. */ }
  const stale = inspection && (!request || inspection.requestKey !== failoverFingerprint(request));
  async function inspect() {
    if (lock.current) return;
    let payload;
    try { payload = rechargeInspectionRequest({ country, type, ...input }, capabilities); }
    catch (err) { setError(err.message); return; }
    lock.current = true; setBusy(true); setError(''); onInvalidated();
    try {
      const response = await api.rechargeFailover.inspect(payload);
      const result = rechargeInspectionResource(response, payload);
      if (alive.current) onInspected({ ...result, inspectedAt: new Date().toISOString() });
    } catch (err) { if (alive.current) await fail(err); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <section className="failover-rule-summary" aria-label={side + ' product inspection'}>
    <h3>{side} product</h3>
    <fieldset disabled={busy} className="failover-card" style={{ border: 0, margin: 0, padding: 0 }}>
      <Field label={side + ' provider'}><select value={input.provider} onChange={(event) => onInput({ ...input, provider: event.target.value })}><option value="">Choose a provider</option>{Object.keys(capabilities.rejectionCodes).filter((provider) => ['RELOADLY', 'ZENDIT'].includes(provider)).map((provider) => <option key={provider} value={provider}>{provider}</option>)}</select></Field>
      {input.provider === 'RELOADLY' ? <Field label={side + ' Reloadly operator ID'}><input inputMode="numeric" value={input.operatorId} onChange={(event) => onInput({ ...input, operatorId: event.target.value })} /></Field> : input.provider === 'ZENDIT' ? <Field label={side + ' Zendit offer ID'}><input value={input.offerId} onChange={(event) => onInput({ ...input, offerId: event.target.value })} /></Field> : null}
      <Field label={side + ' fixed supplier amount'} help={input.provider === 'ZENDIT' ? 'Must equal the current fixed catalog supplier cost.' : 'Use the fixed sender denomination.'}><input inputMode="decimal" value={input.amount} onChange={(event) => onInput({ ...input, amount: event.target.value })} /></Field>
    </fieldset>
    <Alert>{error}</Alert>
    <button type="button" className="btn-neutral" disabled={busy || !request} onClick={() => void inspect()}>{busy ? 'Inspecting ' + side.toLowerCase() + '…' : 'Inspect ' + side.toLowerCase() + ' product'}</button>
    {inspection ? <><Alert>{stale ? 'Inspection inputs changed. Inspect again before using this product.' : null}</Alert><ProductSummary product={inspection.product} title={stale ? 'Previous inspection' : 'Current inspection'} />
      <small>Inspected: {formatInstant(inspection.inspectedAt)}</small>
      <span>{inspection.reviewRequired}</span>
      <details><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Read provider catalog terms</summary><pre style={{ maxHeight: '320px', overflow: 'auto', marginTop: '.5rem' }}>{JSON.stringify(inspection.terms, null, 2)}</pre></details>
    </> : <small>No inspection loaded. Inspect performs provider reads and never purchases.</small>}
  </section>;
}

export default function ProductsPanel({ capabilities, selectedRule, canPublish, ready, onUse }) {
  const [id] = useState(() => selectedRule?.id || newFailoverRule().id);
  const [country, setCountry] = useState(selectedRule?.country || ''), [type, setType] = useState(selectedRule?.type || '');
  const [sourceInput, setSourceInput] = useState(() => rechargeInspectionInput(selectedRule?.source)), [targetInput, setTargetInput] = useState(() => rechargeInspectionInput(selectedRule?.target));
  const [source, setSource] = useState(null), [target, setTarget] = useState(null);
  const [networkIdentity, setNetworkIdentity] = useState(selectedRule?.networkIdentity || ''), [benefitsReview, setBenefitsReview] = useState(selectedRule?.benefitsReview || '');
  const [expiresAt, setExpiresAt] = useState(selectedRule?.expiresAt || null), [maxAdditionalCost, setMaxAdditionalCost] = useState(selectedRule?.maxAdditionalCost == null ? '' : rechargeDecimalText(selectedRule.maxAdditionalCost));
  const [failureCodes, setFailureCodes] = useState(selectedRule?.failureCodes || []), [reviewed, setReviewed] = useState(false), [info, setInfo] = useState(''), [error, setError] = useState('');
  const validation = useMemo(() => {
    try {
      const sourceRequest = rechargeInspectionRequest({ country, type, ...sourceInput }, capabilities), targetRequest = rechargeInspectionRequest({ country, type, ...targetInput }, capabilities);
      if (!source || !target || source.requestKey !== failoverFingerprint(sourceRequest) || target.requestKey !== failoverFingerprint(targetRequest)) throw new Error('Inspect both current product selections before using the mapping.');
      if (!reviewed) throw new Error('Review the two inspected products and explicitly confirm equivalent benefits and eligibility.');
      if (!expiresAt || Date.parse(expiresAt) <= Date.now()) throw new Error('Choose a future approval expiry.');
      const rule = rechargeRule({ id, enabled: selectedRule?.enabled ?? true, country: country.trim().toUpperCase(), type, source: source.product, target: target.product, networkIdentity, benefitsReview, expiresAt, maxAdditionalCost, failureCodes }, capabilities);
      return { rule, error: '' };
    } catch (err) { return { rule: null, error: err.message }; }
  }, [country, type, sourceInput, targetInput, source, target, reviewed, expiresAt, id, selectedRule?.enabled, networkIdentity, benefitsReview, maxAdditionalCost, failureCodes, capabilities]);
  const resetReview = () => { setReviewed(false); setInfo(''); setError(''); };
  return <Card title={selectedRule ? 'Review this product pair' : 'Review a primary and backup product'}>
    <p>Choose the exact products that deliver equivalent benefits on the same real network. Inspect both, record your review, then add the approved pair to the setup draft. Nothing here saves or enables failover.</p>
    <SetupStep number="1" title="Choose and inspect both products">Find operator and offer IDs in Recharge Catalog. Inspection reads supplier terms and never purchases.</SetupStep>
    <div className="failover-grid">
      <Field label="Country" help="ISO alpha-2, for example CD."><CountrySelect required emptyLabel="Select country" value={country} onChange={(event) => { setCountry(event.target.value.toUpperCase()); resetReview(); }} /></Field>
      <Field label="Product type"><select value={type} onChange={(event) => { setType(event.target.value); resetReview(); }}><option value="">Choose a product type</option>{capabilities.productTypes.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></Field>
    </div>
    {selectedRule ? <div className="failover-grid"><ProductSummary product={selectedRule.source} title="Previously approved primary product" /><ProductSummary product={selectedRule.target} title="Previously approved backup product" /></div> : null}
    <div className="failover-grid">
      <Inspector side="Primary" country={country} type={type} input={sourceInput} onInput={(input) => { if (input.provider !== sourceInput.provider) setFailureCodes([]); setSourceInput(input); resetReview(); }} inspection={source} onInspected={(result) => { setSource(result); resetReview(); }} onInvalidated={() => { setSource(null); resetReview(); }} capabilities={capabilities} />
      <Inspector side="Backup" country={country} type={type} input={targetInput} onInput={(input) => { setTargetInput(input); resetReview(); }} inspection={target} onInspected={(result) => { setTarget(result); resetReview(); }} onInvalidated={() => { setTarget(null); resetReview(); }} capabilities={capabilities} />
    </div>
    <SetupStep number="2" title="Confirm the benefits, price limit and approval period">For airtime, delivered amount/currency must match. For data and bundles, compare duration, data, voice/SMS, eligibility, fair-use limits, taxes and promotions.</SetupStep>
    <div className="failover-grid">
      <Field label="Real network name" help="Both products must use the same real network. Country/operator/recipient restrictions still apply."><input maxLength={200} value={networkIdentity} onChange={(event) => { setNetworkIdentity(event.target.value); resetReview(); }} /></Field>
      <Field label="Approval expires at (UTC)" help="After this time the pair must be inspected and reviewed again." tip="The approval is tied to both this expiry and the returned product fingerprints. Changed supplier terms block use even before expiry."><input type="datetime-local" step="1" value={failoverUtcInput(expiresAt)} onChange={(event) => { setExpiresAt(failoverUtcValue(event.target.value)); resetReview(); }} /></Field>
      <Field label="Allowed extra supplier cost" help="Maximum increase over the primary product cost. Zero allows no increase." tip="For a primary cost of 5.00 and a limit of 0.10, 5.08 passes the cost ceiling but 5.11 does not. This uses the common supplier currency; it is not net profit. Review fees/discounts separately. The customer is not charged again."><input inputMode="decimal" value={maxAdditionalCost} onChange={(event) => { setMaxAdditionalCost(event.target.value); resetReview(); }} /></Field>
    </div>
    <Field label="What makes these products equivalent?" help="Record equal data, duration, voice/SMS, fair-use/unlimited terms, time restrictions, prepaid/recipient eligibility, taxes, activation method and promotions. 20–4,000 characters."><textarea rows={5} maxLength={4000} value={benefitsReview} onChange={(event) => { setBenefitsReview(event.target.value); resetReview(); }} /></Field>
    <SetupStep number="3" title="Choose the confirmed failure conditions">A backup needs proof that the primary purchase was not delivered. Only the conditions below are supported.</SetupStep>
    <div className="failover-card"><strong>When can this backup be used?</strong>
      {rechargeCodes(capabilities, sourceInput.provider).map((code) => <label className="failover-check" key={code}><input type="checkbox" checked={failureCodes.includes(code)} onChange={(event) => { setFailureCodes(event.target.checked ? [...failureCodes, code] : failureCodes.filter((item) => item !== code)); resetReview(); }} /><span>{failureConditionLabel(code)}<small>{code}</small></span></label>)}
      <small>{sourceInput.provider === 'RELOADLY' ? 'Only correlated, authenticated terminal REFUNDED read-back can switch. An insufficient-balance HTTP response alone is not eligible.' : sourceInput.provider === 'ZENDIT' ? 'Requires correlated terminal FAILED evidence and an allowed code. IN_PROGRESS, accepted, missing, timed-out and queued requests never authorize a second purchase.' : 'Choose the primary provider to see supported failure conditions.'}</small>
      {failureCodes.some((code) => !rechargeCodes(capabilities, sourceInput.provider).includes(code)) ? <Alert>An old failure code is unsupported for this source. Choose the current allowlist or start a new pair.</Alert> : null}
    </div>
    <label className="failover-check"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />I reviewed both inspected products and verified equivalent benefits and recipient eligibility.</label>
    {validation.error ? <small role="status">{validation.error}</small> : null}
    <Alert>{error}</Alert><Alert success>{info}</Alert>
    {!ready ? <small>Copying to the policy draft is unavailable until its saved state loads and any publication finishes.</small> : null}
    <button type="button" className="btn-primary" disabled={!validation.rule || !ready} onClick={() => {
      if (!ready || !validation.rule) return;
      if (Date.parse(expiresAt) <= Date.now()) { setError('Approval expired. Choose a future expiry and review again.'); setReviewed(false); return; }
      onUse(validation.rule); setInfo('Reviewed mapping copied to the local policy draft. It has not been published.');
    }}>{canPublish ? 'Add reviewed pair to setup draft' : 'Add reviewed pair to preview draft'}</button>
    <small>Approval fingerprints are copied unchanged from the backend. Reinspection and review are required when metadata changes. A reverse direction needs a separate reviewed mapping. No extra debit or customer fee is created.</small>
  </Card>;
}
