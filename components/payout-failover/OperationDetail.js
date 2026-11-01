'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Alert, Card, formatInstant, useFailoverError } from './Common';

function operationResource(response, transactionId) {
  if (String(response?.operation?.transactionId) !== String(transactionId) || !Array.isArray(response.operation.attempts) || !Array.isArray(response.statusChecks) || !Array.isArray(response.providerEvents)) throw new Error('The operation timeline is unavailable.');
  return response;
}
export default function OperationDetail({ transactionId, capabilities, onHistory, onClose }) {
  const [detail, setDetail] = useState(null), [loading, setLoading] = useState(true), [checking, setChecking] = useState(false), [error, setError] = useState(''), [info, setInfo] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0), [now, setNow] = useState(Date.now());
  const sequence = useRef(0), lock = useRef(false), mounted = useRef(true), heading = useRef(null);
  const fail = useFailoverError(setError);
  const accept = useCallback((response) => {
    const resource = operationResource(response, transactionId);
    setDetail(resource);
    const last = Math.max(0, ...resource.statusChecks.map((item) => Date.parse(item.checkedAt) || 0));
    setCooldownUntil((previous) => Math.max(previous, last + 30000));
  }, [transactionId]);
  const load = useCallback(async () => {
    const token = ++sequence.current;
    setLoading(true); setError('');
    try { const response = await api.payoutFailover.operation(transactionId); if (token === sequence.current) accept(response); }
    catch (err) { if (token === sequence.current) await fail(err.status === 404 ? new Error('No failover journal exists for this transaction. This does not mean the payment failed.') : err); }
    finally { if (token === sequence.current) setLoading(false); }
  }, [transactionId, accept, fail]);
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; sequence.current += 1; }; }, [load]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [transactionId]);
  async function check() {
    if (lock.current || loading || !detail || cooldownUntil > Date.now()) return;
    lock.current = true; setChecking(true); setError(''); setInfo(''); setCooldownUntil(Date.now() + 30000);
    try {
      const response = await api.payoutFailover.statusCheck(transactionId);
      if (!mounted.current) return;
      if (String(response?.transactionId) !== String(transactionId) || response.financialStateChanged !== false || !Array.isArray(response.observations)) throw new Error('The backend did not confirm an observational status check. Refresh the timeline.');
      setDetail((previous) => ({ ...previous, statusChecks: [...response.observations, ...previous.statusChecks.filter((item) => item.batchId !== response.batchId)].slice(0, 200) }));
      setInfo('Provider observations recorded. Financial state changed: No. Positive or contradictory evidence must follow the reviewed reconciliation process.');
      try { const fresh = await api.payoutFailover.operation(transactionId); if (mounted.current) accept(fresh); }
      catch (err) { if (mounted.current) await fail(new Error('Observations are retained, but the timeline could not be refreshed. ' + err.message)); }
    } catch (err) {
      if (mounted.current) { if (err.status === 429) setCooldownUntil(Date.now() + 30000); await fail(err); }
    } finally { lock.current = false; if (mounted.current) setChecking(false); }
  }
  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const operation = detail?.operation;
  return <Card aria-label={'Transaction ' + transactionId + ' failover timeline'}>
    <div className="failover-heading"><h2 ref={heading} tabIndex={-1}>Transaction #{transactionId} · Attempt timeline</h2><div className="failover-actions"><button type="button" className="btn-neutral btn-sm" disabled={loading || checking} onClick={() => void load()}>Refresh timeline</button><button type="button" className="btn-neutral btn-sm" onClick={onClose}>Close timeline</button></div></div>
    <Alert>{error}</Alert><Alert success>{info}</Alert>{loading ? <span role="status">Loading attempt evidence…</span> : null}
    {operation ? <>
      <div className="failover-grid"><span>Reference: {operation.internalReference || '—'}</span><span>Account: {operation.accountId ?? '—'}</span><span>Transaction state: {operation.transactionStatus || 'Missing'}</span><span>Action: {operation.action || '—'}</span><span>Amount: {operation.amount ?? '—'} {operation.currency}</span><span>Gross: {operation.grossAmount ?? '—'} {operation.currency}</span><strong>{operation.conflicted ? 'CONFLICTED' : 'No conflict recorded'} · {operation.unresolved ? 'UNRESOLVED' : 'Resolved'}</strong></div>
      <Link href={'/dashboard/transactions?transactionId=' + encodeURIComponent(transactionId)}>Open transaction investigation</Link>
      <ol className="failover-timeline">{operation.attempts.map((attempt) => <li key={attempt.number}><article className="failover-rule-summary">
        <strong>Attempt {attempt.number} · {attempt.provider} · {attempt.state}{attempt.number === operation.currentAttempt ? ' · Current attempt' : ''}</strong>
        <span>Route #{attempt.routeId} · Submit result: {attempt.submitResultStatus || '—'} · Rejection: {attempt.rejectionCode || '—'}</span>
        <span>Request reference: {attempt.requestReference || '—'}</span><span>Provider reference: {attempt.providerReference || '—'}</span>
        <span>Created {formatInstant(attempt.createdAt)} · Updated {formatInstant(attempt.updatedAt)}</span>
        {attempt.policyRevision != null ? <div className="failover-actions"><button type="button" className="btn-neutral btn-sm" onClick={() => onHistory(attempt.policyRevision)}>Policy revision {attempt.policyRevision}</button><span>Rule {attempt.ruleId || '—'}</span></div> : <span>Policy provenance: not recorded for this source/earlier attempt.</span>}
      </article></li>)}</ol>
      <div className="failover-card"><h3>Provider status checks</h3>
        <p>Queries recorded attempt identities, including the original pawaPay request after a route change. No submit, refund, cancellation, hold release or automatic reconciliation occurs.</p>
        {capabilities.providers.filter((provider) => operation.attempts.some((attempt) => attempt.provider === provider.provider)).map((provider) => <small key={provider.provider}>{provider.provider}: {provider.liveStatusCheckSupported ? 'Live lookup supported.' : 'Live lookup UNSUPPORTED. Use recorded callbacks and provider operational records.'} {provider.explanation}</small>)}
        <div className="failover-actions"><button type="button" className="btn-neutral" disabled={checking || loading || remaining > 0} onClick={() => void check()}>{checking ? 'Checking providers…' : remaining > 0 ? 'Check available in ' + remaining + 's' : 'Check provider evidence'}</button><small>Shared 30-second cooldown across admins. Last observation: {formatInstant(detail.statusChecks[0]?.checkedAt)}</small></div>
        {detail.statusChecks.length ? <div className="failover-table"><table><thead><tr>{['When / actor / batch', 'Attempt', 'Lookup / provider status', 'Failure / review', 'Diagnostic'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{detail.statusChecks.map((observation, index) => <tr key={String(observation.id) + '-' + index}><td>{formatInstant(observation.checkedAt)}<div>Admin {observation.adminId} · {observation.batchId}</div></td><td>#{observation.attemptNumber}</td><td><strong>{observation.lookupStatus}</strong><div>{observation.providerStatus || '—'}</div></td><td>{observation.failureCode || '—'}<div>{observation.requiresManualReview ? 'Manual review required' : 'No review flag'}</div></td><td>{observation.diagnostic || '—'}</td></tr>)}</tbody></table></div> : <span>No recorded status-check observations.</span>}
      </div>
      <div className="failover-card"><h3>Recorded provider event summaries</h3>
        {detail.providerEvents.length ? <div className="failover-table"><table><thead><tr>{['Sequence / event', 'Provider / operation', 'Reference / status', 'Created'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{detail.providerEvents.map((event, index) => <tr key={event.id ?? index}><td>{event.sequenceNumber ?? '—'} · {event.eventType}</td><td>{event.provider}<div>{event.operation}</div></td><td>{event.providerReference || '—'}<div>{event.status || '—'}</div></td><td>{formatInstant(event.createdAt)}</td></tr>)}</tbody></table></div> : <span>No provider events recorded.</span>}
        <small>Summaries contain no raw payloads or credentials. RETURNED is submit evidence, not settlement confirmation. Conflicting evidence requires the existing reviewed manual-reconciliation process across all attempts.</small>
      </div>
    </> : null}
  </Card>;
}
