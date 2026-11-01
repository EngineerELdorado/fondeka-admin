'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { explainFailoverReason } from '@/lib/failover-presentation';
import { CatalogSelect } from '@/components/CatalogSelect';
import { failoverCodes, failoverFingerprint, failoverPreview, failoverUtcInput, failoverUtcValue } from '@/lib/payout-failover';
import { Alert, Field, ValidationReport, formatInstant, useFailoverError } from './Common';

export default function PreviewPanel({ capabilities, configuration, saved, routes }) {
  const [source, setSource] = useState('saved'), [context, setContext] = useState('NONE'), [transactionId, setTransactionId] = useState(''), [rejectionCode, setRejectionCode] = useState('');
  const [sample, setSample] = useState({ accountId: '', sourceRouteId: '', amount: '', grossAmount: '', currency: '', accountNumber: '', networkId: '', action: '', createdAt: null });
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), fail = useFailoverError(setError);
  const inputKey = failoverFingerprint({ source, context, transactionId, rejectionCode, sample, configuration: source === 'draft' ? configuration : saved?.policy.revision });
  const stale = result && result.inputKey !== inputKey;
  async function preview() {
    if (lock.current) return;
    let body;
    try {
      if (source === 'draft' && !configuration) throw new Error('Complete the draft configuration before previewing it.');
      body = failoverPreview({ configuration: source === 'draft' ? configuration : null, context, transactionId, rejectionCode, sample }, capabilities);
    } catch (err) { setError(err.message); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const response = await api.payoutFailover.preview(body);
      if (response?.sendsPayments !== false || !response.validation || !Array.isArray(response.validation.issues) || !Array.isArray(response.validation.routes) || !Array.isArray(response.reasons) || !['NONE', 'SAMPLE', 'EXISTING_TRANSACTION'].includes(response.contextType)) throw new Error('The backend did not confirm a complete non-payment preview.');
      setResult({ ...response, inputKey });
    } catch (err) { await fail(err); }
    finally { setBusy(false); lock.current = false; }
  }
  const changeSample = (key, value) => setSample((previous) => ({ ...previous, [key]: value }));
  return <details className="card failover-technical"><summary>Test your payout setup without sending payments</summary><div className="failover-card" style={{ marginTop: '.85rem' }}>
    <p>Preview validates configuration and optionally evaluates eligibility. It publishes nothing, sends no payment and does not make existing transactions replayable.</p>
    <fieldset disabled={busy || !saved} className="failover-card" style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="failover-grid"><Field label="Settings to test"><select value={source} onChange={(event) => setSource(event.target.value)}><option value="saved">Saved setup</option><option value="draft">Unsaved setup draft</option></select></Field><Field label="What to check"><select value={context} onChange={(event) => setContext(event.target.value)}><option value="NONE">Setup settings only</option><option value="EXISTING_TRANSACTION">An existing payment</option><option value="SAMPLE">An example payout (no money sent)</option></select></Field>
        <Field label="Confirmed primary-provider failure" help="Choose a reviewed failure condition to test backup selection." tip="Without a failure condition, this checks general eligibility only. It does not select a backup. Timeouts and generic HTTP errors cannot be used as failover triggers."><select value={rejectionCode} onChange={(event) => setRejectionCode(event.target.value)}><option value="">General eligibility only</option>{failoverCodes(capabilities).map((entry) => <option key={entry.code} value={entry.code}>{entry.code}</option>)}</select></Field></div>
      {context === 'EXISTING_TRANSACTION' ? <Field label="Existing transaction ID"><input inputMode="numeric" value={transactionId} onChange={(event) => setTransactionId(event.target.value)} /></Field> : null}
      {context === 'SAMPLE' ? <div className="failover-grid">
        <Field label="Example customer account ID"><input inputMode="numeric" value={sample.accountId} onChange={(event) => changeSample('accountId', event.target.value)} /></Field>
        <Field label="Example primary route"><CatalogSelect kind="payment-route" records={routes} value={sample.sourceRouteId} onChange={(event) => changeSample('sourceRouteId', event.target.value)}><option value="">Choose a source route</option>{routes.map((route) => <option key={route.id} value={route.id}>{route.paymentMethodName + ' · #' + route.id}</option>)}</CatalogSelect></Field>
        {['amount', 'grossAmount', 'currency', 'accountNumber', 'networkId'].map((key) => <Field key={key} label={{ amount: 'Sample amount', grossAmount: 'Sample gross amount (optional)', currency: 'Sample currency', accountNumber: 'Recipient account number', networkId: 'Network ID (optional)' }[key]}><input inputMode={['amount', 'grossAmount'].includes(key) ? 'decimal' : undefined} value={sample[key]} onChange={(event) => changeSample(key, key === 'currency' ? event.target.value.toUpperCase() : event.target.value)} /></Field>)}
        <Field label="Example payout action"><select value={sample.action} onChange={(event) => changeSample('action', event.target.value)}><option value="">Choose an action</option>{capabilities.actions.map((action) => <option key={action} value={action}>{action}</option>)}</select></Field>
        <Field label="Example payment creation time (UTC)" help="Use a time after the proposed start boundary. Blank uses now."><input type="datetime-local" step="1" value={failoverUtcInput(sample.createdAt)} onChange={(event) => changeSample('createdAt', failoverUtcValue(event.target.value))} /></Field>
      </div> : null}
    </fieldset>
    <Alert>{error}</Alert><div><button type="button" className="btn-neutral" disabled={busy || !saved || source === 'draft' && !configuration} onClick={() => void preview()}>{busy ? 'Checking setup…' : 'Run a no-payment check'}</button></div>
    {result ? <div className="failover-card" aria-label="Preview result">
      {stale ? <Alert>Inputs or saved revision changed. This is a previous preview; run it again for the current inputs.</Alert> : null}
      <strong>{result.contextType === 'NONE' ? 'Configuration validation only — eligibility not evaluated' : (result.eligible === true ? 'Eligible under local checks' : result.eligible === false ? 'Not eligible under local checks' : 'Eligibility unavailable')}</strong>
      <span>Check: {{ NONE: 'Settings only', SAMPLE: 'Example payout', EXISTING_TRANSACTION: 'Existing payment' }[result.contextType]} · Payments sent: No · Evaluated creation: {formatInstant(result.evaluatedCreatedAt)}</span>
      {result.targetRouteId != null ? <span>Alternate route #{result.targetRouteId} · Rule {result.ruleId}</span> : null}
      {result.reasons.length ? <ul>{result.reasons.map((code, index) => { const reason = explainFailoverReason(code); return <li key={index}><strong>{reason.title}</strong><p>{reason.detail}</p><small>{reason.code}</small></li>; })}</ul> : null}
      <ValidationReport report={result.validation} title={stale ? 'Previous preview validation' : 'Preview validation'} />
      <small>{rejectionCode ? 'Alternate destination eligibility was requested.' : 'No rejection code was supplied; no alternate destination was selected.'} Provider funds, availability and future external outcomes are not guaranteed.</small>
    </div> : null}
  </div></details>;
}
